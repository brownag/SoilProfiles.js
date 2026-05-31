import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { StaticRenderOptions, Horizon, RenderMode } from '../core/types';
import { escapeSvgAttribute, escapeSvgText, finiteNumber, sanitizeColor, generateHorizonId, serializeHorizonData } from './safety';
import { classifyTexture, getTextureColor } from '../core/texture';
import { getPhColor, clampPh } from '../core/phScale';
import { isDarkMode, THEMES, getTextColorForBackground, resolveHorizonColor } from '../core/colors';
import { munsellToHex } from '../core/munsell';

function shouldRenderTitle(tooltipMode: string): boolean {
  return tooltipMode === 'native' || tooltipMode === undefined;
}

export function renderStaticSVG(profiles: SoilProfileCollection, options: StaticRenderOptions): string {
    const width = finiteNumber(options.width, 800);
    const height = finiteNumber(options.height, 600);
    const mode = options.mode || 'depth';
    const tooltipMode = options.tooltips?.mode ?? 'native';

    const theme = isDarkMode() ? THEMES.dark : THEMES.light;

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:${theme.bgColor}; border:1px solid ${theme.borderColor};">`;

    // Background
    svg += `<rect width="${width}" height="${height}" fill="${theme.bgColor}" stroke="none" />`;

    if (profiles.profiles.length === 0) {
        svg += `</svg>`;
        return svg;
    }

    if (mode === 'depth') {
        svg += renderDepthMode(profiles, width, height, theme, tooltipMode);
    } else if (mode === 'texture') {
        svg += renderTextureMode(profiles, width, height, theme, tooltipMode);
    } else if (mode === 'properties') {
        svg += renderPropertyMode(profiles, width, height, theme, tooltipMode);
    } else if (mode === 'thumbnail') {
        svg += renderThumbnailMode(profiles, width, height, theme, tooltipMode);
    }

    svg += `</svg>`;
    return svg;
}

function renderThumbnailMode(profiles: SoilProfileCollection, width: number, height: number, theme: any, tooltipMode: string): string {
    const padding = 5;
    const maxDepth = profiles.getMaxDepth() || 100;
    const depthScale = (height - padding * 2) / maxDepth;
    const profileCount = Math.max(1, profiles.profiles.length);
    const profileWidth = (width - padding * 2) / profileCount;
    const showTitle = shouldRenderTitle(tooltipMode);

    let svg = '';

    profiles.profiles.forEach((profile, i) => {
        const xOffset = padding + (i * profileWidth);

        profile.horizons.forEach((horizon, hIdx) => {
            const hTop = padding + (horizon.top * depthScale);
            const hHeight = (horizon.bottom - horizon.top) * depthScale;
            const horizonId = generateHorizonId(profile.id, horizon.name, hIdx);

            let color = sanitizeColor(horizon.color);
            if (horizon.clay !== undefined) {
                color = getTextureColor(classifyTexture(horizon));
            } else {
                const munsellColor = munsellToHex(horizon.munsellHue, horizon.munsellValue, horizon.munsellChroma);
                color = resolveHorizonColor(munsellColor, color);
            }
            const textColor = getTextColorForBackground(color);

            const horizonData = escapeSvgAttribute(serializeHorizonData(horizon));
            svg += `<rect x="${xOffset}" y="${hTop}" width="${profileWidth}" height="${hHeight}" fill="${escapeSvgAttribute(color)}" stroke="none" data-horizon-id="${horizonId}" data-horizon-properties="${horizonData}">`;
            if (showTitle) {
              svg += `<title>${escapeSvgText(`${horizon.name} (${horizon.top}-${horizon.bottom}cm)`)}</title>`;
            }
            svg += `</rect>`;

            // Labels inside, only if there's space
            if (hHeight > 8) {
                const fontSize = Math.min(24, Math.floor(hHeight * 0.8));
                svg += `<text x="${xOffset + profileWidth / 2}" y="${hTop + hHeight / 2}" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="middle" pointer-events="none">${escapeSvgText(horizon.name)}</text>`;
            }
        });
    });

    return svg;
}

