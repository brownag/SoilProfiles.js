/**
 * This file provides an approximate conversion from Munsell to sRGB.
 * It is a fitted model, not a substitute for a full color management system.
 *
 * The conversion is done in the following steps:
 * 1. Munsell Value to CIEXYZ Y (Newhall, Nickerson & Judd 1943 polynomial, MgO-relative)
 * 2. Munsell Hue and Chroma to CIELAB a* and b* (per-anchor cubic polynomial in Value and Chroma,
 *    with coefficients blended linearly between the two bracketing 5-unit hue anchors)
 * 3. CIELAB to CIEXYZ (cube root of Y for fy; linear branch below 6/29 for x, y, z)
 * 4. CIEXYZ to sRGB
 */

const HUE_FAMILIES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'] as const;
const HUE_ANCHOR_STEP = 5;
const HUE_ANCHOR_ORDER = [
  '10RP', '5R', '10R', '5YR', '10YR', '5Y', '10Y', '5GY', '10GY', '5G',
  '10G', '5BG', '10BG', '5B', '10B', '5PB', '10PB', '5P', '10P', '5RP',
] as const;

// a* and b* polynomial coefficients for each hue anchor (order: HUE_ANCHOR_ORDER), fitted to the
// Munsell renotation data. See docs/research/munsell-approximation.md.
// Generated from scripts/munsell-ab-polynomial-coefficients.json.
// Basis: [C, C*V, C*V^2, C*V^3, C^2, C^2*V, C^2*V^2, C^3].
const COEF_A: readonly number[][] = [
  [5.196844, 0.406557, -0.162569, 0.010938, -0.103115, 0.014287, 0.000745, 0.000984],
  [5.524829, 0.146316, -0.106951, 0.007663, -0.106511, 0.008977, 0.001028, 0.002073],
  [5.032638, -0.032925, -0.042646, 0.003071, -0.00733, -0.019232, 0.002751, 0.000459],
  [4.613493, -0.502788, 0.069544, -0.00433, -0.032816, -0.0138, 0.002218, -0.00126],
  [2.72618, -0.251772, 0.004896, -0.000188, -0.09107, 0.030701, -0.001109, -0.004642],
  [0.480188, -0.339347, 0.024668, -0.001412, 0.115557, 0.007776, 1.1e-05, -0.006891],
  [-1.674294, -0.124528, -0.003764, 0.000573, 0.115272, 0.007958, -0.000641, -0.002706],
  [-3.744349, 0.258257, -0.072141, 0.004298, -0.022799, 0.03126, -0.001999, 2.4e-05],
  [-4.373451, -0.144677, 0.029871, -0.004023, -0.027923, -0.000695, 0.001766, -0.001117],
  [-4.643072, -0.327214, 0.065113, -0.006316, 0.037033, -0.015139, 0.002901, -0.0034],
  [-4.766313, -0.300107, 0.061051, -0.005976, 0.063517, -0.01395, 0.002603, -0.004459],
  [-4.226481, -0.207814, 0.030208, -0.003569, -0.040512, 0.003115, 0.001012, -0.001001],
  [-3.067494, -0.406543, 0.046385, -0.003141, -0.071134, 0.024107, -0.001331, -0.002086],
  [-1.958724, -0.630798, 0.102006, -0.006357, 0.013815, 0.020208, -0.002001, -0.00237],
  [-0.711304, -0.542056, 0.097368, -0.006088, 0.057057, 0.001879, -0.001064, -0.000181],
  [0.69964, -0.23111, 0.034789, -0.002283, 0.133814, -0.046184, 0.003633, 0.001959],
  [2.964675, 0.020381, -0.075025, 0.005005, 0.078233, -0.02411, 0.003829, -0.000949],
  [3.919279, 0.310197, -0.134782, 0.008348, -0.015984, -0.014162, 0.003572, 0.000293],
  [4.523831, 0.293028, -0.121786, 0.007859, -0.045898, 0.004165, 0.001667, -0.001214],
  [5.077056, 0.299216, -0.132401, 0.008843, -0.089199, 0.018033, 0.000424, -0.000739],
];

