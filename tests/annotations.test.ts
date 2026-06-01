import { SoilProfile } from '../src/core/SoilProfile';
import { SoilProfileCollection } from '../src/core/SoilProfileCollection';
import { renderStaticSVG } from '../src/render/static';
import { renderComparisonSVG } from '../src/render/comparison';
import { ANNOTATION_PRESETS } from '../src/core/types';

describe('Depth Annotations', () => {
    const horizons = [
        { top: 0, bottom: 20, name: 'A', color: '#523' },
        { top: 20, bottom: 60, name: 'B', color: '#743' }
    ];

    test('SoilProfile supports depth annotations in constructor', () => {
        const profile = new SoilProfile('P1', horizons, undefined, {}, [
            { depth: 50, label: 'Restriction', color: '#8B4513', type: 'line' }
        ]);
        expect(profile.depthAnnotations).toHaveLength(1);
        expect(profile.depthAnnotations[0].label).toBe('Restriction');
    });

    test('Static SVG rendering includes annotations', () => {
        const profile = new SoilProfile('P1', horizons, undefined, {}, [
            { depth: 50, label: 'Bedrock', type: 'line' },
            { depth: [30, 50], label: 'Water Table', color: '#4169E1', type: 'zone' }
        ]);
        const collection = new SoilProfileCollection([profile]);
        const svg = renderStaticSVG(collection, {
            width: 800,
            height: 600,
            format: 'svg',
            annotations: { enabled: true, position: 'right' }
        });

        expect(svg).toContain('Bedrock');
        expect(svg).toContain('Water Table');
        expect(svg).toContain('line'); // Check for line element
        expect(svg).toContain('rect'); // Check for zone (rect) element
    });

    test('Comparison SVG rendering includes annotations', () => {
        const profile = new SoilProfile('P1', horizons, undefined, {}, [
            { depth: 40, label: 'Fragipan' }
        ]);
        const collection = new SoilProfileCollection([profile]);
        const svg = renderComparisonSVG(collection, {
            width: 800,
            height: 600,
            format: 'svg',
            annotations: { enabled: true, position: 'overlay' }
        });

        expect(svg).toContain('Fragipan');
    });

    test('Annotation presets are available', () => {
        expect(ANNOTATION_PRESETS.water_table).toBeDefined();
        expect(ANNOTATION_PRESETS.water_table.color).toBe('#4169E1');
    });

    test('Legend is rendered when enabled', () => {
        const profile = new SoilProfile('P1', horizons, undefined, {}, [
            { depth: 40, label: 'Restriction', color: '#8B4513' }
        ]);
        const collection = new SoilProfileCollection([profile]);
        const svg = renderStaticSVG(collection, {
            width: 800,
            height: 600,
            format: 'svg',
            annotations: { enabled: true, showLegend: true }
        });

        expect(svg).toContain('Legend:');
        expect(svg).toContain('Restriction');
    });

    test('Annotations beyond profile depth are handled (rendered at scaled position)', () => {
        const profile = new SoilProfile('P1', horizons, undefined, {}, [
            { depth: 100, label: 'Deep Feature' }
        ]);
        const collection = new SoilProfileCollection([profile]);
        const svg = renderStaticSVG(collection, {
            width: 800,
            height: 600,
            format: 'svg',
            annotations: { enabled: true }
        });
        expect(svg).toContain('Deep Feature');
    });
});
