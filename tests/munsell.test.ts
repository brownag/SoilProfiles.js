import { readFileSync } from 'fs';
import path from 'path';
import { munsellToHex, isMunsellValid } from '../src/core/munsell';
import { hexToLab, deltaE2000 } from './helpers/ciede2000';

type InterpolRow = [string, number, number, number, number, number, string[]];

function loadInterpolRows(fixture: string): InterpolRow[] {
  const dataPath = path.join(__dirname, 'fixtures', fixture);
  return JSON.parse(readFileSync(dataPath, 'utf8')).rows;
}

/**
 * Munsell color conversion is now optional and user-driven (no longer automatic).
 * These tests verify the conversion functions work correctly when explicitly called.
 * Parsers now require opt-in configuration to apply Munsell conversion to color fields.
 */

describe('Munsell Color Conversion', () => {
  describe('munsellToHex function', () => {
    it('should convert valid Munsell color to hex', () => {
      // Test with a known Munsell color
      const result = munsellToHex('5R', 5, 6);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle formatting variations in hue', () => {
      // Test with space in hue (should be normalized)
      const result1 = munsellToHex('5 R', 5, 6);
      expect(result1).toBeTruthy();
      expect(result1).toMatch(/^#[0-9a-f]{6}$/i);

      // Test with different hue format
      const result2 = munsellToHex('10YR', 5, 6);
      expect(result2).toBeTruthy();
      expect(result2).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle decimal values', () => {
      const result = munsellToHex('2.5Y', 5.5, 4.5);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should handle case-insensitive hue', () => {
      const result1 = munsellToHex('5r', 5, 6);
      const result2 = munsellToHex('5R', 5, 6);
      expect(result1).toBe(result2);
    });

    it('should return null for invalid hue format', () => {
      expect(munsellToHex('invalid', 5, 6)).toBeNull();
      expect(munsellToHex('R5', 5, 6)).toBeNull();
      expect(munsellToHex('', 5, 6)).toBeNull();
      expect(munsellToHex('5XX', 5, 6)).toBeNull();
      expect(munsellToHex('0YR', 5, 6)).toBeNull();
      expect(munsellToHex('12YR', 5, 6)).toBeNull();
    });

    it('should return null for undefined parameters', () => {
      expect(munsellToHex(undefined, 5, 6)).toBeNull();
      expect(munsellToHex('5R', undefined, 6)).toBeNull();
      expect(munsellToHex('5R', 5, undefined)).toBeNull();
      expect(munsellToHex('N', undefined, 0)).toBeNull();
    });

    it('should return null for invalid value range', () => {
      expect(munsellToHex('5R', -1, 6)).toBeNull();
      expect(munsellToHex('5R', 11, 6)).toBeNull();
      expect(munsellToHex('N', -1, 0)).toBeNull();
      expect(munsellToHex('N', 11, 0)).toBeNull();
    });

    it('should return null for negative chroma', () => {
      expect(munsellToHex('5R', 5, -1)).toBeNull();
      expect(munsellToHex('N', 4, -1)).toBeNull();
    });

    it('should handle common soil hues', () => {
      // Test common soil color hues
      const testCases: [string, number, number][] = [
        ['10R', 4, 4],
        ['5YR', 5, 6],
        ['10YR', 5, 8],
        ['2.5Y', 6, 4],
        ['5Y', 7, 2],
      ];

      testCases.forEach(([hue, value, chroma]) => {
        const result = munsellToHex(hue, value, chroma);
        if (result) {
          expect(result).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });
    });

    it('should handle zero value gracefully', () => {
      // Value 0 is technically valid in Munsell
      const result = munsellToHex('5R', 0, 0);
      expect(result === null || /^#[0-9a-f]{6}$/i.test(result || '')).toBe(true);
    });

    it('should support neutral hues (gray shades) with various chroma formats', () => {
      // "N 2/0"
      const res1 = munsellToHex('N', 2, 0);
      expect(res1).toBeTruthy();
      expect(res1).toMatch(/^#[0-9a-f]{6}$/i);
      // Verify it's a shade of gray (equal R, G, B components)
      const r1 = res1!.slice(1, 3);
      const g1 = res1!.slice(3, 5);
      const b1 = res1!.slice(5, 7);
      expect(r1).toBe(g1);
      expect(g1).toBe(b1);

      // "N 2/" (undefined chroma)
      const res2 = munsellToHex('N', 2, undefined);
      expect(res2).toBe(res1);

      // "N 2/" (empty string chroma)
      const res3 = munsellToHex('N', 2, '');
      expect(res3).toBe(res1);

      // "N 2/-" (dash chroma)
      const res4 = munsellToHex('n', 2, '-'); // also test case insensitivity
      expect(res4).toBe(res1);

      // "N 4/0"
      const resN4 = munsellToHex('N', 4, 0);
      expect(resN4).toMatch(/^#[0-9a-f]{6}$/i);
      expect(resN4!.slice(1, 3)).toBe(resN4!.slice(3, 5));
      expect(resN4!.slice(3, 5)).toBe(resN4!.slice(5, 7));
      expect(resN4).not.toBe(res1);
    });

    it('should return distinct hex colors for 10YR 4/2 and 5YR 4/2', () => {
      const yr10 = munsellToHex('10YR', 4, 2);
      const yr5 = munsellToHex('5YR', 4, 2);
      expect(yr10).toMatch(/^#[0-9a-f]{6}$/i);
      expect(yr5).toMatch(/^#[0-9a-f]{6}$/i);
      expect(yr10).not.toBe(yr5);
    });

    it('should produce distinct valid hex colors across common soil hues at identical value/chroma', () => {
      const soilHues = ['2.5YR', '5YR', '7.5YR', '10YR', '2.5Y', '5Y'];

      for (const [value, chroma] of [
        [4, 2],
        [5, 6],
      ]) {
        const results = soilHues.map((hue) => munsellToHex(hue, value, chroma));
        for (const hex of results) {
          expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
        }
        expect(new Set(results).size).toBe(soilHues.length);
      }
    });

    it('should match munsellinterpol within ΔE00 bounds on typical soil colors', () => {
      const errors = loadInterpolRows('munsell-reference-munsellinterpol.json')
        .filter((row) => row[6].includes('typical'))
        .map(([hue, value, chroma, L, a, b]) => {
          const hex = munsellToHex(hue, value, chroma);
          expect(hex).toBeTruthy();
          return deltaE2000(hexToLab(hex!), [L, a, b]);
        });

      const mean = errors.reduce((sum, e) => sum + e, 0) / errors.length;
      expect(mean).toBeLessThanOrEqual(0.5);
      expect(Math.max(...errors)).toBeLessThanOrEqual(2.0);
    });

    it.each(['gley', 'red', 'highC', 'dark', 'light', 'redox'])(
      'should stay within ΔE00 2.0 on rare soil colors (%s)',
      (domain) => {
        const errors = loadInterpolRows('munsell-reference-munsellinterpol.json')
          .filter(
            (row) =>
              row[6].includes(domain) &&
              // C 13–14 is extrapolated and not a real soil colour.
              (domain !== 'highC' || row[2] <= 12)
          )
          .map(([hue, value, chroma, L, a, b]) => {
            const hex = munsellToHex(hue, value, chroma);
            expect(hex).toBeTruthy();
            return deltaE2000(hexToLab(hex!), [L, a, b]);
          });

        expect(errors.length).toBeGreaterThan(0);
        const max = Math.max(...errors);
        expect(max).toBeLessThanOrEqual(2.0);
      }
    );

    it.each([
      ['all', { mean: 0.5, max: 2.9 }],
      ['low', { mean: 0.5, max: 1.8 }],
      ['gley', { max: 1.7 }],
    ] as const)('should match the held-out munsellinterpol points (%s)', (tag, bounds) => {
      const errors = loadInterpolRows('munsell-reference-holdout.json')
        .filter((row) => row[6].includes(tag))
        .map(([hue, value, chroma, L, a, b]) => {
          const hex = munsellToHex(hue, value, chroma);
          expect(hex).toBeTruthy();
          return deltaE2000(hexToLab(hex!), [L, a, b]);
        });

      expect(errors.length).toBeGreaterThan(0);
      const mean = errors.reduce((sum, e) => sum + e, 0) / errors.length;
      const max = Math.max(...errors);
      if ('mean' in bounds) {
        expect(mean).toBeLessThanOrEqual(bounds.mean);
      }
      expect(max).toBeLessThanOrEqual(bounds.max);
    });

    it('should place neutral grays on the same value scale as chromatic colors', () => {
      // N v/0 should match the lightness of near-neutral (chroma 1) renotation chips at the
      // same value. aqp's measured neutral chips (e.g. N 5/ at L* 35) are deliberately not
      // used: they sit ~1 value step darker than the renotation scale for N 2-8.
      // Reference chips come from the munsellinterpol fixture.
      const rows = loadInterpolRows('munsell-reference-munsellinterpol.json');

      let previous = -1;
      for (const value of [2, 2.5, 3, 4, 5, 6, 7, 8]) {
        const chroma1 = rows.filter(
          ([, v, c, , , , domains]) => v === value && c === 1 && domains.includes('typical')
        );
        expect(chroma1.length).toBeGreaterThan(0);
        const meanL = chroma1.reduce((sum, row) => sum + row[3], 0) / chroma1.length;

        const hex = munsellToHex('N', value, 0);
        expect(hex).toBeTruthy();
        expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/i);
        const L = hexToLab(hex!)[0];

        expect(Math.abs(L - meanL)).toBeLessThanOrEqual(1.0);
        expect(L).toBeGreaterThan(previous);
        previous = L;
      }
    });
  });

  describe('isMunsellValid function', () => {
    it('should return true for valid Munsell parameters', () => {
      expect(isMunsellValid('5R', 5, 6)).toBe(true);
      expect(isMunsellValid('10YR', 5, 8)).toBe(true);
    });

    it('should return false for invalid Munsell parameters', () => {
      expect(isMunsellValid('invalid', 5, 6)).toBe(false);
      expect(isMunsellValid('5R', 11, 6)).toBe(false);
      expect(isMunsellValid('5R', 5, -1)).toBe(false);
      expect(isMunsellValid(undefined, 5, 6)).toBe(false);
    });
  });

  describe('consistency', () => {
    it('should produce consistent results for the same input', () => {
      const hue = '10YR';
      const value = 5;
      const chroma = 6;

      const result1 = munsellToHex(hue, value, chroma);
      const result2 = munsellToHex(hue, value, chroma);

      expect(result1).toBe(result2);
    });

    it('should validate correctly with isMunsellValid', () => {
      const hue = '5R';
      const value = 5;
      const chroma = 6;
      const isValid = isMunsellValid(hue, value, chroma);
      const hexResult = munsellToHex(hue, value, chroma);

      expect(isValid).toBe(hexResult !== null);
    });
  });
});
