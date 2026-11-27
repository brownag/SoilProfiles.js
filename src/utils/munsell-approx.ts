/**
 * This file provides an approximate conversion from Munsell to sRGB.
 * It is a fitted model, not a substitute for a full color management system.
 *
 * The conversion is done in the following steps:
 * 1. Munsell Value to CIEXYZ Y (Newhall, Nickerson & Judd 1943 polynomial, MgO-relative)
 * 2. Munsell Hue and Chroma to CIELAB a* and b* (per-anchor polynomial in Value and Chroma with a
 *    low-value hinge term, coefficients blended linearly between the two bracketing 5-unit hue anchors)
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
// Generated from scripts/munsell-ab-hinge-coefficients.json (fit on all points).
// Flat, row-major: 9 coefficients per hue anchor, in HUE_ANCHOR_ORDER (anchor index i at offset 9*i).
// Basis: [C, C*V, C*V^2, C*V^3, C^2, C^2*V, C^2*V^2, C^3, C*max(0,3-V)^2].
const COEF_A: readonly number[] = [
  5.486239, 0.413875, -0.181425, 0.012823, -0.224254, 0.040777, -0.001388, 0.004479, 0.096709, // 10RP
  6.081997, -0.055136, -0.08994, 0.007718, -0.209018, 0.035852, -0.001218, 0.004727, 0.040559, // 5R
  4.436952, 0.46771, -0.145492, 0.009454, -0.120552, 0.007639, 0.000523, 0.003365, 0.230653, // 10R
  3.181897, 0.353029, -0.08432, 0.004347, -0.088271, 0.002914, 0.00073, -0.000275, 0.333775, // 5YR
  1.190998, 0.417624, -0.085624, 0.00367, -0.015055, 0.007871, 0.000528, -0.004869, 0.31761, // 10YR
  -0.035639, -0.13077, -0.000828, -0.000451, 0.161501, -0.006062, 0.000983, -0.00698, 0.094509, // 5Y
  -1.143423, -0.348311, 0.025684, -0.000614, 0.083079, 0.017093, -0.001326, -0.002461, -0.07111, // 10Y
  -1.440749, -0.706705, 0.061082, -0.001329, -0.17104, 0.064073, -0.004509, 0.00293, -0.30722, // 5GY
  -0.980424, -1.649365, 0.238653, -0.013143, -0.16238, 0.034601, -0.000782, 0.000525, -0.413885, // 10GY
  -0.751407, -2.050192, 0.303971, -0.016607, -0.137462, 0.027598, -0.000322, -0.000212, -0.449962, // 5G
  -0.999525, -2.009154, 0.305033, -0.016799, -0.099316, 0.022622, -0.000183, -0.000638, -0.441552, // 10G
  -0.986149, -1.805165, 0.265995, -0.014348, -0.127169, 0.031302, -0.001216, -0.000172, -0.413353, // 5BG
  -1.67123, -1.075068, 0.143085, -0.007395, -0.12108, 0.038957, -0.00262, -0.001192, -0.190621, // 10BG
  -1.439662, -0.96778, 0.167567, -0.009942, 0.017209, 0.016003, -0.001952, -0.001323, -0.092819, // 5B
  -0.615877, -0.634713, 0.117241, -0.007238, 0.068216, 0.000729, -0.001135, -0.000425, -0.029784, // 10B
  0.017072, 0.221919, -0.049416, 0.002205, 0.134278, -0.051031, 0.004374, 0.002298, 0.078629, // 5PB
  3.624702, -0.341977, -0.017456, 0.002384, 0.030892, -0.009944, 0.002495, 0.000297, -0.027983, // 10PB
  4.554991, 0.051896, -0.107527, 0.007896, -0.115701, 0.014471, 0.001122, 0.002435, 0.042161, // 5P
  5.545965, -0.079414, -0.079187, 0.006649, -0.173445, 0.030498, -0.000383, 0.002526, -0.006981, // 10P
  5.933917, 0.034821, -0.107265, 0.008456, -0.219898, 0.042843, -0.001469, 0.003341, 0.014078, // 5RP
];

const COEF_B: readonly number[] = [
  -2.342856, 1.598345, -0.240623, 0.011452, -0.000954, -0.010168, 0.00154, -0.000665, -0.001648, // 10RP
  0.100124, 1.11586, -0.203804, 0.01132, -0.058121, 0.025201, -0.001257, -0.001772, -0.105817, // 5R
  1.748046, 0.997594, -0.213658, 0.013927, -0.112224, 0.07022, -0.005658, -0.001958, -0.144905, // 10R
  3.933257, 0.447897, -0.13126, 0.010844, -0.016887, 0.076522, -0.007334, -0.006191, -0.172311, // 5YR
  3.866319, 1.153416, -0.195285, 0.011596, 0.030075, 0.015268, -0.002223, -0.002613, 0.1524, // 10YR
  4.816097, 0.807157, -0.102701, 0.005235, 0.16704, -0.019282, 0.00051, -0.006647, 0.015669, // 5Y
  4.542833, 0.746075, -0.059339, 0.002129, 0.244924, -0.051461, 0.002333, -0.002408, -0.111241, // 10Y
  1.301764, 1.95981, -0.291816, 0.016727, 0.092439, 0.013222, -0.00321, -0.001177, 0.207725, // 5GY
  0.175071, 1.585933, -0.238932, 0.01374, -0.018997, 0.023138, -0.003051, -0.000366, 0.200568, // 10GY
  0.366581, 0.633825, -0.077376, 0.00393, -0.0464, -0.004626, 0.000178, 0.000306, 0.11497, // 5G
  0.338174, 0.088254, -0.003017, 0.000527, -0.065331, 0.011231, -0.001093, 0.000871, -0.016423, // 10G
  -0.26203, -0.41452, 0.087656, -0.004216, -0.069996, 0.010223, -0.001099, 0.002587, -0.172112, // 5BG
  -1.447135, -0.58029, 0.134322, -0.007944, -0.048161, -0.00649, 0.000559, 0.004061, -0.204266, // 10BG
  -3.607751, 0.096962, 0.024689, -0.002294, -0.078859, -0.009774, 0.000339, 0.005534, -0.036911, // 5B
  -4.666181, 0.00753, 0.07047, -0.005541, 0.003318, -0.005991, -0.001323, 0.00237, 0.01043, // 10B
  -5.310172, 0.010882, 0.089627, -0.00689, 0.040077, -0.000707, -0.002843, 0.001441, 0.0587, // 5PB
  -5.098546, -0.213717, 0.13338, -0.009288, 0.176165, -0.018284, -0.002065, -0.001093, 0.018602, // 10PB
  -4.171949, -0.208798, 0.105376, -0.007059, 0.189248, -0.015297, -0.001183, -0.003872, -0.018101, // 5P
  -3.574272, 0.220556, 0.04247, -0.004411, 0.138673, -0.032821, 0.001509, -0.001715, -0.050898, // 10P
  -2.768905, 0.897149, -0.091335, 0.002721, 0.0625, -0.029522, 0.002421, -0.000554, -0.081719, // 5RP
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
 * CIELAB f^-1 (inverse of the CIELAB companding function), with the linear branch below 6/29.
 */
