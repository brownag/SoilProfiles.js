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
});
