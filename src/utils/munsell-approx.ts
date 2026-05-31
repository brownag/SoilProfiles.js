/**
 * This file provides an approximate conversion from Munsell to sRGB.
 * It is based on a simplified model and is not a substitute for a full
 * color management system.
 *
 * The conversion is done in the following steps:
 * 1. Munsell Value to CIEXYZ Y (using a standard polynomial)
 * 2. Munsell Hue and Chroma to CIELAB a* and b* (using a small lookup table and linear interpolation)
 * 3. CIELAB to CIEXYZ
 * 4. CIEXYZ to sRGB
 */

interface LabColor {
  L: number;
  a: number;
  b: number;
}

interface ChromaPoint {
  chroma: number;
  a: number;
  b: number;
}

// A small lookup table for Munsell hues at value 5.
// The points are for chroma 2, 6, 10, and max chroma.
export const hueData: Record<string, ChromaPoint[]> = {
  '5R': [
    { chroma: 2, a: 7.80, b: 6.55 },
    { chroma: 6, a: 23.91, b: 22.03 },
    { chroma: 10, a: 39.11, b: 38.98 },
    { chroma: 26, a: 80.01, b: 67.38 }, // Max chroma for 5R is > 20, this is from 10R
  ],
  '5YR': [
    { chroma: 2, a: 3.23, b: 12.66 },
    { chroma: 6, a: 9.92, b: 38.69 },
    { chroma: 10, a: 14.87, b: 58.34 },
    { chroma: 16, a: 19.93, b: 58.99 }, // Max chroma for 5YR is > 12
  ],
  '5Y': [
    { chroma: 2, a: -1.73, b: 14.88 },
    { chroma: 6, a: -5.13, b: 45.86 },
    { chroma: 10, a: -8.54, b: 76.54 },
    { chroma: 20, a: -12.18, b: 95.86 }, // Max chroma for 5Y is > 12
  ],
  '5G': [
    { chroma: 2, a: -10.75, b: 1.34 },
    { chroma: 6, a: -31.73, b: 3.27 },
    { chroma: 10, a: -45.83, b: 7.02 },
    { chroma: 32, a: -49.18, b: 17.05 }, // Max chroma for 5G is > 10
  ],
  '5B': [
    { chroma: 2, a: -7.02, b: -10.97 },
    { chroma: 6, a: -20.67, b: -33.15 },
    { chroma: 10, a: -32.61, b: -52.48 },
    { chroma: 20, a: -41.34, b: -62.43 }, // Max chroma for 5B is > 8
  ],
  '5P': [
    { chroma: 2, a: 9.94, b: -7.21 },
    { chroma: 6, a: 28.92, b: -21.21 },
    { chroma: 10, a: 44.33, b: -32.68 },
    { chroma: 24, a: 73.19, b: -51.35 }, // Max chroma for 5P is > 12
  ],
};

/**
 * Converts a Munsell Value to CIEXYZ Y coordinate.
 * Uses the ASTM D1535 formula.
 * @param V Munsell Value (0-10)
 * @returns Y coordinate (0-1)
 */
function munsellValueToY(V: number): number {
  const V2 = V * V;
  const V3 = V2 * V;
  const V4 = V3 * V;
  const V5 = V4 * V;

  const Y = 1.2219 * V - 0.23111 * V2 + 0.23951 * V3 - 0.021009 * V4 + 0.0008404 * V5;
  return Y / 100; // Scale to 0-1
}

/**
 * Interpolates CIELAB a* and b* values for a given hue and chroma.
 * @param hue Munsell Hue (e.g., '5R')
 * @param chroma Munsell Chroma
 * @returns an object with a and b properties, or null if hue is not found.
 */
