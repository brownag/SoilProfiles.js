"""Shared helpers for Munsell approximation experiments (scratch only)."""
import csv, re, math
import numpy as np

FAMS = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP']
ANCH = ['10RP', '5R', '10R', '5YR', '10YR', '5Y', '10Y', '5GY', '10GY', '5G',
        '10G', '5BG', '10BG', '5B', '10B', '5PB', '10PB', '5P', '10P', '5RP']


def hue_angle(h):
    m = re.match(r'^(\d+(?:\.\d+)?)(YR|GY|BG|PB|RP|R|Y|G|B|P)$', h)
    a = FAMS.index(m.group(2)) * 10 + float(m.group(1))
    return a - 100 if a >= 100 else a


def d1535_Y(V):
    return (1.2219 * V - 0.23111 * V**2 + 0.23951 * V**3 - 0.021009 * V**4 + 0.0008404 * V**5) / 100


def L_from_Y(Y):
    Y = np.asarray(Y, float)
    return np.where(Y > 216 / 24389, 116 * np.cbrt(Y) - 16, Y * 24389 / 27)


WP = np.array([0.95047, 1.0, 1.08883])
M_RGB = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
M_XYZ = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
# Bradford C -> D65 (Lindbloom), column-vector convention
M_C2D65 = np.array([[0.9904476, -0.0071683, -0.0116156],
                    [-0.0123712, 1.0155950, -0.0029282],
                    [-0.0035635, 0.0067697, 0.9181569]])


def lab_to_rgb(L, a, b):
    """CIELAB(D65) -> clipped sRGB in [0,1], mirrors src/utils/munsell-approx.ts."""
    fy = (L + 16) / 116
    fx = a / 500 + fy
    fz = fy - b / 200
    d = 6 / 29
    finv = lambda t: np.where(t > d, t**3, (t - 16 / 116) / 7.787)
    xyz = np.stack([finv(fx) * WP[0], finv(fy) * WP[1], finv(fz) * WP[2]], -1)
    lin = xyz @ M_RGB.T
    g = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.abs(lin) ** (1 / 2.4) * np.sign(lin) - 0.055)
    return np.clip(g, 0, 1)


def quant(rgb):
    return np.round(rgb * 255) / 255


def rgb_to_lab(rgb):
    rgb = np.asarray(rgb, float)
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    xyz = lin @ M_XYZ.T / WP
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def de76(l1, l2):
    return np.linalg.norm(np.asarray(l1) - np.asarray(l2), axis=-1)


def de2000(l1, l2):
    """CIEDE2000 per Sharma, Wu & Dalal (2005), kL=kC=kH=1."""
    l1 = np.asarray(l1, float); l2 = np.asarray(l2, float)
    L1, a1, b1 = l1[..., 0], l1[..., 1], l1[..., 2]
    L2, a2, b2 = l2[..., 0], l2[..., 1], l2[..., 2]
    C1 = np.hypot(a1, b1); C2 = np.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb**7 / (Cb**7 + 25.0**7)))
    a1p = (1 + G) * a1; a2p = (1 + G) * a2
    C1p = np.hypot(a1p, b1); C2p = np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    h1p = np.where(C1p == 0, 0, h1p); h2p = np.where(C2p == 0, 0, h2p)
    dLp = L2 - L1; dCp = C2p - C1p
    dh = h2p - h1p
    dh = np.where(C1p * C2p == 0, 0, np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh)))
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lbp = (L1 + L2) / 2; Cbp = (C1p + C2p) / 2
    hs = h1p + h2p
    hbp = np.where(C1p * C2p == 0, hs,
                   np.where(np.abs(h1p - h2p) <= 180, hs / 2, np.where(hs < 360, (hs + 360) / 2, (hs - 360) / 2)))
    T = (1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp))
         + 0.32 * np.cos(np.radians(3 * hbp + 6)) - 0.20 * np.cos(np.radians(4 * hbp - 63)))
    dth = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    RC = 2 * np.sqrt(Cbp**7 / (Cbp**7 + 25.0**7))
    SL = 1 + 0.015 * (Lbp - 50) ** 2 / np.sqrt(20 + (Lbp - 50) ** 2)
    SC = 1 + 0.045 * Cbp; SH = 1 + 0.015 * Cbp * T
    RT = -np.sin(np.radians(2 * dth)) * RC
    return np.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))


def load_aqp(path):
    rows = list(csv.DictReader(open(path)))
    H = np.array([r['hue'] for r in rows]); V = np.array([float(r['value']) for r in rows])
    C = np.array([float(r['chroma']) for r in rows])
    rgb = np.array([[float(r['r']), float(r['g']), float(r['b'])] for r in rows])
    lab = np.array([[float(r['L']), float(r['A']), float(r['B'])] for r in rows])
    return H, V, C, rgb, lab


def load_renotation(path):
    """RIT all.dat (xyY, Illuminant C) -> unclipped CIELAB D65 with Y/100 (no min rescale)."""
    H, V, C, xyY = [], [], [], []
    for line in open(path).read().split('\n')[1:]:
        p = line.split()
        if len(p) != 6: continue
        H.append(p[0]); V.append(float(p[1])); C.append(float(p[2])); xyY.append([float(t) for t in p[3:]])
    xyY = np.array(xyY); x, y, Y = xyY[:, 0], xyY[:, 1], xyY[:, 2] / 100
    XYZ = np.stack([x * Y / y, Y, (1 - x - y) * Y / y], -1) @ M_C2D65.T
    f = lambda t: np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)
    fx, fy, fz = f(XYZ[:, 0] / WP[0]), f(XYZ[:, 1]), f(XYZ[:, 2] / WP[2])
    lab = np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)
    return np.array(H), np.array(V), np.array(C), lab


def parse_current_hue_data(ts_path):
    src = open(ts_path).read()
    body = src[src.index('export const hueData'):src.index('};', src.index('export const hueData'))]
    data = {}
    for m in re.finditer(r"'([0-9.A-Z]+)':\s*\[(.*?)\]", body, re.S):
        pts = [(float(c), float(a), float(b)) for c, a, b in re.findall(r'chroma:\s*([\d.]+),\s*a:\s*([-\d.]+),\s*b:\s*([-\d.]+)', m.group(2))]
        data[m.group(1)] = np.array(pts)
    return data


def interp_chroma(pts, c):
    ch, a, b = pts[:, 0], pts[:, 1], pts[:, 2]
    if c <= ch[0]:
        t = c / ch[0]; return a[0] * t, b[0] * t
    for i in range(len(ch) - 1):
        if c <= ch[i + 1]:
            t = (c - ch[i]) / (ch[i + 1] - ch[i]); return a[i] + t * (a[i + 1] - a[i]), b[i] + t * (b[i + 1] - b[i])
    t = (c - ch[-2]) / (ch[-1] - ch[-2]); return a[-2] + t * (a[-1] - a[-2]), b[-2] + t * (b[-1] - b[-2])


def current_lab(hd, h, v, c):
    L = float(L_from_Y(max(0.0, d1535_Y(v))))
    if h == 'N' or c == 0: return L, 0.0, 0.0
    s = hue_angle(h) / 5; i0 = int(math.floor(s)) % 20; i1 = (i0 + 1) % 20; t = s - math.floor(s)
    a0, b0 = interp_chroma(hd[ANCH[i0]], c); a1, b1 = interp_chroma(hd[ANCH[i1]], c)
    return L, a0 + t * (a1 - a0), b0 + t * (b1 - b0)


def to_hex(rgb):
    q = np.round(np.asarray(rgb) * 255).astype(int)
    return '#' + ''.join(f'{x:02x}' for x in q)
