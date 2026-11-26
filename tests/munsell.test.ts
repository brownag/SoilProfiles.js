import { readFileSync } from 'fs';
import path from 'path';
import { munsellToHex, isMunsellValid } from '../src/core/munsell';

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

    it('should closely approximate reference sRGB values across common soil hues', () => {
      const dataPath = path.join(__dirname, '..', 'soilprofiles-munsell', 'munsell-data.json');
      const raw = readFileSync(dataPath, 'utf8');
      const soilHues = new Set(['2.5YR', '5YR', '7.5YR', '10YR', '2.5Y', '5Y']);
      const entryRegex =
        /\{\s*hue:\s*'([^']+)',\s*value:\s*([\d.]+),\s*chroma:\s*([\d.]+),\s*r:\s*([\d.]+),\s*g:\s*([\d.]+),\s*b:\s*([\d.]+)\s*\}/g;

      interface RefEntry {
        hue: string;
        value: number;
        chroma: number;
        r: number;
        g: number;
        b: number;
      }

      const samples: RefEntry[] = [];
      let match: RegExpExecArray | null;
      while ((match = entryRegex.exec(raw)) !== null) {
        const hue = match[1];
        const value = Number(match[2]);
        const chroma = Number(match[3]);
        if (soilHues.has(hue) && value >= 2 && value <= 8 && chroma >= 1 && chroma <= 8) {
          samples.push({
            hue,
            value,
            chroma,
            r: Number(match[4]),
            g: Number(match[5]),
            b: Number(match[6]),
          });
        }
      }

      expect(samples.length).toBeGreaterThan(0);

      let totalChannelError = 0;
      for (const sample of samples) {
        const hex = munsellToHex(sample.hue, sample.value, sample.chroma);
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
        const r = parseInt(hex!.slice(1, 3), 16) / 255;
        const g = parseInt(hex!.slice(3, 5), 16) / 255;
        const b = parseInt(hex!.slice(5, 7), 16) / 255;

        totalChannelError += Math.abs(r - sample.r) + Math.abs(g - sample.g) + Math.abs(b - sample.b);
      }

      const meanChannelError = totalChannelError / (samples.length * 3);
      expect(meanChannelError).toBeLessThanOrEqual(15 / 255);
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
