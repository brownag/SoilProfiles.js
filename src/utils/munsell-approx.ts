/**
 * This file provides an approximate conversion from Munsell to sRGB.
 * It is based on a simplified model and is not a substitute for a full
 * color management system.
 *
 * The conversion is done in the following steps:
 * 1. Munsell Value to CIEXYZ Y (using a standard polynomial)
 * 2. Munsell Hue and Chroma to CIELAB a* and b* (using a calibrated 20-hue anchor grid and circular interpolation)
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

const HUE_FAMILIES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'] as const;
const HUE_ANCHOR_STEP = 5;
const HUE_ANCHOR_ORDER = [
  '10RP', '5R', '10R', '5YR', '10YR', '5Y', '10Y', '5GY', '10GY', '5G',
  '10G', '5BG', '10BG', '5B', '10B', '5PB', '10PB', '5P', '10P', '5RP',
] as const;

// Calibrated 20-hue anchor grid covering all 10 Munsell hue families at 5-unit spacing.
// Each anchor stores representative (chroma, a*, b*) points in sRGB gamut.
export const hueData: Record<string, ChromaPoint[]> = {
  '10RP': [
    { chroma: 1, a: 4.24, b: 0.89 },
    { chroma: 2, a: 8.88, b: 1.71 },
    { chroma: 4, a: 17.99, b: 3.41 },
    { chroma: 6, a: 27.11, b: 5.03 },
    { chroma: 8, a: 36.07, b: 6.48 },
    { chroma: 10, a: 44.76, b: 7.73 },
    { chroma: 12, a: 53.46, b: 9.26 },
    { chroma: 18, a: 79.26, b: 12.27 },
  ],
  '5R': [
    { chroma: 1, a: 3.97, b: 1.86 },
    { chroma: 2, a: 8.79, b: 4.00 },
    { chroma: 4, a: 17.84, b: 8.42 },
    { chroma: 6, a: 26.42, b: 12.74 },
    { chroma: 8, a: 35.11, b: 17.04 },
    { chroma: 10, a: 44.33, b: 21.23 },
    { chroma: 12, a: 51.87, b: 25.84 },
    { chroma: 18, a: 77.50, b: 38.94 },
  ],
  '10R': [
    { chroma: 1, a: 3.78, b: 3.12 },
    { chroma: 2, a: 8.23, b: 6.69 },
    { chroma: 4, a: 16.35, b: 14.04 },
    { chroma: 6, a: 23.96, b: 21.37 },
    { chroma: 8, a: 31.67, b: 29.17 },
    { chroma: 9, a: 35.39, b: 33.17 },
    { chroma: 12, a: 45.66, b: 47.13 },
    { chroma: 16, a: 57.28, b: 66.64 },
  ],
  '5YR': [
    { chroma: 1, a: 3.16, b: 5.28 },
    { chroma: 2, a: 6.37, b: 10.03 },
    { chroma: 4, a: 12.19, b: 19.98 },
    { chroma: 6, a: 17.78, b: 30.52 },
    { chroma: 7, a: 20.38, b: 35.85 },
    { chroma: 8, a: 22.62, b: 41.26 },
    { chroma: 12, a: 31.13, b: 64.00 },
  ],
  '10YR': [
    { chroma: 1, a: 1.38, b: 6.84 },
    { chroma: 2, a: 3.17, b: 12.83 },
    { chroma: 4, a: 6.36, b: 25.20 },
    { chroma: 6, a: 9.42, b: 37.85 },
    { chroma: 8, a: 11.60, b: 50.93 },
    { chroma: 11, a: 14.49, b: 69.85 },
  ],
  '5Y': [
    { chroma: 1, a: -0.86, b: 7.53 },
    { chroma: 2, a: -0.98, b: 14.40 },
    { chroma: 4, a: -1.04, b: 28.44 },
    { chroma: 6, a: -0.92, b: 43.16 },
    { chroma: 7, a: -1.12, b: 50.45 },
    { chroma: 8, a: -0.84, b: 57.17 },
    { chroma: 12, a: -3.66, b: 86.19 },
  ],
  '10Y': [
    { chroma: 1, a: -2.22, b: 6.96 },
    { chroma: 2, a: -4.09, b: 14.12 },
    { chroma: 4, a: -7.14, b: 28.49 },
    { chroma: 6, a: -9.74, b: 43.51 },
    { chroma: 7, a: -11.03, b: 51.08 },
    { chroma: 8, a: -12.27, b: 58.52 },
    { chroma: 12, a: -17.40, b: 88.55 },
  ],
  '5GY': [
    { chroma: 1, a: -3.27, b: 5.76 },
    { chroma: 2, a: -7.03, b: 12.01 },
    { chroma: 4, a: -13.48, b: 24.20 },
    { chroma: 6, a: -19.24, b: 36.56 },
    { chroma: 7, a: -22.18, b: 43.73 },
    { chroma: 8, a: -24.95, b: 50.75 },
    { chroma: 12, a: -35.01, b: 81.09 },
  ],
  '10GY': [
    { chroma: 1, a: -4.64, b: 3.69 },
    { chroma: 2, a: -9.81, b: 7.71 },
    { chroma: 4, a: -19.28, b: 15.46 },
    { chroma: 6, a: -28.54, b: 23.32 },
    { chroma: 8, a: -38.24, b: 32.24 },
    { chroma: 9, a: -42.86, b: 36.31 },
    { chroma: 12, a: -56.40, b: 49.39 },
    { chroma: 17, a: -80.46, b: 73.35 },
  ],
  '5G': [
    { chroma: 1, a: -5.07, b: 1.94 },
    { chroma: 2, a: -10.80, b: 3.84 },
    { chroma: 4, a: -21.71, b: 7.37 },
    { chroma: 6, a: -32.53, b: 10.79 },
    { chroma: 8, a: -43.05, b: 14.26 },
    { chroma: 11, a: -61.51, b: 20.29 },
  ],
  '10G': [
    { chroma: 1, a: -5.05, b: 0.76 },
    { chroma: 2, a: -10.74, b: 1.40 },
    { chroma: 4, a: -21.77, b: 2.54 },
    { chroma: 6, a: -32.20, b: 3.96 },
    { chroma: 8, a: -42.89, b: 5.22 },
    { chroma: 10, a: -55.24, b: 7.39 },
  ],
  '5BG': [
    { chroma: 1, a: -5.10, b: -0.51 },
    { chroma: 2, a: -10.17, b: -1.42 },
    { chroma: 4, a: -20.38, b: -3.15 },
    { chroma: 5, a: -25.41, b: -3.63 },
    { chroma: 6, a: -30.21, b: -3.97 },
    { chroma: 8, a: -40.73, b: -4.42 },
    { chroma: 9, a: -48.08, b: -3.87 },
  ],
  '10BG': [
    { chroma: 1, a: -4.66, b: -1.80 },
    { chroma: 2, a: -8.77, b: -4.12 },
    { chroma: 4, a: -17.39, b: -8.67 },
    { chroma: 5, a: -21.80, b: -10.44 },
    { chroma: 6, a: -26.14, b: -12.10 },
    { chroma: 8, a: -35.33, b: -15.08 },
    { chroma: 9, a: -44.26, b: -15.94 },
  ],
  '5B': [
    { chroma: 1, a: -3.49, b: -2.72 },
    { chroma: 2, a: -6.42, b: -6.10 },
    { chroma: 4, a: -12.66, b: -12.87 },
    { chroma: 5, a: -15.78, b: -15.72 },
    { chroma: 6, a: -18.98, b: -18.71 },
    { chroma: 8, a: -25.42, b: -24.43 },
  ],
  '10B': [
    { chroma: 1, a: -1.86, b: -3.52 },
    { chroma: 2, a: -3.32, b: -7.39 },
    { chroma: 4, a: -6.43, b: -15.22 },
    { chroma: 6, a: -9.48, b: -22.42 },
    { chroma: 8, a: -12.56, b: -29.97 },
    { chroma: 10, a: -15.72, b: -37.83 },
  ],
  '5PB': [
    { chroma: 1, a: 0.15, b: -4.05 },
    { chroma: 2, a: 0.27, b: -7.97 },
    { chroma: 4, a: 0.56, b: -16.10 },
    { chroma: 6, a: 1.06, b: -24.52 },
    { chroma: 8, a: 1.80, b: -32.70 },
    { chroma: 12, a: 2.62, b: -48.45 },
    { chroma: 14, a: 3.17, b: -57.73 },
  ],
  '10PB': [
    { chroma: 1, a: 2.09, b: -4.09 },
    { chroma: 2, a: 3.89, b: -7.78 },
    { chroma: 4, a: 7.94, b: -15.44 },
    { chroma: 6, a: 12.49, b: -23.15 },
    { chroma: 8, a: 17.20, b: -30.44 },
    { chroma: 12, a: 28.68, b: -44.75 },
    { chroma: 14, a: 34.72, b: -51.82 },
    { chroma: 18, a: 48.95, b: -64.02 },
    { chroma: 27, a: 79.81, b: -90.05 },
  ],
  '5P': [
    { chroma: 1, a: 3.35, b: -3.52 },
    { chroma: 2, a: 6.26, b: -6.55 },
    { chroma: 4, a: 12.50, b: -12.77 },
    { chroma: 6, a: 18.84, b: -18.82 },
    { chroma: 8, a: 25.33, b: -24.67 },
    { chroma: 12, a: 39.07, b: -36.24 },
    { chroma: 14, a: 46.04, b: -41.76 },
    { chroma: 18, a: 59.37, b: -52.11 },
    { chroma: 26, a: 88.32, b: -72.68 },
  ],
  '10P': [
    { chroma: 1, a: 4.13, b: -2.05 },
    { chroma: 2, a: 7.88, b: -3.96 },
    { chroma: 4, a: 15.76, b: -7.96 },
    { chroma: 6, a: 23.80, b: -12.02 },
    { chroma: 8, a: 31.77, b: -16.11 },
    { chroma: 12, a: 47.33, b: -24.08 },
    { chroma: 18, a: 69.27, b: -34.49 },
    { chroma: 22, a: 85.81, b: -42.52 },
  ],
  '5RP': [
    { chroma: 1, a: 4.34, b: -0.36 },
    { chroma: 2, a: 8.67, b: -0.83 },
    { chroma: 4, a: 17.50, b: -1.82 },
    { chroma: 6, a: 26.63, b: -2.96 },
    { chroma: 8, a: 35.50, b: -4.19 },
    { chroma: 10, a: 43.49, b: -5.46 },
    { chroma: 12, a: 52.83, b: -7.72 },
    { chroma: 18, a: 77.09, b: -10.24 },
  ],
};

/**
 * Parses a chromatic Munsell hue string (e.g., "2.5YR", "10YR", "7.5BG")
 * into a continuous hue angle in [0, 100) around the 10-family Munsell circle
 * (R: 0-10, YR: 10-20, Y: 20-30, GY: 30-40, G: 40-50, BG: 50-60, B: 60-70,
 * PB: 70-80, P: 80-90, RP: 90-100, with 10RP wrapping to 0).
 * @param hue Munsell hue string
 * @returns Hue angle in [0, 100) or null if invalid/out of range
 */
