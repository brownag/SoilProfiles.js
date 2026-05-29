import { SoilProfile } from '../src/core/SoilProfile';
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
        expect(classifyTexture({ clay: 5, sand: 90 })).toBe('sand');
        expect(classifyTexture({ clay: 30, sand: 30 })).toBe('clay');
        expect(classifyTexture({ clay: 10, sand: 10 })).toBe('silt_loam');
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

    it('throws error when horizons overlap', () => {
        expect(() => {
            new SoilProfile('p2', [
                { top: 0, bottom: 20, name: 'A', color: '#000000' },
                { top: 15, bottom: 30, name: 'B', color: '#ff0000' }
            ]);
        }).toThrow(/overlap/);
    });

    it('throws error when top >= bottom', () => {
        expect(() => {
            new SoilProfile('p3', [
                { top: 10, bottom: 10, name: 'A', color: '#000000' },
            ]);
        }).toThrow(/Invalid horizon depth/);
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
});
