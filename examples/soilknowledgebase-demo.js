const DIST_ENTRY_MODULES = [
  'index.js',
  'core/types.js',
  'core/colors.js',
  'core/layout.js',
  'core/mapping.js',
  'core/munsell.js',
  'core/phScale.js',
  'core/texture.js',
  'core/tooltipUtils.js',
  'core/SoilProfile.js',
  'core/SoilProfileCollection.js',
  'render/safety.js',
  'render/static.js',
  'render/interactive.js',
  'render/comparison.js',
  'render/three3d.js',
  'utils/munsell-approx.js'
];

const SERIES_NAMES = [
  'PAXTON',
  'MONTAUK',
  'WOODBRIDGE',
  'RIDGEBURY',
  'WHITMAN',
  'CATDEN'
];

const SOURCE_BASE_URL = 'https://raw.githubusercontent.com/ncss-tech/SoilKnowledgeBase/refs/heads/main/inst/extdata/OSD';
const moduleSources = new Map();
const moduleCache = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeModulePath(pathValue) {
  const parts = pathValue.split('/');
  const normalized = [];

  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return `/${normalized.join('/')}`;
}

function resolveModuleId(fromModuleId, request) {
  if (!request.startsWith('.')) {
    throw new Error(`Unsupported external module "${request}" in browser demo loader.`);
  }

  const fromParts = fromModuleId.split('/');
  fromParts.pop();
  const requestParts = request.split('/');

  return normalizeModulePath([...fromParts, ...requestParts].join('/').concat('.js').replace(/\.js\.js$/, '.js'));
}

function executeModule(moduleId) {
  if (moduleCache.has(moduleId)) {
    return moduleCache.get(moduleId).exports;
  }

  const source = moduleSources.get(moduleId);
  if (!source) {
    throw new Error(`Missing module source for ${moduleId}`);
  }

  const moduleObject = { exports: {} };
  moduleCache.set(moduleId, moduleObject);

  const localRequire = request => executeModule(resolveModuleId(moduleId, request));
  const fn = new Function('require', 'module', 'exports', source);
  fn(localRequire, moduleObject, moduleObject.exports);

  return moduleObject.exports;
}

async function loadDistributionModules() {
  await Promise.all(
    DIST_ENTRY_MODULES.map(async modulePath => {
      const moduleId = normalizeModulePath(`dist/${modulePath}`);
      const response = await fetch(`../dist/${modulePath}`);
      if (!response.ok) {
        throw new Error(`Unable to load ../dist/${modulePath} (${response.status})`);
      }
      moduleSources.set(moduleId, await response.text());
    })
  );
}

function buildSeriesUrl(seriesName) {
  const firstLetter = seriesName[0];
  return `${SOURCE_BASE_URL}/${firstLetter}/${seriesName}.json`;
}

