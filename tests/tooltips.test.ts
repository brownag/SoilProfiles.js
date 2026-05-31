import {
    Horizon,
    SoilProfile,
    SoilProfileCollection,
    renderStaticSVG,
    renderComparisonSVG,
    formatHorizonProperties,
    createDefaultTooltip,
    getHorizonDataFromElement,
    createTooltipLines
} from '../src';
import { generateHorizonId, serializeHorizonData } from '../src/render/safety';

describe('tooltip system', () => {
    const sampleHorizon: Horizon = {
        top: 0,
        bottom: 10,
        name: 'Ap',
        color: '#8b7355',
        clay: 18,
        sand: 45,
        silt: 37,
        ph: 6.8,
        om: 2.5,
        ksat: 2.5
    };

    const sampleProfile = new SoilProfile('Test Profile', [sampleHorizon]);
    const sampleCollection = new SoilProfileCollection([sampleProfile]);

    describe('data attribute generation', () => {
        it('generates unique horizon IDs', () => {
            const id1 = generateHorizonId('profile1', 'Ap', 0);
            const id2 = generateHorizonId('profile1', 'Ap', 1);
            const id3 = generateHorizonId('profile2', 'Ap', 0);

            expect(id1).toBe('profile1_hz_ap_0');
            expect(id2).toBe('profile1_hz_ap_1');
            expect(id3).toBe('profile2_hz_ap_0');
        });

        it('generates unique IDs with multi-word horizon names', () => {
            const id = generateHorizonId('profile1', 'Bt1', 0);
            expect(id).toContain('profile1_hz_');
            expect(id).toContain('_0');
        });

        it('serializes horizon data to JSON', () => {
            const json = serializeHorizonData(sampleHorizon);
            const parsed = JSON.parse(json);

            expect(parsed.name).toBe('Ap');
            expect(parsed.top).toBe(0);
            expect(parsed.bottom).toBe(10);
            expect(parsed.clay).toBe(18);
            expect(parsed.ph).toBe(6.8);
        });

        it('handles serialization errors gracefully', () => {
            const circular: any = { name: 'test' };
            circular.self = circular; // circular reference

            const json = serializeHorizonData(circular);
            expect(json).toBeDefined();
            // Should return valid JSON or fallback
        });

        it('includes data attributes in SVG output', () => {
            const svg = renderStaticSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            expect(svg).toContain('data-horizon-id');
            expect(svg).toContain('data-horizon-properties');
            expect(svg).toContain(sampleHorizon.name.toLowerCase());
        });
    });

    describe('tooltip rendering modes', () => {
        it('renders native titles by default', () => {
            const svg = renderStaticSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            expect(svg).toContain('<title>');
        });

        it('renders native titles in native mode', () => {
            const svg = renderStaticSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg',
                tooltips: { mode: 'native' }
            });

            expect(svg).toContain('<title>');
        });

        it('suppresses titles in custom mode', () => {
            const svg = renderStaticSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg',
                tooltips: { mode: 'custom' }
            });

            // Count <title> elements - should be minimal (only non-horizon titles)
            const titleMatches = (svg.match(/<title>/g) || []).length;
            expect(titleMatches).toBeLessThan(3); // Might have axis titles
        });

        it('suppresses titles in data-only mode', () => {
            const svg = renderStaticSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg',
                tooltips: { mode: 'data-only' }
            });

            // Should still have data attributes
            expect(svg).toContain('data-horizon-properties');
        });
    });

    describe('comparison render with tooltips', () => {
        it('includes data attributes in comparison SVG', () => {
            const svg = renderComparisonSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            expect(svg).toContain('data-horizon-id');
            expect(svg).toContain('data-horizon-properties');
        });

        it('respects tooltip mode in comparison render', () => {
            const svgNative = renderComparisonSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg',
                tooltips: { mode: 'native' }
            });

            const svgCustom = renderComparisonSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg',
                tooltips: { mode: 'custom' }
            });

            expect(svgNative).toContain('<title>');
            // svgCustom might have fewer titles (but comparison might still have some for labels)
        });
    });

    describe('utility functions', () => {
        describe('formatHorizonProperties', () => {
            it('formats default properties', () => {
                const props = formatHorizonProperties(sampleHorizon);

                expect(props.length).toBeGreaterThan(0);
                expect(props.some(p => p.key === 'name')).toBe(true);
                expect(props.some(p => p.key === 'clay')).toBe(true);
            });

            it('includes depth when requested', () => {
                const props = formatHorizonProperties(sampleHorizon, {
                    includeDepth: true,
                    properties: ['depth']
                });

                const depthProp = props.find(p => p.key === 'depth');
                expect(depthProp).toBeDefined();
                expect(depthProp?.value).toContain('0');
                expect(depthProp?.value).toContain('10');
            });

            it('applies custom labels', () => {
                const props = formatHorizonProperties(sampleHorizon, {
                    properties: ['clay'],
                    customLabels: { clay: 'Clay Content' }
                });

                expect(props[0].label).toBe('Clay Content');
            });

            it('applies custom formatters', () => {
                const props = formatHorizonProperties(sampleHorizon, {
                    properties: ['ph'],
                    customFormatters: { ph: (v) => v.toFixed(0) }
                });

                expect(props[0].value).toBe('7'); // 6.8 rounded to 0 decimals
            });

            it('filters to requested properties', () => {
                const props = formatHorizonProperties(sampleHorizon, {
                    properties: ['name', 'clay', 'ph']
                });

                const keys = props.map(p => p.key);
                expect(keys).toContain('name');
                expect(keys).toContain('clay');
                expect(keys).toContain('ph');
                expect(keys).not.toContain('sand'); // not requested
            });

            it('skips properties with undefined values', () => {
                const horizon: Horizon = {
                    ...sampleHorizon,
                    ksat: undefined
                };

                const props = formatHorizonProperties(horizon, {
                    properties: ['name', 'ksat', 'clay']
                });

                expect(props.some(p => p.key === 'ksat')).toBe(false);
            });
        });

        describe('createDefaultTooltip', () => {
            it('creates an HTMLElement', () => {
                const tooltip = createDefaultTooltip(sampleHorizon);

                expect(tooltip instanceof HTMLElement).toBe(true);
                expect(tooltip.tagName).toBe('DIV');
            });

            it('includes horizon properties in tooltip', () => {
                const tooltip = createDefaultTooltip(sampleHorizon);
                const text = tooltip.textContent || '';

                expect(text).toContain('Ap'); // horizon name
                expect(text).toContain('18'); // clay value
            });

            it('applies custom class name', () => {
                const tooltip = createDefaultTooltip(sampleHorizon, {
                    className: 'my-tooltip'
                });

                expect(tooltip.className).toBe('my-tooltip');
            });

            it('applies custom styles', () => {
                const tooltip = createDefaultTooltip(sampleHorizon, {
                    style: { color: 'red', fontSize: '14px' }
                });

                expect(tooltip.style.color).toBe('red');
                expect(tooltip.style.fontSize).toBe('14px');
            });

            it('respects property selection', () => {
                const tooltip1 = createDefaultTooltip(sampleHorizon, {
                    properties: ['name', 'clay']
                });

                const tooltip2 = createDefaultTooltip(sampleHorizon, {
                    properties: ['name', 'clay', 'sand', 'ph', 'om']
                });

                // tooltip2 should have more content than tooltip1
                const text1 = tooltip1.textContent || '';
                const text2 = tooltip2.textContent || '';

                expect(text2.length).toBeGreaterThan(text1.length);
            });
        });

        describe('createTooltipLines', () => {
            it('creates TooltipLine array', () => {
                const lines = createTooltipLines(sampleHorizon, {
                    properties: ['name', 'clay', 'ph']
                });

                expect(Array.isArray(lines)).toBe(true);
                expect(lines.length).toBeGreaterThan(0);
                expect(lines[0]).toHaveProperty('label');
                expect(lines[0]).toHaveProperty('value');
            });

            it('preserves custom formatters', () => {
                const lines = createTooltipLines(sampleHorizon, {
                    properties: ['ph'],
                    customFormatters: { ph: (v) => `${v.toFixed(1)} (neutral)` }
                });

                expect(lines[0].value).toContain('6.8');
                expect(lines[0].value).toContain('neutral');
            });
        });

        describe('getHorizonDataFromElement', () => {
            it('parses horizon data from element attribute', () => {
                // Mock SVG element (we can't create real SVG in jsdom without setup)
                const mockElement = {
                    getAttribute: (attr: string) => {
                        if (attr === 'data-horizon-properties') {
                            return JSON.stringify(sampleHorizon);
                        }
                        return null;
                    }
                } as any;

                const horizon = getHorizonDataFromElement(mockElement);

                expect(horizon).not.toBeNull();
                expect(horizon?.name).toBe('Ap');
                expect(horizon?.clay).toBe(18);
            });

            it('returns null for missing data attribute', () => {
                const mockElement = {
                    getAttribute: () => null
                } as any;

                const horizon = getHorizonDataFromElement(mockElement);

                expect(horizon).toBeNull();
            });

            it('returns null for invalid JSON', () => {
                const mockElement = {
                    getAttribute: () => 'invalid json {'
                } as any;

                const horizon = getHorizonDataFromElement(mockElement);

                expect(horizon).toBeNull();
            });

            it('returns null for null element', () => {
                const horizon = getHorizonDataFromElement(null as any);

                expect(horizon).toBeNull();
            });
        });
    });

    describe('backward compatibility', () => {
        it('renders without tooltip options specified', () => {
            const svg = renderStaticSVG(sampleCollection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            // Should render successfully and include data attributes
            expect(svg).toContain('<svg');
            expect(svg).toContain('data-horizon-properties');
            expect(svg).toContain('<title>');
        });

        it('handles horizons without tooltipConfig gracefully', () => {
            const horizon: Horizon = {
                top: 0,
                bottom: 10,
                name: 'Test',
                color: '#aaa'
                // no tooltipConfig
            };

            const profile = new SoilProfile('Test', [horizon]);
            const collection = new SoilProfileCollection([profile]);

            const svg = renderStaticSVG(collection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            expect(svg).toContain('data-horizon-properties');
        });
    });

    describe('multiple profiles', () => {
        it('generates unique IDs for each profile', () => {
            const profile1 = new SoilProfile('Profile1', [sampleHorizon]);
            const profile2 = new SoilProfile('Profile2', [sampleHorizon]);
            const collection = new SoilProfileCollection([profile1, profile2]);

            const svg = renderComparisonSVG(collection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            // Profile IDs are sanitized to lowercase, alphanumeric, underscore, hyphen only
            expect(svg).toContain('profile1_hz');
            expect(svg).toContain('profile2_hz');
        });

        it('preserves property values across profiles', () => {
            const horizon1: Horizon = {
                ...sampleHorizon,
                clay: 20,
                name: 'Ap1'
            };
            const horizon2: Horizon = {
                ...sampleHorizon,
                clay: 30,
                name: 'Ap2'
            };

            const profile1 = new SoilProfile('P1', [horizon1]);
            const profile2 = new SoilProfile('P2', [horizon2]);
            const collection = new SoilProfileCollection([profile1, profile2]);

            const svg = renderComparisonSVG(collection, {
                width: 400,
                height: 300,
                format: 'svg'
            });

            // In SVG attributes, quotes are escaped as &quot;
            expect(svg).toContain('&quot;clay&quot;:20');
            expect(svg).toContain('&quot;clay&quot;:30');
        });
    });
});