export function interpolateLab(hue: string, chroma: number): { a: number; b: number } | null {
  const points = hueData[hue];
  if (!points || points.length < 3) {
    return null; // Not enough points for quadratic interpolation
  }

  if (chroma === 0) {
    return { a: 0, b: 0 };
  }

  // Find the 3 closest points to the target chroma
  const sortedPoints = [...points].sort((a, b) => Math.abs(a.chroma - chroma) - Math.abs(b.chroma - chroma));
  const p = sortedPoints.slice(0, 3);
  const p0 = p[0], p1 = p[1], p2 = p[2];

  const L0 = (chroma - p1.chroma) * (chroma - p2.chroma) / ((p0.chroma - p1.chroma) * (p0.chroma - p2.chroma));
  const L1 = (chroma - p0.chroma) * (chroma - p2.chroma) / ((p1.chroma - p0.chroma) * (p1.chroma - p2.chroma));
  const L2 = (chroma - p0.chroma) * (chroma - p1.chroma) / ((p2.chroma - p0.chroma) * (p2.chroma - p1.chroma));

  const a = p0.a * L0 + p1.a * L1 + p2.a * L2;
  const b = p0.b * L0 + p1.b * L1 + p2.b * L2;

  return { a, b };
}

/**
 * Converts CIELAB color to CIEXYZ.
 * Assumes D65 reference white.
 */
function labToXyz(lab: LabColor): { x: number; y: number; z: number } {
  const { L, a, b } = lab;

  const delta = 6 / 29;

  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const f_inv = (t: number) => {
    if (t > delta) {
      return t * t * t;
    }
    return (t - 16 / 116) / 7.787;
  };

  const xr = f_inv(fx);
  const yr = f_inv(fy);
  const zr = f_inv(fz);

  // D65 reference white
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;
  
  const x = xr * Xn;
  const y = yr * Yn;
  const z = zr * Zn;

  return { x: x / 100, y: y / 100, z: z / 100 }; // Scale to 0-1
}

/**
 * Converts CIEXYZ to sRGB.
 */
function xyzToRgb(xyz: { x: number; y: number; z: number }): { r: number; g: number; b: number } {
  const { x, y, z } = xyz;

  const r_linear = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const g_linear = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const b_linear = x * 0.0557 + y * -0.2040 + z * 1.0570;

  const gamma_correct = (c: number) => {
    if (c <= 0.0031308) {
      return 12.92 * c;
    }
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  const r = gamma_correct(r_linear);
  const g = gamma_correct(g_linear);
  const b = gamma_correct(b_linear);
  
  const clamp = (c: number) => Math.max(0, Math.min(1, c));

  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

/**
 * Main function to convert Munsell to sRGB hex string.
 * @param munsellString Munsell string in "H V/C" format.
 * @returns sRGB hex string or null.
 */
export function munsellToRgbApprox(munsellString: string): string | null {
  const parts = munsellString.trim().split(/ +/);
  if (parts.length !== 2) {
    return null;
  }

  const hue = parts[0];
  const vc = parts[1].split('/');
  if (vc.length !== 2) {
    return null;
  }

  const value = parseFloat(vc[0]);
  const chroma = parseFloat(vc[1]);

  if (isNaN(value) || isNaN(chroma)) {
    return null;
  }

  // 1. Munsell Value to Y
  const Y = munsellValueToY(value);

  // 2. Interpolate a* and b*
  let lab_ab = interpolateLab(hue, chroma);
  if (!lab_ab) {
    const hueLetter = hue.match(/[A-Z]+/);
    if(hueLetter) {
        for (const key in hueData) {
            if (key.endsWith(hueLetter[0])) {
                lab_ab = interpolateLab(key, chroma);
                if(lab_ab) {
                    break;
                }
            }
        }
    }
    if (!lab_ab) return null;
  }

  // L* is related to Y
  const L = 116 * Math.pow(Y, 1 / 3) - 16;
  
  // 3. CIELAB to CIEXYZ
  const xyz = labToXyz({ L, a: lab_ab.a, b: lab_ab.b });

  // 4. CIEXYZ to sRGB
  const rgb = xyzToRgb(xyz);

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