function renderDepthMode(profiles: SoilProfileCollection, width: number, height: number, theme: any, tooltipMode: string): string {
    const padding = 40;
    const maxDepth = profiles.getMaxDepth() || 100;
    const depthScale = (height - padding * 2) / maxDepth;
    const profileWidth = Math.max(20, (width - padding * 2) / Math.max(1, profiles.profiles.length) - 20);
    const showTitle = shouldRenderTitle(tooltipMode);

    let svg = '';

    // Draw depth scale
    svg += drawDepthScale(padding, maxDepth, depthScale, width, height, theme);

    profiles.profiles.forEach((profile, i) => {
        const xOffset = padding + (i * (profileWidth + 20));

        // Profile ID text
        svg += `<text x="${xOffset + profileWidth / 2}" y="${padding - 10}" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="${theme.textColor}">${escapeSvgText(profile.id)}</text>`;

        profile.horizons.forEach((horizon, hIdx) => {
            const hTop = padding + (horizon.top * depthScale);
            const hHeight = (horizon.bottom - horizon.top) * depthScale;
            const horizonId = generateHorizonId(profile.id, horizon.name, hIdx);

            // Determine color: texture > munsell > fallback
            let color = sanitizeColor(horizon.color);
            if (horizon.clay !== undefined) {
                const textureClass = classifyTexture(horizon);
                color = getTextureColor(textureClass);
            } else {
                const munsellColor = munsellToHex(horizon.munsellHue, horizon.munsellValue, horizon.munsellChroma);
                color = resolveHorizonColor(munsellColor, color);
            }

            const textColor = getTextColorForBackground(color);
            const horizonData = escapeSvgAttribute(serializeHorizonData(horizon));

            svg += `<rect x="${xOffset}" y="${hTop}" width="${profileWidth}" height="${hHeight}" fill="${escapeSvgAttribute(color)}" stroke="#333" stroke-width="1" data-horizon-id="${horizonId}" data-horizon-properties="${horizonData}">`;
            if (showTitle) {
              svg += `<title>${escapeSvgText(`${horizon.name} (${horizon.top}-${horizon.bottom}cm)`)}</title>`;
            }
            svg += `</rect>`;

            if (hHeight > 15) {
                svg += `<text x="${xOffset + 5}" y="${hTop + 12}" font-family="Arial" font-size="10" font-weight="bold" fill="${textColor}">${escapeSvgText(horizon.name)}</text>`;
            }
        });
    });

    return svg;
}

function renderTextureMode(profiles: SoilProfileCollection, width: number, height: number, theme: any, tooltipMode: string): string {
    const padding = 40;
    const maxDepth = profiles.getMaxDepth() || 100;
    const depthScale = (height - padding * 2) / maxDepth;
    const showTitle = shouldRenderTitle(tooltipMode);

    // For simplicity in static multi-profile texture mode, we'll just stack them or show the first one if too many
    // In soillite it was mostly single-profile.
    const profile = profiles.profiles[0];
    const marginLeft = 60;
    const marginRight = 20;
    const usableWidth = width - marginLeft - marginRight;

    let svg = '';
    svg += drawDepthScale(marginLeft, maxDepth, depthScale, width, height, theme);

    // Title
    svg += `<text x="${width / 2}" y="${padding / 2}" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="${theme.textColor}">${escapeSvgText(profile.id)} - Texture</text>`;

    // Define texture axes
    const clayAxis = { label: 'Clay %', color: '#d4a574', x: marginLeft + usableWidth * 0.2 };
    const sandAxis = { label: 'Sand %', color: '#c2b280', x: marginLeft + usableWidth * 0.5 };
    const siltAxis = { label: 'Silt %', color: '#a89968', x: marginLeft + usableWidth * 0.8 };

    [clayAxis, sandAxis, siltAxis].forEach(axis => {
        svg += `<text x="${axis.x}" y="${padding - 10}" text-anchor="middle" font-family="Arial" font-size="11" font-weight="600" fill="${theme.textColor}">${escapeSvgText(axis.label)}</text>`;
    });

    profile.horizons.forEach((hz, hIdx) => {
        const depth = (hz.top + hz.bottom) / 2;
        const y = padding + depth * depthScale;
        const horizonId = generateHorizonId(profile.id, hz.name, hIdx);
        const horizonData = escapeSvgAttribute(serializeHorizonData(hz));

        const clay = hz.clay ?? 0;
        const sand = hz.sand ?? 0;
        const silt = hz.silt ?? Math.max(0, 100 - clay - sand);

        const xClay = clayAxis.x + (clay / 100) * 40 - 20;
        const xSand = sandAxis.x + (sand / 100) * 40 - 20;
        const xSilt = siltAxis.x + (silt / 100) * 40 - 20;

        [
            { x: xClay, color: clayAxis.color, val: clay },
            { x: xSand, color: sandAxis.color, val: sand },
            { x: xSilt, color: siltAxis.color, val: silt }
        ].forEach(point => {
            svg += `<circle cx="${point.x}" cy="${y}" r="4" fill="${point.color}" stroke="#333" stroke-width="0.5" data-horizon-id="${horizonId}" data-horizon-properties="${horizonData}">`;
            if (showTitle) {
              svg += `<title>${point.val.toFixed(1)}%</title>`;
            }
            svg += `</circle>`;
        });
    });

    return svg;
}

