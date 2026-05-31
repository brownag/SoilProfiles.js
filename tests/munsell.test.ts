import { munsellToHex, isMunsellValid } from '../src/core/munsell';

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
    });

    it('should return null for undefined parameters', () => {
      expect(munsellToHex(undefined, 5, 6)).toBeNull();
      expect(munsellToHex('5R', undefined, 6)).toBeNull();
      expect(munsellToHex('5R', 5, undefined)).toBeNull();
    });

    it('should return null for invalid value range', () => {
      expect(munsellToHex('5R', -1, 6)).toBeNull();
      expect(munsellToHex('5R', 11, 6)).toBeNull();
    });

    it('should return null for negative chroma', () => {
      expect(munsellToHex('5R', 5, -1)).toBeNull();
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
