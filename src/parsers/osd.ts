import { SoilProfile } from '../core/SoilProfile';
import { Horizon } from '../core/types';
import { munsellToHex } from '../core/munsell';

/**
 * Coerce value to number, fallback on NaN
 */
function parseNumeric(value: any, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Extract and convert Munsell color parameters to hex, with fallback
 */
function getHorizonColor(rawHorizon: any): string {
  const moistHue = rawHorizon.moist_hue;
  const moistValue = parseNumeric(rawHorizon.moist_value, NaN);
  const moistChroma = parseNumeric(rawHorizon.moist_chroma, NaN);

  // Try Munsell conversion
  if (Number.isFinite(moistValue)) {
    const hex = munsellToHex(moistHue, moistValue, moistChroma);
    if (hex) return hex;
  }

  // Fallback to neutral gray
  return '#cccccc';
}

/**
 * Validate and convert a raw horizon to Horizon object, or undefined if invalid
 */
function toProfileHorizon(rawHorizon: any): Horizon | undefined {
  const top = parseNumeric(rawHorizon.top, NaN);
  const bottom = parseNumeric(rawHorizon.bottom, NaN);

  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top >= bottom) {
    return undefined;
  }

  // Fields explicitly processed by the parser
  const standardFields = ['name', 'top', 'bottom', 'texture_class', 'moist_hue', 'moist_value', 'moist_chroma'];

  // Collect all non-standard fields into metadata
  const metadata: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawHorizon)) {
    if (!standardFields.includes(key)) {
      metadata[key] = value;
    }
  }

  return {
    name: String(rawHorizon.name ?? 'Unknown'),
    top,
    bottom,
    color: getHorizonColor(rawHorizon),
    texture: rawHorizon.texture_class ? String(rawHorizon.texture_class) : undefined,
    metadata
  };
}

/**
 * Parse OSD JSON document (from SoilKnowledgeBase) into a SoilProfile
 *
 * @param doc OSD document with SERIES name and HORIZONS array
 * @returns SoilProfile instance
 *
 * Invalid horizons (missing/invalid depths) are skipped with console.warn()
 * Munsell conversion failures fall back to "#cccccc"
 */
export function parseOSDJson(doc: any): SoilProfile {
  const seriesName = doc.SERIES ?? 'Unknown';
  const rawHorizons = doc.HORIZONS ?? [];

  if (!Array.isArray(rawHorizons)) {
    console.warn(`OSD parser: HORIZONS is not an array for series "${seriesName}"`);
    return new SoilProfile(seriesName, []);
  }

  const horizons: Horizon[] = [];
  for (const raw of rawHorizons) {
    const horizon = toProfileHorizon(raw);
    if (horizon) {
      horizons.push(horizon);
    } else {
      const name = raw.name ?? 'unnamed';
      const top = parseNumeric(raw.top, NaN);
      const bottom = parseNumeric(raw.bottom, NaN);
      console.warn(
        `OSD parser: Skipping horizon "${name}" (invalid depth: top=${top}, bottom=${bottom})`
      );
    }
  }

  if (horizons.length === 0) {
    console.warn(`OSD parser: No valid horizons for series "${seriesName}"`);
  }

  return new SoilProfile(seriesName, horizons);
}