async function fetchSeriesDocument(seriesName) {
  const response = await fetch(buildSeriesUrl(seriesName));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${seriesName} (${response.status})`);
  }
  return response.json();
}

function parseNumeric(value, fallback) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hueToDegrees(rawHue) {
  const normalized = String(rawHue ?? '').toUpperCase().replace(/\s+/g, '');
  const lookup = {
    '10R': 0,
    '2.5YR': 20,
    '5YR': 30,
    '7.5YR': 40,
    '10YR': 50,
    '2.5Y': 60,
    '5Y': 70,
    '7.5Y': 80,
    '10Y': 90
  };

  return lookup[normalized] ?? 42;
}

function horizonFallbackColor(horizonName) {
  const upper = String(horizonName ?? '').toUpperCase();
  if (upper.startsWith('A')) return '#5a3e2b';
  if (upper.startsWith('B')) return '#8a5a3c';
  if (upper.startsWith('C')) return '#7c7168';
  if (upper.startsWith('O')) return '#3a2a1f';
  return '#9b7d5f';
}

function getHorizonColor(horizon) {
  const moistHue = horizon.moist_hue;
  const moistValue = parseNumeric(horizon.moist_value, NaN);
  const moistChroma = parseNumeric(horizon.moist_chroma, NaN);

  if (!Number.isFinite(moistValue) || !Number.isFinite(moistChroma)) {
    return horizonFallbackColor(horizon.name);
  }

  const hue = hueToDegrees(moistHue);
  const lightness = clamp(10 + moistValue * 10, 12, 82);
  const saturation = clamp(15 + moistChroma * 8, 12, 88);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function extractRawHorizonRows(seriesDocument) {
  const rawHorizons = seriesDocument.HORIZONS;
  if (!Array.isArray(rawHorizons) || rawHorizons.length === 0) {
    return [];
  }

  return Array.isArray(rawHorizons[0]) ? rawHorizons[0] : rawHorizons;
}

function toProfileHorizon(rawHorizon) {
  const top = parseNumeric(rawHorizon.top, NaN);
  const bottom = parseNumeric(rawHorizon.bottom, NaN);

  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top >= bottom) {
    return undefined;
  }

  return {
    name: String(rawHorizon.name ?? 'Unknown'),
    top,
    bottom,
    color: getHorizonColor(rawHorizon),
    texture: rawHorizon.texture_class ? String(rawHorizon.texture_class) : undefined,
    metadata: {
      structure: rawHorizon.structure ?? undefined,
      pH_class: rawHorizon.pH_class ?? undefined
    }
  };
}

function toSoilProfile(seriesDocument, index, SoilProfile) {
  const horizons = extractRawHorizonRows(seriesDocument)
    .map(toProfileHorizon)
    .filter(Boolean);

  if (horizons.length === 0) {
    throw new Error(`No valid horizons for ${seriesDocument.SERIES ?? `series-${index + 1}`}`);
  }

  return new SoilProfile(
    String(seriesDocument.SERIES ?? `SERIES-${index + 1}`),
    horizons,
    { x: index * 24, y: 0, z: 0 }
  );
}

function profileCardHtml(profile, sourceDocument, renderStaticSVG, SoilProfileCollection) {
  const singleCollection = new SoilProfileCollection([profile]);
  const svg = renderStaticSVG(singleCollection, { width: 250, height: 380, format: 'svg' });
  const summary = sourceDocument.DRAINAGE_AND_PERMEABILITY?.content ?? sourceDocument.OVERVIEW ?? '';
  const summaryText = String(summary).replace(/\s+/g, ' ').slice(0, 220);

  return `
    <article class="card">
      <h3>${escapeHtml(profile.id)}</h3>
      <div class="svg-wrap">${svg}</div>
      <p class="meta">${escapeHtml(summaryText)}...</p>
      <p class="meta">
        <a href="${escapeHtml(buildSeriesUrl(profile.id))}" target="_blank" rel="noopener noreferrer">View source JSON</a>
      </p>
    </article>
  `;
}

function renderError(message) {
  const summary = document.getElementById('summary');
  const cards = document.getElementById('cards');
  summary.textContent = message;
  cards.innerHTML = '';
}

async function bootstrap() {
  await loadDistributionModules();
  const rootExports = executeModule('/dist/index.js');
  const { 
    SoilProfile, 
    SoilProfileCollection, 
    renderInteractive2D, 
    renderStaticSVG, 
    mapToHorizon,
    DATA_MAPS
  } = rootExports;

  const sourceDocuments = await Promise.all(SERIES_NAMES.map(fetchSeriesDocument));
  
  // Refactor to use mapping
  const profiles = sourceDocuments.map((doc, index) => {
    const rawHorizons = extractRawHorizonRows(doc);
    const horizons = rawHorizons.map(rh => mapToHorizon(rh)).filter(h => h.top < h.bottom);
    return new SoilProfile(doc.SERIES ?? `SERIES-${index + 1}`, horizons, { x: index * 24, y: 0, z: 0 });
  });
  
  const collection = new SoilProfileCollection(profiles);

  const interactiveContainer = document.getElementById('interactive');
  const summary = document.getElementById('summary');
  const cards = document.getElementById('cards');

  // Can now toggle modes (e.g., set to 'depth')
  renderInteractive2D(interactiveContainer, collection, {
    interactive: true,
    arrangement: '2d',
    mode: 'depth'
  });

  summary.textContent = `Loaded ${profiles.length} profiles from SoilKnowledgeBase: ${profiles
    .map(profile => profile.id)
    .join(', ')}. Hover within the chart for horizon details.`;

  cards.innerHTML = sourceDocuments
    .map((doc, index) => profileCardHtml(profiles[index], doc, renderStaticSVG, SoilProfileCollection))
    .join('');
}

bootstrap().catch(error => {
  console.error(error);
  renderError(`Demo failed to load: ${error.message}`);
});