function renderPropertyMode(profiles: SoilProfileCollection, width: number, height: number, theme: any, tooltipMode: string): string {
    const padding = 40;
    const maxDepth = profiles.getMaxDepth() || 100;
    const depthScale = (height - padding * 2) / maxDepth;
    const profile = profiles.profiles[0];
    const marginLeft = 60;
    const showTitle = shouldRenderTitle(tooltipMode);

    let svg = '';
    svg += drawDepthScale(marginLeft, maxDepth, depthScale, width, height, theme);

    // Title
    svg += `<text x="${width / 2}" y="${padding / 2}" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="${theme.textColor}">${escapeSvgText(profile.id)} - pH Profile</text>`;

    const phMin = 4;
    const phRange = 4; // 4-8
    const barMaxWidth = 100;

    profile.horizons.forEach((hz, hIdx) => {
        const y1 = padding + hz.top * depthScale;
        const y2 = padding + hz.bottom * depthScale;
        const horizonId = generateHorizonId(profile.id, hz.name, hIdx);
        const horizonData = escapeSvgAttribute(serializeHorizonData(hz));

        if (hz.ph !== undefined) {
            const pH = hz.ph;
            const offset = ((clampPh(pH) - phMin) / phRange) * barMaxWidth;
            const color = getPhColor(pH);
            const textColor = theme.textColor;

            svg += `<rect x="${marginLeft + 20}" y="${y1}" width="${offset}" height="${y2 - y1}" fill="${color}" opacity="0.7" stroke="${theme.textColor}" stroke-width="1" data-horizon-id="${horizonId}" data-horizon-properties="${horizonData}">`;
            if (showTitle) {
              svg += `<title>pH: ${pH}</title>`;
            }
            svg += `</rect>`;

            svg += `<text x="${marginLeft + 20 + offset + 5}" y="${(y1 + y2) / 2 + 4}" font-family="Arial" font-size="10" font-weight="bold" fill="${textColor}">${pH.toFixed(1)}</text>`;
        }
    });

    // pH Scale at bottom
    const axisY = height - 20;
    for (let ph = phMin; ph <= phMin + phRange; ph++) {
        const x = marginLeft + 20 + ((ph - phMin) / phRange) * barMaxWidth;
        svg += `<line x1="${x}" y1="${axisY - 3}" x2="${x}" y2="${axisY + 3}" stroke="${theme.textColor}" stroke-width="1" />`;
        svg += `<text x="${x}" y="${axisY + 12}" text-anchor="middle" font-family="Arial" font-size="10" fill="${theme.textColor}">${ph}</text>`;
    }
    svg += `<text x="${marginLeft + 20 + barMaxWidth / 2}" y="${axisY + 25}" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="${theme.textColor}">Soil pH</text>`;

    return svg;
}

function drawDepthScale(marginLeft: number, maxDepth: number, depthScale: number, width: number, height: number, theme: any): string {
    let svg = '';
    const marginTop = 40;

    for (let d = 0; d <= maxDepth; d += 20) {
        const y = marginTop + d * depthScale;
        
        // Grid line
        svg += `<line x1="${marginLeft}" y1="${y}" x2="${width - 20}" y2="${y}" stroke="${theme.gridColor}" stroke-width="0.5" opacity="0.3" />`;
        
        // Tick
        svg += `<line x1="${marginLeft - 5}" y1="${y}" x2="${marginLeft}" y2="${y}" stroke="${theme.textColor}" stroke-width="1" />`;
        
        // Label
        svg += `<text x="${marginLeft - 8}" y="${y + 4}" text-anchor="end" font-family="Arial" font-size="10" fill="${theme.textColor}">${d}</text>`;
    }

    // Y-axis label
    svg += `<text x="15" y="${height / 2}" transform="rotate(-90 15 ${height / 2})" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="${theme.textColor}">Depth (cm)</text>`;

    return svg;
}

export function renderStaticToDataURL(profiles: SoilProfileCollection, options: StaticRenderOptions): string {
    const svg = renderStaticSVG(profiles, options);
    // Convert SVG to data URI (base64)
    return 'data:image/svg+xml;base64,' + (typeof Buffer !== 'undefined' ? Buffer.from(svg).toString('base64') : btoa(svg));
}

export function renderStaticToDOM(container: HTMLElement, profiles: SoilProfileCollection, options: StaticRenderOptions): void {
    const svg = renderStaticSVG(profiles, options);
    container.innerHTML = svg;

    if (options.onHorizonClick || options.onHorizonHover) {
        attachHorizonEventListeners(container, profiles, options);
    }
}

function attachHorizonEventListeners(container: HTMLElement, profiles: SoilProfileCollection, options: StaticRenderOptions): void {
    const elements = container.querySelectorAll('[data-horizon-properties]');

    elements.forEach(element => {
        if (!(element instanceof SVGElement)) return;

        const horizonId = element.getAttribute('data-horizon-id');
        const horizonDataStr = element.getAttribute('data-horizon-properties');

        if (!horizonId || !horizonDataStr) return;

        try {
            const horizon = JSON.parse(horizonDataStr);
            const [profileId] = horizonId.split('_');

            if (options.onHorizonClick) {
                element.addEventListener('click', (event) => {
                    const rect = (element as SVGElement).getBoundingClientRect();
                    options.onHorizonClick!({
                        horizonId,
                        profileId,
                        horizon,
                        event: event as MouseEvent,
                        position: { x: event.clientX - rect.left, y: event.clientY - rect.top }
                    });
                });
            }

            if (options.onHorizonHover) {
                element.addEventListener('mouseenter', (event) => {
                    const rect = (element as SVGElement).getBoundingClientRect();
                    options.onHorizonHover!({
                        horizonId,
                        profileId,
                        horizon,
                        event: event as MouseEvent,
                        position: { x: event.clientX - rect.left, y: event.clientY - rect.top }
                    });
                });
            }
        } catch {
            // Skip elements with invalid JSON
        }
    });
}
