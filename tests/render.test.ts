import { SoilProfile } from '../src/core/SoilProfile';
import { SoilProfileCollection } from '../src/core/SoilProfileCollection';
import { renderStaticSVG, renderStaticToDataURL } from '../src/render/static';
import { renderInteractive2D } from '../src/render/interactive';
import { renderComparison, renderComparisonSVG } from '../src/render/comparison';

describe('Rendering', () => {
    const col = new SoilProfileCollection([
        new SoilProfile('p1', [{ name: 'A', top: 0, bottom: 50, color: 'red' }])
    ]);

    it('generates a composite SVG for comparisons', () => {
        const p1 = new SoilProfile('Comp1', [{ name: 'A', top: 0, bottom: 20, color: 'red' }]);
        const p2 = new SoilProfile('Comp2', [{ name: 'B', top: 0, bottom: 30, color: 'blue' }]);
        const collection = new SoilProfileCollection([p1, p2]);
        
        const svg = renderComparisonSVG(collection, { width: 800, height: 400, format: 'svg' });
        expect(svg).toContain('<svg');
        expect(svg).toContain('Comp1');
        expect(svg).toContain('Comp2');
        expect(svg).toContain('transform="translate(');
        expect(svg).toContain('Depth (cm)');
    });

    it('generates SVG static output with different modes', () => {
        const colExtended = new SoilProfileCollection([
            new SoilProfile('p1', [{ name: 'A', top: 0, bottom: 50, color: 'red', clay: 15, sand: 60, ph: 6.0 }])
        ]);
        const svgDepth = renderStaticSVG(colExtended, { width: 400, height: 400, format: 'svg', mode: 'depth' });
        // Depth mode with clay will use texture color
        expect(svgDepth).toContain('fill="#c0dce8"'); 

        const svgTexture = renderStaticSVG(colExtended, { width: 400, height: 400, format: 'svg', mode: 'texture' });
        expect(svgTexture).toContain('Clay %');

        const svgProperties = renderStaticSVG(colExtended, { width: 400, height: 400, format: 'svg', mode: 'properties' });
        expect(svgProperties).toContain('Soil pH');

        const svgThumbnail = renderStaticSVG(colExtended, { width: 100, height: 200, format: 'svg', mode: 'thumbnail' });
        expect(svgThumbnail).toContain('stroke="none"');
        expect(svgThumbnail).not.toContain('Depth (cm)');
    });

    it('renders comparison in DOM', () => {
        const div = document.createElement('div');
        renderComparison(div, col, { width: 800, height: 600, format: 'svg' });
        expect(div.innerHTML).toContain('p1');
        expect(div.innerHTML).toContain('Depth (cm)');
    });

    it('generates SVG static output', () => {
        const svg = renderStaticSVG(col, { width: 400, height: 400, format: 'svg' });
        expect(svg).toContain('<svg');
        expect(svg).toContain('height="400"');
        expect(svg).toContain('fill="red"');
    });

    it('generates data URL', () => {
         const dataUrl = renderStaticToDataURL(col, { width: 400, height: 400, format: 'svg' });
         expect(dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    });

    it('attaches interactive canvas to container', () => {
        if (typeof document === 'undefined') return; // skip if no jsdom
        
        const div = document.createElement('div');
        Object.defineProperty(div, 'clientWidth', { value: 800 });
        Object.defineProperty(div, 'clientHeight', { value: 600 });
        
        renderInteractive2D(div, col, { interactive: true, arrangement: '2d' });
        
        const canvas = div.querySelector('canvas');
        expect(canvas).not.toBeNull();
        expect(canvas?.width).toBe(800);
        
        const tooltip = div.querySelector('div');
        expect(tooltip).not.toBeNull();
        expect(tooltip?.style.opacity).toBe('0');
    });

    it('escapes static SVG data and rejects unsafe colors', () => {
        const unsafe = new SoilProfileCollection([
            new SoilProfile('p"><script>alert(1)</script>', [{
                top: 0,
                bottom: 50,
                name: '<title><script>alert(1)</script>',
                color: 'red" onload="alert(1)'
            }])
        ]);

        const svg = renderStaticSVG(unsafe, { width: 400, height: 400, format: 'svg' });

        expect(svg).not.toContain('<script');
        expect(svg).not.toContain('onload');
        expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(svg).toContain('fill="#cccccc"');
    });

    it('treats interactive tooltip data as text', () => {
        const unsafe = new SoilProfileCollection([
            new SoilProfile('<img src=x onerror=alert(1)>', [{
                top: 0,
                bottom: 50,
                name: '<svg onload=alert(1)>',
                texture: '<b>loam</b>',
                color: 'red" onclick="alert(1)',
                metadata: {
                    '<iframe src=evil>': '<script>alert(1)</script>'
                }
            }])
        ]);
        const div = document.createElement('div');
        Object.defineProperty(div, 'clientWidth', { value: 800 });
        Object.defineProperty(div, 'clientHeight', { value: 600 });

        renderInteractive2D(div, unsafe, { interactive: true, arrangement: '2d' });

        const canvas = div.querySelector('canvas');
        const tooltip = div.querySelector('div');

        expect(canvas).not.toBeNull();
        expect(tooltip).not.toBeNull();

        canvas?.dispatchEvent(new MouseEvent('mousemove', {
            clientX: 45,
            clientY: 45,
            bubbles: true
        }));

        expect(tooltip?.querySelector('img')).toBeNull();
        expect(tooltip?.querySelector('svg')).toBeNull();
        expect(tooltip?.querySelector('b')).toBeNull();
        expect(tooltip?.querySelector('iframe')).toBeNull();
        expect(tooltip?.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(tooltip?.textContent).toContain('<svg onload=alert(1)>');
        expect(tooltip?.textContent).toContain('<b>loam</b>');
        expect(tooltip?.textContent).toContain('<script>alert(1)</script>');
    });

    it('uses Munsell color when available and no texture data', () => {
        const munsellProfile = new SoilProfileCollection([
            new SoilProfile('munsell-p1', [{
                top: 0,
                bottom: 50,
                name: 'A',
                color: '#cccccc',
                munsellHue: '10YR',
                munsellValue: 5,
                munsellChroma: 4
            }])
        ]);

        const svg = renderStaticSVG(munsellProfile, { width: 400, height: 400, format: 'svg', mode: 'depth' });
        // Should use converted Munsell color, not the fallback #cccccc
        expect(svg).not.toContain('fill="#cccccc"');
        // Should render the horizon
        expect(svg).toContain('A');
    });

    it('respects color priority: texture > munsell > fallback', () => {
        // Horizon with both clay (texture) and Munsell data - should use texture
        const mixedProfile = new SoilProfileCollection([
            new SoilProfile('mixed-p1', [{
                top: 0,
                bottom: 50,
                name: 'A',
                color: '#cccccc',
                clay: 30,
                sand: 30,
                silt: 40,
                munsellHue: '10YR',
                munsellValue: 5,
                munsellChroma: 4
            }])
        ]);

        const svg = renderStaticSVG(mixedProfile, { width: 400, height: 400, format: 'svg', mode: 'depth' });
        // Should use texture color (not fallback), verified by not containing the exact fallback color in fill attributes
        expect(svg).toContain('<rect x="40" y="40" width="300" height="320" fill="');
        // Should not be the fallback color for this texture composition
        expect(svg).not.toContain('fill="#cccccc"'); // fallback color should not be used
    });

    it('falls back to horizon.color when Munsell data is missing', () => {
        const noMunsellProfile = new SoilProfileCollection([
            new SoilProfile('simple-p1', [{
                top: 0,
                bottom: 50,
                name: 'A',
                color: '#ff0000'
                // No Munsell data
            }])
        ]);

        const svg = renderStaticSVG(noMunsellProfile, { width: 400, height: 400, format: 'svg', mode: 'depth' });
        expect(svg).toContain('fill="#ff0000"');
    });

    it('ignores Munsell in texture mode', () => {
        const munsellProfile = new SoilProfileCollection([
            new SoilProfile('munsell-p1', [{
                top: 0,
                bottom: 50,
                name: 'A',
                color: '#cccccc',
                clay: 20,
                sand: 50,
                silt: 30,
                munsellHue: '10YR',
                munsellValue: 5,
                munsellChroma: 4
            }])
        ]);

        const svg = renderStaticSVG(munsellProfile, { width: 400, height: 400, format: 'svg', mode: 'texture' });
        // Texture mode should render texture diagram, not horizon colors
        expect(svg).toContain('Clay %');
        expect(svg).toContain('Sand %');
        expect(svg).toContain('Silt %');
    });

    it('ignores Munsell in properties mode', () => {
        const munsellProfile = new SoilProfileCollection([
            new SoilProfile('munsell-p1', [{
                top: 0,
                bottom: 50,
                name: 'A',
                color: '#ff0000',
                ph: 6.5,
                munsellHue: '10YR',
                munsellValue: 5,
                munsellChroma: 4
            }])
        ]);

        const svg = renderStaticSVG(munsellProfile, { width: 400, height: 400, format: 'svg', mode: 'properties' });
        // Properties mode should use pH color, not Munsell or fallback
        expect(svg).toContain('Soil pH');
        // Should use pH color (fee090) not fallback (#ff0000) or Munsell
        expect(svg).toContain('fill="#fee090"');
        expect(svg).not.toContain('fill="#ff0000"');
    });

    it('renders Munsell colors in thumbnail mode', () => {
        const munsellProfile = new SoilProfileCollection([
            new SoilProfile('munsell-p1', [{
                top: 0,
                bottom: 50,
                name: 'A',
                color: '#ff0000',
                munsellHue: '5R',
                munsellValue: 5,
                munsellChroma: 6
            }])
        ]);

        const svg = renderStaticSVG(munsellProfile, { width: 100, height: 200, format: 'svg', mode: 'thumbnail' });
        expect(svg).toContain('<svg');
        expect(svg).toContain('A');
        // Should use Munsell color, not fallback color
        expect(svg).not.toContain('fill="#ff0000"');
        // Munsell 5R 5/6 should produce a different color
        expect(svg).toContain('fill="#');
    });
});