function f_inv(t: number): number {
  const delta = 6 / 29;
  if (t > delta) {
    return t * t * t;
  }
  return (t - 16 / 116) / 7.787;
}

/**
 * sRGB gamma companding for a linear channel value.
 */
function gamma_correct(c: number): number {
  if (c <= 0.0031308) {
    return 12.92 * c;
  }
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * Clamps a channel value to [0, 1].
 */
function clamp(c: number): number {
  return Math.max(0, Math.min(1, c));
}

/**
 * Dot product of one coefficient row with the basis terms, as explicit scalar sums (no allocation).
 */
function dot9(
  row: readonly number[],
  o: number,
  c0: number, c1: number, c2: number, c3: number, c4: number,
  c5: number, c6: number, c7: number, c8: number
): number {
  return row[o] * c0 + row[o + 1] * c1 + row[o + 2] * c2 + row[o + 3] * c3 + row[o + 4] * c4 +
    row[o + 5] * c5 + row[o + 6] * c6 + row[o + 7] * c7 + row[o + 8] * c8;
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
      const CV = Cc * V;
      const CV2 = CV * V;
      const CV3 = CV2 * V;
      const CC = Cc * Cc;
      const CCV = CC * V;
      const CCV2 = CCV * V;
      const CCC = CC * Cc;
      const hinge = Math.max(0, 3 - V);
      const CH = Cc * hinge * hinge;

      a = (1 - t) * dot9(COEF_A, i0 * 9, Cc, CV, CV2, CV3, CC, CCV, CCV2, CCC, CH) +
        t * dot9(COEF_A, i1 * 9, Cc, CV, CV2, CV3, CC, CCV, CCV2, CCC, CH);
      b = (1 - t) * dot9(COEF_B, i0 * 9, Cc, CV, CV2, CV3, CC, CCV, CCV2, CCC, CH) +
        t * dot9(COEF_B, i1 * 9, Cc, CV, CV2, CV3, CC, CCV, CCV2, CCC, CH);
      if (chroma > 12) {
        a *= chroma / 12;
        b *= chroma / 12;
      }
    }
  }

  // 1. Munsell Value to Y, then cube root for fy
  const Y = Math.max(0, munsellValueToY(value));
  const fy = Math.cbrt(Y);

  // 3. CIELAB to CIEXYZ (D65 reference white); inlined, no intermediate objects
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const xr = f_inv(fx);
  const yr = f_inv(fy);
  const zr = f_inv(fz);

  // D65 reference white
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;

  const x = (xr * Xn) / 100; // Scale to 0-1
  const y = (yr * Yn) / 100;
  const z = (zr * Zn) / 100;

  // 4. CIEXYZ to sRGB (inlined)
  const r_linear = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const g_linear = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const b_linear = x * 0.0557 + y * -0.2040 + z * 1.0570;

  const r = clamp(gamma_correct(r_linear));
  const g = clamp(gamma_correct(g_linear));
  const bl_out = clamp(gamma_correct(b_linear));

  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(bl_out * 255);
  return '#' + ((1 << 24) | (ri << 16) | (gi << 8) | bi).toString(16).slice(1);
}