export function parseMunsellHueAngle(hue: string): number | null {
  if (typeof hue !== 'string') {
    return null;
  }

  const normalized = hue.trim().replace(/\s+/g, '').toUpperCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?|\.\d+)(YR|GY|BG|PB|RP|R|Y|G|B|P)$/);
  if (!match) {
    return null;
  }

  const num = Number(match[1]);
  const family = match[2] as (typeof HUE_FAMILIES)[number];
  if (!Number.isFinite(num) || num <= 0 || num > 10) {
    return null;
  }

  const familyIndex = HUE_FAMILIES.indexOf(family);
  const angle = familyIndex * 10 + num;
  return angle >= 100 ? angle - 100 : angle;
}

/**
 * Piecewise-linearly interpolates CIELAB a* and b* across chroma for a single hue anchor.
 */
function interpolateChromaLab(points: ChromaPoint[], chroma: number): { a: number; b: number } {
  if (chroma === 0) {
    return { a: 0, b: 0 };
  }

  const first = points[0];
  if (chroma <= first.chroma) {
    const t = chroma / first.chroma;
    return { a: first.a * t, b: first.b * t };
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (chroma <= p1.chroma) {
      const t = (chroma - p0.chroma) / (p1.chroma - p0.chroma);
      return {
        a: p0.a + t * (p1.a - p0.a),
        b: p0.b + t * (p1.b - p0.b),
      };
    }
  }

  const p0 = points[points.length - 2];
  const p1 = points[points.length - 1];
  const t = (chroma - p0.chroma) / (p1.chroma - p0.chroma);
  return {
    a: p0.a + t * (p1.a - p0.a),
    b: p0.b + t * (p1.b - p0.b),
  };
}

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
 * Interpolates CIELAB a* and b* values for any valid chromatic Munsell hue and chroma
 * using circular hue-angle interpolation between the two bracketing hue anchors.
 * @param hue Munsell Hue (e.g., '5R', '10YR', '2.5Y', '7.5BG')
 * @param chroma Munsell Chroma (>= 0)
 * @returns an object with a and b properties, or null if hue or chroma is invalid.
 */
