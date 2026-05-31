import { munsellToRgbApprox } from '../utils/munsell-approx';

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
  value: number | undefined,
  chroma: number | undefined
): string | null {
  // Validate inputs
  if (!hue || value === undefined || chroma === undefined) {
    return null;
  }

  // Normalize hue: remove spaces and convert to uppercase
  const normalizedHue = String(hue).trim().replace(/\s+/g, '').toUpperCase();

  // Validate hue format (should be digits followed by letters, e.g., "10YR", "5R")
  if (!/^\d+\.?\d*[A-Z]+$/.test(normalizedHue)) {
    return null;
  }

  // Validate value and chroma are positive numbers
  const numValue = Number(value);
  const numChroma = Number(chroma);

  if (isNaN(numValue) || isNaN(numChroma) || numValue < 0 || numChroma < 0) {
    return null;
  }

  // Munsell Value must be in range 0-10
  if (numValue < 0 || numValue > 10) {
    return null;
  }

  // Convert to standard format "HUE VALUE/CHROMA" required by munsellToRgbApprox
  const munsellString = `${normalizedHue} ${numValue}/${numChroma}`;

  try {
    const hex = munsellToRgbApprox(munsellString);
    return hex;
  } catch {
    return null;
  }
}

/**
 * Check if Munsell parameters are valid and present
 */
export function isMunsellValid(
  hue: string | undefined,
  value: number | undefined,
  chroma: number | undefined
): boolean {
  return munsellToHex(hue, value, chroma) !== null;
}
