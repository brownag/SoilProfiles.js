import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { ComparisonRenderOptions } from '../core/types';
import { isDarkMode, THEMES, getTextColorForBackground, resolveHorizonColor } from '../core/colors';
import { classifyTexture, getTextureColor } from '../core/texture';
import { getPhColor } from '../core/phScale';
import { stackLabels } from '../core/layout';
import { escapeSvgText, escapeSvgAttribute, sanitizeColor, generateHorizonId, serializeHorizonData, getSafeProfileId } from './safety';
import { munsellToHex } from '../core/munsell';
import { renderAnnotationsSVG, renderAnnotationLegendSVG } from './annotations';
import { renderTextureLegendSVG, renderPhLegendSVG, getThematicLegendMetadata } from './thematicLegends';

function shouldRenderTitle(tooltipMode: string): boolean {
  return tooltipMode === 'native' || tooltipMode === undefined;
}

/**
 * Renders a side-by-side comparison into a DOM container.
 * In a browser environment, this will use renderComparisonHTML to set the innerHTML.
 */
/**
 * Renders a side-by-side comparison as a single, self-contained SVG string.
 * This is ideal for exports (SVG, PNG) and printing.
 */
export function renderComparisonSVG(profiles: SoilProfileCollection, options: ComparisonRenderOptions): string {
    const isDark = isDarkMode();
    const theme = isDark ? THEMES.dark : THEMES.light;
    const tooltipMode = options.tooltips?.mode ?? 'native';
    const showTitle = shouldRenderTitle(tooltipMode);

    const profileWidth = options.profileWidth ?? 80;
    const annotationWidth = options.annotations?.enabled && options.annotations?.position !== 'overlay' 
        ? (options.annotations.width ?? 60) 
        : 55;
    const columnWidth = profileWidth + annotationWidth;
    const marginTop = 40;
    const marginBottom = options.annotations?.enabled && options.annotations?.showLegend !== false ? 60 : 40;
    const axisWidth = 60;
    const mode = options.mode ?? 'depth';

    const profileHeight = options.height ?? 400;
    const maxDepth = profiles.getMaxDepth() || 100;
    const depthScale = (profileHeight - marginTop - marginBottom) / maxDepth;
    
    const totalWidth = axisWidth + (profiles.profiles.length * columnWidth);
    const totalHeight = profileHeight;

    let svg = `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="background:${theme.bgColor};">`;
    
    // Background
    svg += `<rect width="${totalWidth}" height="${totalHeight}" fill="${theme.bgColor}" />`;

    // Shared depth axis
    svg += `<g transform="translate(0, 0)">`;
    for (let d = 0; d <= maxDepth; d += 20) {
        const y = marginTop + d * depthScale;
        svg += `<line x1="${axisWidth - 15}" y1="${y}" x2="${axisWidth - 5}" y2="${y}" stroke="${theme.textColor}" stroke-width="1" />`;
        svg += `<text x="${axisWidth - 20}" y="${y}" text-anchor="end" dominant-baseline="middle" font-family="Arial" font-size="10" fill="${theme.textColor}">${d}</text>`;
    }
    // Y-axis label
    svg += `<text x="15" y="${totalHeight / 2}" transform="rotate(-90 15 ${totalHeight / 2})" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="${theme.textColor}">Depth (cm)</text>`;
    svg += `</g>`;

    // Profiles
    profiles.profiles.forEach((profile, i) => {
        const xOffset = axisWidth + (i * columnWidth);
        svg += `<g transform="translate(${xOffset}, 0)">`;

        // Profile ID
        svg += `<text x="${profileWidth / 2}" y="${marginTop - 15}" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="${theme.textColor}">${escapeSvgText(profile.id)}</text>`;

        const thinHorizons: any[] = [];

        profile.horizons.forEach((hz, hIdx) => {
            const y1 = marginTop + hz.top * depthScale;
            const y2 = marginTop + hz.bottom * depthScale;
            const hHeight = y2 - y1;
            const horizonId = generateHorizonId(profile.id, hz.name, hIdx);
            const horizonData = escapeSvgAttribute(serializeHorizonData(hz));
            const profileIdAttr = escapeSvgAttribute(getSafeProfileId(profile.id));

            let color = sanitizeColor(hz.color);
            if (mode === 'properties' && hz.ph !== undefined) {
                color = getPhColor(hz.ph);
            } else if (mode === 'texture' && hz.clay !== undefined) {
                color = getTextureColor(classifyTexture(hz));
            } else {
                const munsellColor = munsellToHex(hz.munsellHue, hz.munsellValue, hz.munsellChroma);
                color = resolveHorizonColor(munsellColor, color);
            }

            svg += `<rect x="0" y="${y1}" width="${profileWidth}" height="${Math.max(hHeight, 1)}" fill="${color}" stroke="#333" stroke-width="0.5" data-profile-id="${profileIdAttr}" data-horizon-id="${horizonId}" data-horizon-properties="${horizonData}">`;
            if (showTitle) {
              svg += `<title>${escapeSvgText(hz.name)}</title>`;
            }
            svg += `</rect>`;

            if (hHeight > 12) {
                svg += `<text x="${profileWidth / 2}" y="${y1 + hHeight / 2}" font-family="Arial" font-size="8" font-weight="bold" fill="${getTextColorForBackground(color)}" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(hz.name)}</text>`;
            } else {
                thinHorizons.push({ hz, yCenter: y1 + hHeight / 2 });
            }
        });

        if (thinHorizons.length > 0) {
            const yPositions = thinHorizons.map(t => t.yCenter);
            const stackedY = stackLabels(yPositions, 11);
            thinHorizons.forEach((t, i) => {
                svg += `<line x1="${profileWidth}" y1="${t.yCenter}" x2="${profileWidth + 8}" y2="${stackedY[i]}" stroke="${theme.dimColor}" stroke-width="0.5" />`;
                svg += `<text x="${profileWidth + 10}" y="${stackedY[i]}" font-family="Arial" font-size="8" fill="${theme.textColor}" dominant-baseline="middle">${escapeSvgText(t.hz.name)}</text>`;
            });
        }

        // Add annotations
        if (options.annotations?.enabled) {
            svg += renderAnnotationsSVG(profile, 0, profileWidth, marginTop, depthScale, options.annotations, theme);
        }

        svg += `</g>`;
    });

    if (options.annotations?.enabled && options.annotations?.showLegend !== false) {
        svg += renderAnnotationLegendSVG(profiles, axisWidth, totalHeight - 35, theme);
    }

    // Render thematic legend based on mode
    if (mode === 'texture') {
        svg += renderTextureLegendSVG(axisWidth, totalHeight - 35, theme);
    } else if (mode === 'properties') {
        svg += renderPhLegendSVG(axisWidth, totalHeight - 35, theme);
    }

    svg += `</svg>`;
    return svg;
}

