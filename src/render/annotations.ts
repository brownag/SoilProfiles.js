import { SoilProfile } from '../core/SoilProfile';
import { SoilProfileCollection } from '../core/SoilProfileCollection';
import { RenderAnnotationsOptions } from '../core/types';
import { escapeSvgText } from './safety';

export function renderAnnotationsSVG(
    profile: SoilProfile,
    xOffset: number,
    profileWidth: number,
    padding: number,
    depthScale: number,
    options: RenderAnnotationsOptions,
    theme: any
): string {
    if (!options.enabled || !profile.depthAnnotations || profile.depthAnnotations.length === 0) {
        return '';
    }

    let svg = '';
    const annotationWidth = options.width || 60;
    const fontSize = options.labelFontSize || 10;
    const isOverlay = options.position === 'overlay';

    profile.depthAnnotations.forEach(ann => {
        let top: number;
        let bottom: number;
        let type = ann.type;

        if (Array.isArray(ann.depth)) {
            top = ann.depth[0];
            bottom = ann.depth[1];
            if (!type) type = 'zone';
        } else {
            top = ann.depth;
            bottom = ann.depth;
            if (!type) type = 'line';
        }

        const yTop = padding + top * depthScale;
        const yBottom = padding + bottom * depthScale;
        const color = ann.color || (theme.isDark ? '#aaa' : '#666');
        const opacity = ann.opacity ?? 0.3;

        const x = isOverlay ? xOffset : xOffset + profileWidth + 5;
        const width = isOverlay ? profileWidth : annotationWidth;

        if (type === 'zone') {
            svg += `<rect x="${x}" y="${yTop}" width="${width}" height="${Math.max(yBottom - yTop, 1)}" fill="${color}" opacity="${opacity}" stroke="${color}" stroke-width="0.5" />`;
            // Label for zone
            svg += `<text x="${x + 2}" y="${yTop + (yBottom - yTop) / 2}" font-family="Arial" font-size="${fontSize}" fill="${theme.textColor}" dominant-baseline="middle">${escapeSvgText(ann.label)}</text>`;
        } else {
            // Line or marker
            svg += `<line x1="${x}" y1="${yTop}" x2="${x + width}" y2="${yTop}" stroke="${color}" stroke-width="2" />`;
            // Label for line
            const textX = isOverlay ? x + 2 : x + width + 2;
            svg += `<text x="${textX}" y="${yTop - 2}" font-family="Arial" font-size="${fontSize}" fill="${theme.textColor}">${escapeSvgText(ann.label)}</text>`;
        }
    });

    return svg;
}

export function renderAnnotationLegendSVG(profiles: SoilProfileCollection, x: number, y: number, theme: any): string {
    const uniqueAnnotations = new Map<string, { color: string; type: string }>();
    
    profiles.profiles.forEach(p => {
        p.depthAnnotations.forEach(ann => {
            if (!uniqueAnnotations.has(ann.label)) {
                uniqueAnnotations.set(ann.label, { 
                    color: ann.color || (theme.isDark ? '#aaa' : '#666'),
                    type: ann.type || (Array.isArray(ann.depth) ? 'zone' : 'line')
                });
            }
        });
    });

    if (uniqueAnnotations.size === 0) return '';

    let svg = `<g transform="translate(${x}, ${y})">`;
    svg += `<text x="0" y="0" font-family="Arial" font-size="11" font-weight="bold" fill="${theme.textColor}">Legend:</text>`;

    let idx = 0;
    const itemHeight = 15;
    const itemWidth = 120;
    const cols = 3;

    uniqueAnnotations.forEach((val, label) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const lx = col * itemWidth;
        const ly = 15 + row * itemHeight;

        if (val.type === 'zone') {
            svg += `<rect x="${lx}" y="${ly - 8}" width="10" height="10" fill="${val.color}" opacity="0.4" stroke="${val.color}" stroke-width="0.5" />`;
        } else {
            svg += `<line x1="${lx}" y1="${ly - 3}" x2="${lx + 10}" y2="${ly - 3}" stroke="${val.color}" stroke-width="2" />`;
        }
        svg += `<text x="${lx + 15}" y="${ly}" font-family="Arial" font-size="10" fill="${theme.textColor}">${escapeSvgText(label)}</text>`;
        idx++;
    });

    svg += `</g>`;
    return svg;
}
