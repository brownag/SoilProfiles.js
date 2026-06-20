import { SoilProfile, validateHorizonDepths, repairHorizonDepths } from '../src/core/SoilProfile';
import { SoilProfileCollection } from '../src/core/SoilProfileCollection';
import { classifyTexture } from '../src/core/texture';
import { getPhColor } from '../src/core/phScale';
import { stackLabels } from '../src/core/layout';
import { mapToHorizon, DATA_MAPS } from '../src/core/mapping';

describe('SoilProfile data structures', () => {
    // ... (keep existing tests)
    
    test('Mapping utility (SSURGO aliases)', () => {
        const raw = {
            hzname: 'Ap',
            hzdept_r: 0,
            hzdepb_r: 20,
            claytotal_r: 15,
            sandtotal_r: 70,
            ph1to1h2o_r: 6.2
        };
        const horizon = mapToHorizon(raw, DATA_MAPS.SSURGO);
        expect(horizon.name).toBe('Ap');
        expect(horizon.clay).toBe(15);
        expect(horizon.ph).toBe(6.2);
        expect(horizon.top).toBe(0);
    });

    test('Texture classification logic', () => {
        expect(classifyTexture({ clay: 5, sand: 90 })).toBe('s');     // sand (clay < 15, sand high)
        expect(classifyTexture({ clay: 27, sand: 30 })).toBe('cl');   // clay loam (clay 27-40%, sand 20-45%)
        expect(classifyTexture({ clay: 10, sand: 10, silt: 80 })).toBe('si');   // silt (silt >= 80%, clay < 12%)
        expect(classifyTexture({})).toBeNull();
    });

    test('pH color mapping', () => {
        expect(getPhColor(4.5)).toBe('#d73027'); // Acidic
        expect(getPhColor(7.0)).toBe('#91bfdb'); // Slightly alkaline
        expect(getPhColor(8.5)).toBe('#4575b4'); // Alkaline
    });

    test('Label stacking utility', () => {
        const yPositions = [10, 12, 14];
        const stacked = stackLabels(yPositions, 10);
        expect(stacked[0]).toBe(10);
        expect(stacked[1]).toBe(20);
        expect(stacked[2]).toBe(30);
    });

    it('creates a SoilProfile and correctly sorts initially unordered horizons', () => {
        const p1 = new SoilProfile('p1', [
            { top: 10, bottom: 20, name: 'B', color: '#ff0000' },
            { top: 0, bottom: 10, name: 'A', color: '#000000' }
        ]);
        expect(p1.horizons[0].name).toBe('A');
        expect(p1.horizons[1].name).toBe('B');
    });

    it('does NOT throw when horizons overlap (warns instead)', () => {
        // Overlaps now warn, not throw — allows rendering even with data issues
        const p = new SoilProfile('p2', [
            { top: 0, bottom: 20, name: 'A', color: '#000000' },
            { top: 15, bottom: 30, name: 'B', color: '#ff0000' }
        ]);
        expect(p.horizons.length).toBe(2);
    });

    it('repairs zero-thickness horizons via repairHorizonDepths before throwing', () => {
        // top == bottom gets expanded by repairHorizonDepths, so it won't throw
        const p = new SoilProfile('p3', [
            { top: 10, bottom: 10, name: 'A', color: '#000000' },
        ]);
        expect(p.horizons[0].bottom).toBe(11);  // expanded by 1
    });

    it('correctly reports maximum depth in a collection', () => {
         const p1 = new SoilProfile('p1', [{ top: 0, bottom: 50, name: 'A', color: 'red' }]);
         const p2 = new SoilProfile('p2', [{ top: 0, bottom: 120, name: 'A', color: 'blue' }]);
         const col = new SoilProfileCollection([p1, p2]);

         expect(col.getMaxDepth()).toBe(120);
    });

    it('filters collections', () => {
         const p1 = new SoilProfile('p1', [{ top: 0, bottom: 50, name: 'A', color: 'red' }]);
         const p2 = new SoilProfile('p2', [{ top: 0, bottom: 120, name: 'A', color: 'blue' }]);
         const col = new SoilProfileCollection([p1, p2]);

         const filtered = col.filterByProperty(p => p.id === 'p1');
         expect(filtered.profiles.length).toBe(1);
         expect(filtered.profiles[0].id).toBe('p1');
    });

    describe('Depth validation (aqp-compatible checks)', () => {
        it('validateHorizonDepths detects missing top depth', () => {
            const result = validateHorizonDepths([
                { top: NaN, bottom: 10, name: 'A', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'missingDepth')).toBe(true);
        });

        it('validateHorizonDepths detects missing bottom depth', () => {
            const result = validateHorizonDepths([
                { top: 0, bottom: NaN, name: 'A', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'missingDepth')).toBe(true);
        });

        it('validateHorizonDepths detects null depths', () => {
            const result = validateHorizonDepths([
                { top: null as any, bottom: 10, name: 'A', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'missingDepth')).toBe(true);
        });

        it('validateHorizonDepths detects undefined depths', () => {
            const result = validateHorizonDepths([
                { top: undefined as any, bottom: 10, name: 'A', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'missingDepth')).toBe(true);
        });

        it('validateHorizonDepths detects inverted depths (top >= bottom)', () => {
            const result = validateHorizonDepths([
                { top: 20, bottom: 20, name: 'A', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'depthLogic' && e.message.includes('top >= bottom'))).toBe(true);
        });

        it('validateHorizonDepths detects overlapping horizons', () => {
            const result = validateHorizonDepths([
                { top: 0, bottom: 20, name: 'A', color: '#000' },
                { top: 15, bottom: 30, name: 'B', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'overlapOrGap' && e.message.includes('Overlap'))).toBe(true);
        });

        it('validateHorizonDepths detects gaps between horizons', () => {
            const result = validateHorizonDepths([
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: 15, bottom: 30, name: 'B', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'overlapOrGap' && e.message.includes('Gap'))).toBe(true);
        });

        it('validateHorizonDepths detects out-of-order horizons', () => {
            const result = validateHorizonDepths([
                { top: 20, bottom: 30, name: 'B', color: '#000' },
                { top: 0, bottom: 10, name: 'A', color: '#000' }
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.type === 'depthLogic' && e.message.includes('not in top-depth order'))).toBe(true);
        });

        it('validateHorizonDepths accepts valid contiguous horizons', () => {
            const result = validateHorizonDepths([
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: 10, bottom: 20, name: 'B', color: '#000' },
                { top: 20, bottom: 50, name: 'C', color: '#000' }
            ]);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('throws when creating profile with NaN depths', () => {
            expect(() => {
                new SoilProfile('test', [
                    { top: NaN, bottom: 10, name: 'A', color: '#000' }
                ]);
            }).toThrow(/Missing or invalid top depth/);
        });

        it('throws when creating profile with null depths', () => {
            expect(() => {
                new SoilProfile('test', [
                    { top: null as any, bottom: 10, name: 'A', color: '#000' }
                ]);
            }).toThrow(/Missing or invalid top depth/);
        });

        it('does NOT throw when creating profile with gap between horizons (common in SSURGO)', () => {
            // Gaps are now only warned, not thrown
            const p = new SoilProfile('test', [
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: 15, bottom: 30, name: 'B', color: '#000' }
            ]);
            expect(p.horizons.length).toBe(2);
            expect(p.horizons[0].top).toBe(0);
            expect(p.horizons[1].top).toBe(15);
        });

        it('mapToHorizon uses NaN for missing depths instead of defaults', () => {
            const raw = {
                hzname: 'Ap',
                // hzdept_r and hzdepb_r are missing
                claytotal_r: 15
            };
            const horizon = mapToHorizon(raw, DATA_MAPS.SSURGO);
            expect(isNaN(horizon.top)).toBe(true);
            expect(isNaN(horizon.bottom)).toBe(true);
        });

        it('mapToHorizon converts valid depths to numbers', () => {
            const raw = {
                hzname: 'Ap',
                hzdept_r: 0,
                hzdepb_r: 20,
                claytotal_r: 15
            };
            const horizon = mapToHorizon(raw, DATA_MAPS.SSURGO);
            expect(horizon.top).toBe(0);
            expect(horizon.bottom).toBe(20);
        });
    });

    describe('repairHorizonDepths (old-style O horizon fix)', () => {
        it('repairs single old-style O horizon (inverted top > bottom) stacked above mineral horizons', () => {
            const input = [
                { top: 1, bottom: 0, name: 'Oe', color: '#000' },  // inverted: top > bottom
                { top: 0, bottom: 20, name: 'A', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(2);
            expect(repaired[0].name).toBe('Oe');
            expect(repaired[0].top).toBe(0);
            expect(repaired[0].bottom).toBe(1);
            expect(repaired[1].name).toBe('A');
            expect(repaired[1].top).toBe(1);
            expect(repaired[1].bottom).toBe(21);
        });

        it('repairs multiple stacked old-style O horizons with inverted depths', () => {
            const input = [
                { top: 2, bottom: 1, name: 'Oi', color: '#000' },  // inverted: 1 cm thick
                { top: 1, bottom: 0, name: 'Oe', color: '#000' },  // inverted: 1 cm thick
                { top: 0, bottom: 10, name: 'A', color: '#000' }   // normal: 10 cm thick
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(3);
            // After negation and cumsum, depths should be continuous and non-negative: [0,1], [1,2], [2,12]
            expect(repaired[0].top).toBe(0);
            expect(repaired[0].bottom).toBe(1);
            expect(repaired[1].top).toBe(1);
            expect(repaired[1].bottom).toBe(2);
            expect(repaired[2].top).toBe(2);
            expect(repaired[2].bottom).toBe(12);
        });

        it('repairs zero-thickness horizons by expanding bottom by 1', () => {
            const input = [
                { top: 10, bottom: 10, name: 'A', color: '#000' }  // zero thickness
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(1);
            expect(repaired[0].bottom).toBe(11);
        });

        it('repairs missing bottom depths on deepest horizon', () => {
            const input = [
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: 10, bottom: NaN, name: 'C', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(2);
            expect(repaired[1].bottom).toBe(20);  // top + default adj (10)
        });

        it('repairs missing bottom depths on non-deepest horizons by borrowing next top', () => {
            const input = [
                { top: 0, bottom: NaN, name: 'A', color: '#000' },
                { top: 15, bottom: 30, name: 'B', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(2);
            expect(repaired[0].bottom).toBe(15);  // borrowed from next horizon top
        });

        it('drops horizons where both top AND bottom are missing', () => {
            const input = [
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: NaN, bottom: NaN, name: 'B', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(1);
            expect(repaired[0].name).toBe('A');
        });

        it('keeps horizons with only missing top depth (repaired)', () => {
            const input = [
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: NaN, bottom: 20, name: 'B', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input);
            expect(repaired.length).toBe(2);
            // The horizon with missing top but valid bottom is kept (not deleted)
        });

        it('allows custom pattern for O horizon detection', () => {
            const input = [
                { top: 1, bottom: 0, name: 'O', color: '#000' },   // matches custom pattern
                { top: 0, bottom: 10, name: 'A', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input, { pattern: /^O$/ });
            expect(repaired[0].top).toBeLessThan(repaired[0].bottom);  // repaired
        });

        it('allows custom adj parameter for filling missing depths', () => {
            const input = [
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: 10, bottom: NaN, name: 'C', color: '#000' }
            ];
            const repaired = repairHorizonDepths(input, { adj: 50 });
            expect(repaired[1].bottom).toBe(60);  // top + custom adj
        });

        it('does not throw when profile has gaps after repair (rendered with warning)', () => {
            // This creates a profile that will warn but not throw
            const p = new SoilProfile('test', [
                { top: 0, bottom: 10, name: 'A', color: '#000' },
                { top: 15, bottom: 30, name: 'B', color: '#000' }
            ]);
            expect(p.horizons.length).toBe(2);
        });

        it('repairs old-style O horizon and allows profile creation without throwing', () => {
            const p = new SoilProfile('test', [
                { top: 1, bottom: 0, name: 'Oe', color: '#000' },
                { top: 0, bottom: 20, name: 'A', color: '#000' }
            ]);
            expect(p.horizons.length).toBe(2);
            expect(p.horizons[0].name).toBe('Oe');
            // After repair, Oe should have top < bottom
            expect(p.horizons[0].top).toBeLessThan(p.horizons[0].bottom);
        });
    });
});
