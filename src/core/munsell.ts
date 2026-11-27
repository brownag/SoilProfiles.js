import { munsellToHexApprox } from '../utils/munsell-approx';

const cache = new Map<string, string | null>();
const CACHE_LIMIT = 4096;

/**
 * Converts Munsell color system parameters to a hex color string.
 * Handles formatting variations and invalid inputs gracefully.
 *
 * @param hue Munsell hue (e.g., "10YR", "5R", "2.5Y")
 * @param value Munsell value (0-10)
 * @param chroma Munsell chroma (0+)
 * @returns Hex color string (e.g., "#8b6f47") or null if conversion fails
 */
export function munsellToHex(
  hue: string | undefined,
  value: number | string | undefined,
  chroma: number | string | undefined
): string | null {
  // Validate inputs
  if (!hue || value === undefined) {
    return null;
  }

  // Normalize hue: remove spaces and convert to uppercase
  const normalizedHue = String(hue).trim().replace(/\s+/g, '').toUpperCase();
  const isNeutral = normalizedHue === 'N';

  // Validate hue format (should be digits followed by letters, e.g., "10YR", "5R", or "N" for neutral)
  if (!isNeutral && !/^\d+\.?\d*[A-Z]+$/.test(normalizedHue)) {
    return null;
  }

  // Resolve chroma: neutral hues can have empty, missing, or '-' chroma which defaults to 0
  let cleanChroma = chroma;
  if (isNeutral) {
    if (chroma === undefined || chroma === null) {
      cleanChroma = 0;
    } else {
      const trimmedChroma = String(chroma).trim();
      if (trimmedChroma === '' || trimmedChroma === '-') {
        cleanChroma = 0;
      }
    }
  } else if (chroma === undefined) {
    return null;
  }

  // Validate value and chroma are positive numbers
  const numValue = Number(value);
  const numChroma = Number(cleanChroma);

  if (isNaN(numValue) || isNaN(numChroma) || numChroma < 0) {
    return null;
  }

  // Munsell Value must be in range 0-10
  if (numValue < 0 || numValue > 10) {
    return null;
  }

  const key = `${normalizedHue}|${numValue}|${numChroma}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const hex = munsellToHexApprox(normalizedHue, numValue, numChroma);
  if (cache.size >= CACHE_LIMIT) {
    cache.clear();
  }
  cache.set(key, hex);
  return hex;
}

/**
 * Check if Munsell parameters are valid and present
 */
export function isMunsellValid(
  hue: string | undefined,
  value: number | string | undefined,
  chroma: number | string | undefined
): boolean {
  return munsellToHex(hue, value, chroma) !== null;
}