export function interpolateLab(hue: string, chroma: number): { a: number; b: number } | null {
  const angle = parseMunsellHueAngle(hue);
  if (angle === null || !Number.isFinite(chroma) || chroma < 0) {
    return null;
  }

  if (chroma === 0) {
    return { a: 0, b: 0 };
  }

  const scaled = angle / HUE_ANCHOR_STEP;
  const baseIdx = Math.floor(scaled);
  const idx0 = baseIdx % HUE_ANCHOR_ORDER.length;
  const idx1 = (idx0 + 1) % HUE_ANCHOR_ORDER.length;
  const t = scaled - baseIdx;

  const ab0 = interpolateChromaLab(hueData[HUE_ANCHOR_ORDER[idx0]], chroma);
  if (t === 0) {
    return ab0;
  }

  const ab1 = interpolateChromaLab(hueData[HUE_ANCHOR_ORDER[idx1]], chroma);
  return {
    a: ab0.a + t * (ab1.a - ab0.a),
    b: ab0.b + t * (ab1.b - ab0.b),
  };
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
  if (typeof munsellString !== 'string') {
    return null;
  }

  const parts = munsellString.trim().split(/ +/);
  if (parts.length !== 2) {
    return null;
  }

  const hue = parts[0].toUpperCase();
  const vc = parts[1].split('/');
  if (vc.length !== 2) {
    return null;
  }

  const valueStr = vc[0].trim();
  let chromaStr = vc[1].trim();

  const isNeutral = hue === 'N';
  if (isNeutral && (chromaStr === '' || chromaStr === '-')) {
    chromaStr = '0';
  }

  if (valueStr === '' || chromaStr === '') {
    return null;
  }

  const value = Number(valueStr);
  const chroma = Number(chromaStr);

  if (!Number.isFinite(value) || !Number.isFinite(chroma) || value < 0 || value > 10 || chroma < 0) {
    return null;
  }

  // 1. Munsell Value to Y
  const Y = Math.max(0, munsellValueToY(value));

  // 2. Interpolate a* and b*
  const lab_ab = isNeutral ? { a: 0, b: 0 } : interpolateLab(hue, chroma);
  if (!lab_ab) {
    return null;
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
