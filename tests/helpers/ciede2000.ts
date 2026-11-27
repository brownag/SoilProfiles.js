/**
 * Test-only colour helpers: sRGB hex to CIELAB (D65) and CIEDE2000 colour difference.
 * Ported from scripts/munsell_color.py (rgb_to_lab, de2000). Not used by src/.
 */

export type Lab = [number, number, number];

// sRGB (linear) -> XYZ, row-major; applied as M · lin.
const M_XYZ = [
  [0.4124, 0.3576, 0.1805],
  [0.2126, 0.7152, 0.0722],
  [0.0193, 0.1192, 0.9505],
];
const WP = [0.95047, 1.0, 1.08883];
const EPS = 216 / 24389;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  return t > EPS ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

/** Convert '#rrggbb' (leading '#' optional) to D65 CIELAB. Throws on anything else. */
export function hexToLab(hex: string): Lab {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`hexToLab: invalid hex colour '${hex}'`);
  const n = parseInt(m[1], 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255));
  const xyz = M_XYZ.map((row, i) => (row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]) / WP[i]);
  const fx = labF(xyz[0]);
  const fy = labF(xyz[1]);
  const fz = labF(xyz[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** CIEDE2000 colour difference per Sharma, Wu & Dalal (2005), kL = kC = kH = 1. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const mod360 = (x: number) => ((x % 360) + 360) % 360;
  const h1p = C1p === 0 ? 0 : mod360(deg(Math.atan2(b1, a1p)));
  const h2p = C2p === 0 ? 0 : mod360(deg(Math.atan2(b2, a2p)));

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) {
    hbp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbp = (h1p + h2p) / 2;
  } else {
    hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos(rad(hbp - 30))
    + 0.24 * Math.cos(rad(2 * hbp))
    + 0.32 * Math.cos(rad(3 * hbp + 6))
    - 0.20 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(rad(2 * dTheta)) * RC;

  return Math.sqrt(
    Math.pow(dLp / SL, 2)
      + Math.pow(dCp / SC, 2)
      + Math.pow(dHp / SH, 2)
      + RT * (dCp / SC) * (dHp / SH),
  );
}