export function renderComparison(container: HTMLElement, profiles: SoilProfileCollection, options: ComparisonRenderOptions): void {
    const html = renderComparisonHTML(profiles, options);
    container.innerHTML = html;

    if (options.onHorizonClick || options.onHorizonHover) {
        attachHorizonEventListeners(container, profiles, options);
    }
}

function attachHorizonEventListeners(container: HTMLElement, profiles: SoilProfileCollection, options: ComparisonRenderOptions): void {
    const elements = container.querySelectorAll('[data-horizon-properties]');
    let skippedCount = 0;

    elements.forEach(element => {
        if (!(element instanceof SVGElement)) return;

        const horizonId = element.getAttribute('data-horizon-id');
        const horizonDataStr = element.getAttribute('data-horizon-properties');
        const profileId = element.getAttribute('data-profile-id');

        if (!horizonId || !horizonDataStr || !profileId) {
            skippedCount++;
            return;
        }

        try {
            const horizon = JSON.parse(horizonDataStr);

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

    if (skippedCount > 0) {
        console.warn(`SoilProfiles: ${skippedCount} horizon element(s) were skipped because they were missing required data-profile-id, data-horizon-id, or data-horizon-properties attributes. This may indicate an SVG was generated with an older version or by external code.`);
    }
}

export function renderComparisonToDataURL(profiles: SoilProfileCollection, options: ComparisonRenderOptions): string {
    const svg = renderComparisonSVG(profiles, options);
    return 'data:image/svg+xml;base64,' + (typeof Buffer !== 'undefined' ? Buffer.from(svg).toString('base64') : btoa(svg));
}

/**
 * Renders a side-by-side comparison as an SSR-friendly HTML string.
 */
export function renderComparisonHTML(profiles: SoilProfileCollection, options: ComparisonRenderOptions): string {
    const isDark = isDarkMode();
    const theme = isDark ? THEMES.dark : THEMES.light;
    
    const profileWidth = options.profileWidth ?? 80;
    const annotationWidth = options.annotations?.enabled && options.annotations?.position !== 'overlay' 
        ? (options.annotations.width ?? 60) 
        : 55;
    const columnWidth = profileWidth + annotationWidth;
    const marginTop = 20;
    const marginBottom = options.annotations?.enabled && options.annotations?.showLegend !== false ? 60 : 40;
    const axisWidth = 50;
    const mode = options.mode ?? 'depth';

    const profileHeight = options.height ?? 400;
    const maxDepth = profiles.getMaxDepth() || 100;
    const depthScale = (profileHeight - marginTop - marginBottom) / maxDepth;
    
    const centered = options.centered !== false;
    const profileMaxWidth = options.profileMaxWidth;

    let html = `<div style="display:flex; flex-direction:column; width:100%; height:${profileHeight}px; background:${theme.bgColor}; overflow-y:auto;">`;
    html += `<div style="display:flex; flex:1;">`;

    // Left: Shared depth axis
    html += `<div style="flex:0 0 ${axisWidth}px; border-right:1px solid ${theme.gridColor}; position:relative;">`;
    html += `<svg viewBox="0 0 ${axisWidth} ${profileHeight}" style="width:100%; height:${profileHeight}px; margin-top:18px;">`;
    
    for (let d = 0; d <= maxDepth; d += 20) {
        const y = marginTop + d * depthScale;
        html += `<line x1="35" y1="${y}" x2="45" y2="${y}" stroke="${theme.textColor}" />`;
        html += `<text x="30" y="${y + 3}" text-anchor="end" font-size="10px" fill="${theme.textColor}">${d}</text>`;
    }
    
    html += `</svg>`;
    html += `<div style="position:absolute; left:5px; top:50%; transform:translateY(-50%) rotateZ(-90deg); transform-origin:left center; font-size:11px; font-weight:bold; color:${theme.textColor}; white-space:nowrap;">Depth (cm)</div>`;
    html += `</div>`;

    // Right: Scrollable profiles
    let profilesContainerStyle = `flex:1; overflow-x:auto; display:flex; background:${theme.bgColor};`;
    if (centered) {
        profilesContainerStyle += `justify-content:center;`;
    }

    html += `<div style="${profilesContainerStyle}">`;

    profiles.profiles.forEach(profile => {
        let colStyle = `flex:0 0 ${columnWidth}px; position:relative;`;
        if (profileMaxWidth) {
            colStyle += `max-width:${profileMaxWidth}px;`;
        }
        html += `<div style="${colStyle}">`;
        html += `<div style="position:absolute; top:2px; left:0; width:${profileWidth}px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:10px; font-weight:bold; text-align:center; color:${theme.textColor}; z-index:10; background:${theme.bgColor};">${escapeSvgText(profile.id)}</div>`;

        html += `<svg viewBox="0 0 ${columnWidth} ${profileHeight}" style="width:100%; height:${profileHeight}px; margin-top:18px;">`;
        
        const thinHorizons: any[] = [];

        profile.horizons.forEach((hz, idx) => {
            const y1 = marginTop + hz.top * depthScale;
            const y2 = marginTop + hz.bottom * depthScale;
            const hHeight = y2 - y1;
            const horizonId = generateHorizonId(profile.id, hz.name, idx);
            const horizonData = escapeSvgAttribute(serializeHorizonData(hz));
            const profileIdAttr = escapeSvgAttribute(getSafeProfileId(profile.id));

            let color = sanitizeColor(hz.color);
            if (mode === 'properties' && hz.ph !== undefined) {
                color = getPhColor(hz.ph);
            } else if (mode === 'texture' && hz.clay !== undefined) {
                color = getTextureColor(classifyTexture(hz));
            } else {
                const munsellColor = munsellToHex(hz.munsellHue, hz.munsellValue, hz.munsellChroma);
                color = resolveHorizonColor(munsellColor, color);
            }

            html += `<rect x="0" y="${y1}" width="${profileWidth}" height="${Math.max(hHeight, 1)}" fill="${color}" stroke="#333" stroke-width="0.5" data-profile-id="${profileIdAttr}" data-horizon-id="${horizonId}" data-horizon-properties="${horizonData}">`;
            html += `<title>${escapeSvgText(`${hz.name} (${hz.top}-${hz.bottom}cm)`)}</title>`;
            html += `</rect>`;

            if (hHeight > 12) {
                html += `<text x="${profileWidth / 2}" y="${y1 + hHeight / 2}" font-size="8px" font-weight="bold" fill="${getTextColorForBackground(color)}" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(hz.name)}</text>`;
            } else {
                thinHorizons.push({ hz, yCenter: y1 + hHeight / 2 });
            }
        });

        if (thinHorizons.length > 0) {
            const yPositions = thinHorizons.map(t => t.yCenter);
            const stackedY = stackLabels(yPositions, 11);
            thinHorizons.forEach((t, i) => {
                html += `<line x1="${profileWidth}" y1="${t.yCenter}" x2="${profileWidth + 8}" y2="${stackedY[i]}" stroke="${theme.dimColor}" stroke-width="0.5" />`;
                html += `<text x="${profileWidth + 10}" y="${stackedY[i] + 3}" font-size="8px" fill="${theme.textColor}">${escapeSvgText(t.hz.name)}</text>`;
            });
        }

        // Add annotations
        if (options.annotations?.enabled) {
            html += renderAnnotationsSVG(profile, 0, profileWidth, marginTop, depthScale, options.annotations, theme);
        }

        html += `</svg></div>`;
    });

    html += `</div></div>`;

    if (options.annotations?.enabled && options.annotations?.showLegend !== false) {
        html += `<div style="flex:0 0 40px; border-top:1px solid ${theme.gridColor}; padding:5px 10px;">`;
        html += `<svg width="100%" height="35">`;
        html += renderAnnotationLegendSVG(profiles, 0, 15, theme);
        html += `</svg></div>`;
    }

    // Render thematic legend based on mode
    if (mode === 'texture' || mode === 'properties') {
        const legendMeta = getThematicLegendMetadata(mode);
        const legendCols = mode === 'texture' ? 4 : 3;
        const numRows = legendMeta ? Math.ceil(legendMeta.items.length / legendCols) : 2;
        const legendSvgHeight = numRows * 15 + 25;
        const legendDivHeight = legendSvgHeight + 15;
        html += `<div style="flex:0 0 ${legendDivHeight}px; border-top:1px solid ${theme.gridColor}; padding:5px 10px;">`;
        html += `<svg width="100%" height="${legendSvgHeight}">`;
        if (mode === 'texture') {
            html += renderTextureLegendSVG(0, 15, theme);
        } else if (mode === 'properties') {
            html += renderPhLegendSVG(0, 15, theme);
        }
        html += `</svg></div>`;
    }

    html += `</div>`;
    return html;
}