const COEF_B: readonly number[][] = [
  [-2.198822, 1.484872, -0.224612, 0.010878, -0.007496, -0.00228, 0.000767, -0.001041],
  [-0.902165, 1.689568, -0.29493, 0.015565, -0.038328, 0.013703, -0.000134, -0.001589],
  [0.83345, 1.57507, -0.31753, 0.019569, -0.116643, 0.069489, -0.005461, -0.002138],
  [3.248946, 1.201408, -0.276427, 0.018856, -0.143099, 0.086295, -0.0076, -0.002123],
  [5.036106, 0.879544, -0.174611, 0.011413, -0.158798, 0.050029, -0.004652, 0.001874],
  [5.294331, 1.039006, -0.170965, 0.009712, -0.092064, 0.024451, -0.002358, -0.000273],
  [4.54739, 1.184625, -0.166439, 0.008428, 0.022851, 0.004354, -0.000934, -0.00285],
  [2.817546, 1.782219, -0.329874, 0.020832, -0.163739, 0.078092, -0.007344, 0.000726],
  [1.891388, 0.893918, -0.161719, 0.011151, -0.106566, 0.053133, -0.005119, -0.000468],
  [1.445612, 0.126728, -0.005477, 0.000811, -0.096911, 0.008894, -0.000877, 0.001258],
  [0.18024, 0.218547, -0.021737, 0.001278, -0.073051, 0.006569, -0.000654, 0.001719],
  [-1.750589, 0.365416, -0.027576, 0.000966, -0.033197, -0.006986, 0.00032, 0.002771],
  [-3.294964, 0.247702, 0.022206, -0.003303, 0.04369, -0.033269, 0.002612, 0.003009],
  [-4.12633, 0.38974, -0.027197, 0.000359, -0.051618, -0.015094, 0.000977, 0.004287],
  [-4.513625, 0.000491, 0.053892, -0.004044, -0.006998, 0.003442, -0.001801, 0.001016],
  [-4.592672, -0.250052, 0.11338, -0.007437, -0.006051, 0.009678, -0.003266, 0.002184],
  [-4.110018, -0.616307, 0.19033, -0.011662, 0.066554, 0.002057, -0.003679, 0.002446],
  [-3.375922, -0.487803, 0.136359, -0.007815, 0.073493, 0.009607, -0.003211, -0.00058],
  [-3.29188, 0.166148, 0.03891, -0.003568, 0.060614, -0.014557, 4.3e-05, 0.000423],
  [-2.93734, 0.971299, -0.110881, 0.004241, 0.030929, -0.014353, 0.00104, -0.000294],
];

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
 * Converts a Munsell Value to CIEXYZ Y coordinate.
 * Newhall, Nickerson & Judd (1943) MgO-relative polynomial. This is not the
 * ASTM D1535-08 formula (which uses 1.1914...).
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
 * Converts CIELAB color to CIEXYZ, given fy = (L+16)/116 (computed as cbrt(Y)).
 * Assumes D65 reference white.
 */
function labToXyz(fy: number, a: number, b: number): { x: number; y: number; z: number } {
  const delta = 6 / 29;

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
 * Converts a normalized Munsell hue, value and chroma to an sRGB hex string.
 * @param hue Uppercase Munsell hue (e.g., '5R', '10YR', '2.5Y'), or 'N' for neutral
 * @param value Munsell Value (0-10)
 * @param chroma Munsell Chroma (>= 0)
 * @returns sRGB hex string (e.g., '#8b6f47') or null if the input is invalid.
 */
export function munsellToHexApprox(hue: string, value: number, chroma: number): string | null {
  if (!Number.isFinite(value) || !Number.isFinite(chroma) || value < 0 || value > 10 || chroma < 0) {
    return null;
  }

  // 2. Hue and chroma to a* and b*
  let a = 0;
  let b = 0;
  if (hue !== 'N') {
    const angle = parseMunsellHueAngle(hue);
    if (angle === null) {
      return null;
    }

    if (chroma > 0) {
      const scaled = angle / HUE_ANCHOR_STEP;
      const i0 = Math.floor(scaled) % HUE_ANCHOR_ORDER.length;
      const i1 = (i0 + 1) % HUE_ANCHOR_ORDER.length;
      const t = (angle - HUE_ANCHOR_STEP * i0) / HUE_ANCHOR_STEP;

      const Cc = Math.min(chroma, 12);
      const V = value;
      const basis = [Cc, Cc * V, Cc * V * V, Cc * V * V * V, Cc * Cc, Cc * Cc * V, Cc * Cc * V * V, Cc * Cc * Cc];
      const dot = (row: readonly number[]) => row.reduce((s, c, k) => s + c * basis[k], 0);

      a = (1 - t) * dot(COEF_A[i0]) + t * dot(COEF_A[i1]);
      b = (1 - t) * dot(COEF_B[i0]) + t * dot(COEF_B[i1]);
      if (chroma > 12) {
        a *= chroma / 12;
        b *= chroma / 12;
      }
    }
  }

  // 1. Munsell Value to Y, then cube root for fy
  const Y = Math.max(0, munsellValueToY(value));
  const fy = Math.cbrt(Y);

  // 3. CIELAB to CIEXYZ
  const xyz = labToXyz(fy, a, b);

  // 4. CIEXYZ to sRGB
  const rgb = xyzToRgb(xyz);

  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const bl = Math.round(rgb.b * 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
