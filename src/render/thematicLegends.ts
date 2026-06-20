import { classifyTexture, textureCodeToName, getTextureColor } from '../core/texture';
import { escapeSvgText } from './safety';

/**
 * Returns thematic legend metadata for the given rendering mode.
 * Decouples legend data structure from SVG rendering for reuse in multiple paths.
 *
 * @param mode Rendering mode ('depth', 'texture', or 'properties')
 * @returns Legend data structure with title and items, or null for modes that don't use legends
 */
export function getThematicLegendMetadata(mode: string): {
    title: string;
    items: Array<{ color: string; label: string; code?: string }>;
} | null {
    if (mode === 'depth') {
        return null; // Depth mode uses Munsell colors, no thematic legend
    }

    if (mode === 'texture') {
        const textureCodes = ['s', 'ls', 'sl', 'l', 'sil', 'si', 'scl', 'sc', 'cl', 'sicl', 'sic', 'c'];
        return {
            title: 'Texture Classes',
            items: textureCodes.map(code => ({
                code,
                color: getTextureColor(code),
                label: textureCodeToName(code)
            }))
        };
    }

    if (mode === 'properties') {
        return {
            title: 'pH Categories',
            items: [
                { color: '#d73027', label: '< 5.0 (Very Acidic)' },
                { color: '#fc8d59', label: '5.0–6.0 (Acidic)' },
                { color: '#fee090', label: '6.0–7.0 (Neutral)' },
                { color: '#91bfdb', label: '7.0–8.0 (Alkaline)' },
                { color: '#4575b4', label: '> 8.0 (Very Alkaline)' }
            ]
        };
    }

    return null;
}

/**
 * Renders an SVG legend for USDA soil texture classes.
 * Displays all 12 texture classes in natural order with color swatches.
 *
 * @param x Starting X coordinate for legend
 * @param y Starting Y coordinate for legend
 * @param theme Theme object with textColor and other styling properties
 * @returns SVG string representing the texture legend
 */
export function renderTextureLegendSVG(x: number, y: number, theme: any): string {
    if (!theme || !theme.textColor) {
        return '';
    }

    const metadata = getThematicLegendMetadata('texture');
    if (!metadata) {
        return '';
    }

    let svg = `<g transform="translate(${x}, ${y})">`;
    svg += `<text x="0" y="0" font-family="Arial" font-size="11" font-weight="bold" fill="${theme.textColor}">Legend: ${escapeSvgText(metadata.title)}</text>`;

    const fontSize = 10;
    const itemHeight = 15;
    const itemWidth = 140; // Wider to accommodate longer texture names
    const cols = 4;

    metadata.items.forEach((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const itemX = col * itemWidth;
        const itemY = 15 + row * itemHeight;

        // Color swatch
        svg += `<rect x="${itemX}" y="${itemY - 8}" width="10" height="10" fill="${item.color}" stroke="${item.color}" stroke-width="0.5" />`;

        // Label text: code (name) format
        const label = item.code ? `${item.code}: ${item.label}` : item.label;
        svg += `<text x="${itemX + 15}" y="${itemY}" font-family="Arial" font-size="${fontSize}" fill="${theme.textColor}">${escapeSvgText(label)}</text>`;
    });

    svg += `</g>`;
    return svg;
}

/**
 * Renders an SVG legend for soil pH categories.
 * Displays 5 pH ranges with color swatches representing acidic to alkaline.
 *
 * @param x Starting X coordinate for legend
 * @param y Starting Y coordinate for legend
 * @param theme Theme object with textColor and other styling properties
 * @returns SVG string representing the pH legend
 */
export function renderPhLegendSVG(x: number, y: number, theme: any): string {
    if (!theme || !theme.textColor) {
        return '';
    }

    const metadata = getThematicLegendMetadata('properties');
    if (!metadata) {
        return '';
    }

    let svg = `<g transform="translate(${x}, ${y})">`;
    svg += `<text x="0" y="0" font-family="Arial" font-size="11" font-weight="bold" fill="${theme.textColor}">Legend: ${escapeSvgText(metadata.title)}</text>`;

    const fontSize = 10;
    const itemHeight = 15;
    const itemWidth = 170; // Slightly wider for pH labels
    const cols = 3;

    metadata.items.forEach((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const itemX = col * itemWidth;
        const itemY = 15 + row * itemHeight;

        // Color swatch
        svg += `<rect x="${itemX}" y="${itemY - 8}" width="10" height="10" fill="${item.color}" stroke="${item.color}" stroke-width="0.5" />`;

        // Label text
        svg += `<text x="${itemX + 15}" y="${itemY}" font-family="Arial" font-size="${fontSize}" fill="${theme.textColor}">${escapeSvgText(item.label)}</text>`;
    });

    svg += `</g>`;
    return svg;
}
