"""Experiment 1: compare Munsell->sRGB approximation models on soil domains.

usage: python3 -I exp1.py <expdir> <aqp_munsell.csv> <all.dat> <osd_colors.csv> <munsell-approx.ts>
"""
import sys, csv, math, json, gzip, collections
sys.path.insert(0, sys.argv[1])
import numpy as np
from scipy.sparse import lil_matrix, vstack, identity
from scipy.sparse.linalg import lsqr
import mlib as M

aqpH, aqpV, aqpC, aqpRGB, _ = M.load_aqp(sys.argv[2])
rH, rV, rC, rLab = M.load_renotation(sys.argv[3])
ok = np.isfinite(rLab).all(1) & (rV >= 1)
rH, rV, rC, rLab = rH[ok], rV[ok], rC[ok], rLab[ok]
REN = {(h, v, c): l for h, v, c, l in zip(rH, rV, rC, rLab)}
HUES40 = [f'{n}{f}' for f in M.FAMS for n in ('2.5', '5', '7.5', '10')]
ANG = {h: M.hue_angle(h) for h in HUES40}

# OSD frequency weights snapped to aqp chips
osd = collections.Counter()
for r in csv.DictReader(open(sys.argv[4])):
    osd[(r['hue'], float(r['value']), float(r['chroma']))] += int(r['n'])

hd = M.parse_current_hue_data(sys.argv[5])

# ---------------------------------------------------------------- domains
TYP = {'10R', '2.5YR', '5YR', '7.5YR', '10YR', '2.5Y', '5Y'}
GLEY1 = {'10Y', '5GY', '10GY', '5G'}
GLEY2 = {'10G', '5BG', '10BG', '5B', '10B', '5PB'}
chrom = aqpH != 'N'
dom = {
    'typical (10R-5Y, V2-8, C1-8)': chrom & np.isin(aqpH, list(TYP)) & (aqpV >= 2) & (aqpV <= 8) & (aqpC <= 8),
    'gley (10Y-5G C1-4, 10G-5PB C1-2; V2-8)': chrom & (aqpV >= 2) & (aqpV <= 8) & ((np.isin(aqpH, list(GLEY1)) & (aqpC <= 4)) | (np.isin(aqpH, list(GLEY2)) & (aqpC <= 2))),
    'red pages 5R/7.5R V2-8 C1-8': np.isin(aqpH, ['5R', '7.5R']) & (aqpV >= 2) & (aqpV <= 8) & (aqpC <= 8),
    'high chroma 10R-5Y C8-14': np.isin(aqpH, list(TYP)) & (aqpC >= 8) & (aqpC <= 14),
    'dark V1-2.5 soil hues C1-4': np.isin(aqpH, list(TYP | GLEY1)) & (aqpV <= 2.5) & (aqpC <= 4),
    'light V8.5-9.5 7.5YR-5Y C1-4': np.isin(aqpH, ['7.5YR', '10YR', '2.5Y', '5Y']) & (aqpV >= 8.5) & (aqpC <= 4),
    'redox conc. 2.5YR-10YR V3-7 C6-8': np.isin(aqpH, ['2.5YR', '5YR', '7.5YR', '10YR']) & (aqpV >= 3) & (aqpV <= 7) & (aqpC >= 6) & (aqpC <= 8),
    'all chromatic aqp rows': chrom,
}
wOSD = np.array([osd.get((h, v, c), 0) for h, v, c in zip(aqpH, aqpV, aqpC)], float)
wOSD[~chrom] = 0
refAQP = M.rgb_to_lab(aqpRGB)
# renotation-based rendered reference (integer V, even C rows that exist in all.dat)
renIdx = np.array([(h, v, c) in REN for h, v, c in zip(aqpH, aqpV, aqpC)]) & chrom
refREN = np.full_like(refAQP, np.nan)
labs = np.array([REN[(h, v, c)] for h, v, c, k in zip(aqpH, aqpV, aqpC, renIdx) if k])
refREN[renIdx] = M.rgb_to_lab(M.quant(M.lab_to_rgb(labs[:, 0], labs[:, 1], labs[:, 2])))


# munsellinterpol (bicubic hue/chroma, cubic value) reference; Y rescaled x1.0257 to the Newhall/renotation
# value scale used by the library so that the comparison isolates chromatic error
MI = {}
for r in csv.DictReader(open(sys.argv[1] + '/mi_xyY.csv')):
    MI[(r['hue'], float(r['value']), float(r['chroma']))] = (float(r['x']), float(r['y']), float(r['Y']))
def xyY_to_lab(x, y, Y):
    XYZ = np.array([x * Y / y, Y, (1 - x - y) * Y / y]) @ M.M_C2D65.T
    f = lambda t: np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)
    fx, fy, fz = f(XYZ[0] / M.WP[0]), f(XYZ[1]), f(XYZ[2] / M.WP[2])
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])
miLab = np.array([xyY_to_lab(*MI[(h, v, c)][:2], MI[(h, v, c)][2] * 1.02568 / 100) if (h, v, c) in MI else [np.nan] * 3
                  for h, v, c in zip(aqpH, aqpV, aqpC)])
refMI = np.full_like(refAQP, np.nan); okMI = np.isfinite(miLab).all(1)
refMI[okMI] = M.rgb_to_lab(M.quant(M.lab_to_rgb(miLab[okMI, 0], miLab[okMI, 1], miLab[okMI, 2])))

def render(lab):
    return M.rgb_to_lab(M.quant(M.lab_to_rgb(lab[:, 0], lab[:, 1], lab[:, 2])))


def evaluate(name, labfn, nbytes=None, extra=''):
    lab = np.array([labfn(h, v, c) for h, v, c in zip(aqpH, aqpV, aqpC)])
    out = render(lab)
    dA = M.de2000(out, refAQP); dR = M.de2000(out, refREN); d76 = M.de76(out, refAQP)
    res = {'model': name, 'bytes': nbytes, 'extra': extra}
    for k, m in dom.items():
        s = dA[m]; res[k] = (round(float(s.mean()), 2), round(float(np.percentile(s, 95)), 2), round(float(s.max()), 1))
    dM = M.de2000(out, refMI)
    for k, m in dom.items():
        mm = m & okMI; t = dM[mm]; res['MI ' + k] = (round(float(t.mean()), 2), round(float(np.percentile(t, 95)), 2), round(float(t.max()), 1))
    ww = wOSD * okMI; res['MI OSD-weighted mean dE00'] = round(float(np.nansum(dM * ww) / ww.sum()), 3)
    res['MI OSD-weighted p95 dE00'] = round(float(wpct(np.nan_to_num(dM), ww, 95)), 2)
    res['_dM'] = dM
    res['OSD-weighted mean dE00'] = round(float((dA * wOSD).sum() / wOSD.sum()), 3)
    res['OSD-weighted p95 dE00'] = round(float(wpct(dA, wOSD, 95)), 2)
    m = renIdx & dom['typical (10R-5Y, V2-8, C1-8)']
    res['vs renotation typical'] = (round(float(dR[m].mean()), 2), round(float(np.percentile(dR[m], 95)), 2), round(float(dR[m].max()), 1))
    m = renIdx & (aqpC <= 16)
    res['vs renotation all C<=16'] = (round(float(dR[m].mean()), 2), round(float(np.percentile(dR[m], 95)), 2), round(float(dR[m].max()), 1))
    res['CIE76 typical mean'] = round(float(d76[dom['typical (10R-5Y, V2-8, C1-8)']].mean()), 2)
    res['CIE76 all mean'] = round(float(d76[chrom].mean()), 2)
    print(res['model']); sys.stdout.flush()
    return res


def wpct(x, w, p):
    o = np.argsort(x); cw = np.cumsum(w[o]); return x[o][np.searchsorted(cw, cw[-1] * p / 100)]


def literal_bytes(arr, dec=1):
    s = ','.join(f'{x:.{dec}f}'.rstrip('0').rstrip('.') if dec else str(int(round(x))) for x in np.ravel(arr))
    s = s.replace('-0,', '0,')
    return len(s), len(gzip.compress(s.encode(), 9))


# ---------------------------------------------------------------- M0 current
L_of = lambda v: float(M.L_from_Y(max(0.0, M.d1535_Y(v))))
results = []
results.append(evaluate('M0 current (20 anchors x chroma, a*b* value-independent)', lambda h, v, c: M.current_lab(hd, h, v, c),
                        literal_bytes([x for p in hd.values() for x in p.ravel()], 2)))


# ---------------------------------------------------------------- generic grid model
class Grid:
    """Node table over hue anchors x value nodes x chroma nodes (C=0 implicit origin)."""

    def __init__(self, hues, vnodes, cnodes, polar=False):
        self.hues = hues; self.ang = np.array([ANG[h] for h in hues]); self.vn = np.array(vnodes, float)
        self.cn = np.array(cnodes, float); self.polar = polar
        self.nh, self.nv, self.nc = len(hues), len(vnodes), len(cnodes)
        self.X = np.zeros((self.nh * self.nv * self.nc, 2))

    def idx(self, i, j, k):
        return (i * self.nv + j) * self.nc + k

    def weights(self, h, v, c):
        a = M.hue_angle(h)
        # hue bracket (circular)
        order = np.argsort(self.ang); angs = self.ang[order]
        pos = np.searchsorted(angs, a, side='right') - 1
        i0 = order[pos % self.nh]; i1 = order[(pos + 1) % self.nh]
        a0 = angs[pos % self.nh]; a1 = angs[(pos + 1) % self.nh]
        span = (a1 - a0) % 100 or 100
        th = ((a - a0) % 100) / span
        # value bracket (linear, extrapolate at ends)
        j = int(np.clip(np.searchsorted(self.vn, v, side='right') - 1, 0, self.nv - 2))
        tv = (v - self.vn[j]) / (self.vn[j + 1] - self.vn[j])
        # chroma bracket with implicit 0 node
        cn = np.concatenate([[0.0], self.cn])
        k = int(np.clip(np.searchsorted(cn, c, side='right') - 1, 0, len(cn) - 2))
        tc = (c - cn[k]) / (cn[k + 1] - cn[k])
        w = collections.defaultdict(float)
        for ii, wh in ((i0, 1 - th), (i1, th)):
            for jj, wv in ((j, 1 - tv), (j + 1, tv)):
                for kk, wc in ((k, 1 - tc), (k + 1, tc)):
                    if kk == 0: continue  # origin node is (0,0)
                    w[self.idx(ii, jj, kk - 1)] += wh * wv * wc
        return w, (i0, i1, th)

    def lab(self, h, v, c):
        L = L_of(v)
        if h == 'N' or c == 0: return (L, 0.0, 0.0)
        if not self.polar:
            w, _ = self.weights(h, v, c)
            ab = sum(wt * self.X[ix] for ix, wt in w.items())
            return (L, ab[0], ab[1])
        # polar: interpolate each anchor in V,C then blend in LCh
        w, (i0, i1, th) = self.weights(h, v, c)
        parts = []
        for ii, wh in ((i0, 1 - th), (i1, th)):
            ab = np.zeros(2)
            for ix, wt in w.items():
                if ix // (self.nv * self.nc) == ii: ab += wt * self.X[ix]
            parts.append(ab / wh if wh > 1e-12 else ab)
        C0, C1 = np.hypot(*parts[0]), np.hypot(*parts[1])
        h0, h1 = math.atan2(parts[0][1], parts[0][0]), math.atan2(parts[1][1], parts[1][0])
        dh = (h1 - h0 + math.pi) % (2 * math.pi) - math.pi
        Cc = C0 + th * (C1 - C0); hh = h0 + th * dh
        return (L, Cc * math.cos(hh), Cc * math.sin(hh))

    def sample(self):
        """Fill nodes directly from renotation, extrapolating chroma beyond available chips."""
        for i, h in enumerate(self.hues):
            for j, v in enumerate(self.vn):
                pts = sorted((c, REN[(h, v, c)][1:]) for c in range(2, 52, 2) if (h, v, c) in REN)
                if not pts: pts = [(2.0, np.zeros(2))]
                cs = np.array([0.0] + [p[0] for p in pts]); ab = np.vstack([[0, 0]] + [p[1] for p in pts])
                for k, c in enumerate(self.cn):
                    if c <= cs[-1]:
                        self.X[self.idx(i, j, k)] = [np.interp(c, cs, ab[:, 0]), np.interp(c, cs, ab[:, 1])]
                    else:
                        t = (c - cs[-2]) / (cs[-1] - cs[-2]); self.X[self.idx(i, j, k)] = ab[-2] + t * (ab[-1] - ab[-2])
        return self

    def fit(self, train, lam=1e-2):
        """Least-squares refit of node a*,b* to renotation points (prior = sampled nodes)."""
        prior = self.X.copy()
        A = lil_matrix((len(train), len(self.X))); Y = np.zeros((len(train), 2)); wts = np.zeros(len(train))
        for r, (h, v, c, lab, wt) in enumerate(train):
            w, _ = self.weights(h, v, c)
            for ix, x in w.items(): A[r, ix] = x * wt
            Y[r] = lab[1:] * wt
        A = vstack([A.tocsr(), lam * identity(len(self.X), format='csr')])
        for d in range(2):
            self.X[:, d] = lsqr(A, np.concatenate([Y[:, d], lam * prior[:, d]]), atol=1e-10, btol=1e-10, iter_lim=20000)[0]
        return self

    def nbytes(self):
        return literal_bytes(self.X, 1)


# training data: renotation chips V1-10, C<=16, all 40 hues; soil typical domain weighted x3
train = []
for (h, v, c), lab in REN.items():
    if c > 16: continue
    wt = 3.0 if (h in TYP and 2 <= v <= 8 and c <= 8) else 1.0
    train.append((h, v, c, lab, wt))

V10 = list(range(1, 11))
C_SOIL = [2, 4, 6, 8, 10, 12, 16]
C_FULL = [2, 4, 6, 8, 10, 12, 14, 16, 20, 26, 34, 50]

g = Grid(M.ANCH, V10, C_SOIL).sample()
results.append(evaluate('M1a 20 anchors x V1-10 x C{2..12,16}, sampled', g.lab, g.nbytes(), f'{g.X.size} numbers'))
g.fit(train)
results.append(evaluate('M1b same grid, least-squares fit', g.lab, g.nbytes(), f'{g.X.size} numbers'))
gp = Grid(M.ANCH, V10, C_SOIL, polar=True); gp.X = g.X.copy()
results.append(evaluate('M1c M1b nodes, polar (LCh) hue blend', gp.lab, gp.nbytes(), f'{g.X.size} numbers'))

g = Grid(M.ANCH, [1, 2, 3, 5, 7, 9, 10], C_SOIL).sample().fit(train)
results.append(evaluate('M1d 20 anchors x V{1,2,3,5,7,9,10} x C{2..12,16}, LS', g.lab, g.nbytes(), f'{g.X.size} numbers'))

g = Grid(HUES40, V10, C_SOIL).sample()
results.append(evaluate('M2a 40 hues (renotation grid) x V1-10 x C{2..12,16}, sampled', g.lab, g.nbytes(), f'{g.X.size} numbers'))
g = Grid(HUES40, V10, C_FULL).sample()
results.append(evaluate('M2b 40 hues x V1-10 x C up to 50 (near-full renotation), sampled', g.lab, g.nbytes(), f'{g.X.size} numbers'))

# value-independent structure but least-squares refit (is the anchor data itself the problem?)
g0 = Grid(M.ANCH, [1, 10], C_SOIL)
# force value-independence: tie V nodes by fitting with V1==V10 identical -> emulate by single node layer
class Grid1(Grid):
    def weights(self, h, v, c):
        return Grid.weights(self, h, 5.0 if True else v, c)
g0 = Grid1(M.ANCH, [1, 10], C_SOIL)
g0.X[:] = 0; g0.fit(train, lam=1e-3)
results.append(evaluate('M0-LS current structure (value-independent), LS refit', g0.lab, literal_bytes(g0.X[::1][:len(g0.X)//2],1), 'value-independent'))


# ---------------------------------------------------------------- M4 polynomial per anchor
class Poly:
    """Per hue anchor: a,b = C*(p0+p1 V+p2 V^2) + C^2*(q0+q1 V) ; linear blend between anchors."""
    NB = 5

    def __init__(self, hues):
        self.g = Grid(hues, [1, 10], [2]); self.nh = len(hues); self.X = np.zeros((self.nh * self.NB, 2))

    def basis(self, v, c):
        return np.array([c, c * v, c * v * v, c * c, c * c * v])

    def w(self, h, v, c):
        _, (i0, i1, th) = self.g.weights(h, v, c)
        b = self.basis(v, c); out = {}
        for ii, wh in ((i0, 1 - th), (i1, th)):
            for q in range(self.NB): out[ii * self.NB + q] = out.get(ii * self.NB + q, 0) + wh * b[q]
        return out

    def lab(self, h, v, c):
        L = L_of(v)
        if h == 'N' or c == 0: return (L, 0.0, 0.0)
        ab = sum(wt * self.X[ix] for ix, wt in self.w(h, v, c).items())
        return (L, ab[0], ab[1])

    def fit(self, train):
        A = np.zeros((len(train), len(self.X))); Y = np.zeros((len(train), 2))
        for r, (h, v, c, lab, wt) in enumerate(train):
            for ix, x in self.w(h, v, c).items(): A[r, ix] = x * wt
            Y[r] = lab[1:] * wt
        self.X = np.linalg.lstsq(A, Y, rcond=None)[0]; return self


train12 = [t for t in train if t[2] <= 12]
p = Poly(M.ANCH).fit(train12)
results.append(evaluate('M4a polynomial 20 anchors x 5 coeffs (fit C<=12)', p.lab, literal_bytes(p.X, 4), f'{p.X.size} numbers'))
p = Poly(HUES40).fit(train12)
results.append(evaluate('M4b polynomial 40 hues x 5 coeffs (fit C<=12)', p.lab, literal_bytes(p.X, 4), f'{p.X.size} numbers'))


# ---------------------------------------------------------------- M4 variants: richer basis
class PolyB(Poly):
    def __init__(self, hues, basis):
        Poly.__init__(self, hues); self.bf = basis; self.NB = len(basis(1.0, 1.0)); self.X = np.zeros((self.nh * self.NB, 2))
    def basis(self, v, c):
        return np.array(self.bf(v, c))

B8 = lambda v, c: [c, c*v, c*v*v, c*v**3, c*c, c*c*v, c*c*v*v, c**3]
B6 = lambda v, c: [c, c*v, c*v*v, c*v**3, c*c, c*c*v]
for nm, bf in (('6', B6), ('8', B8)):
    p = PolyB(M.ANCH, bf).fit(train12)
    results.append(evaluate(f'M4c polynomial 20 anchors x {nm} coeffs (fit C<=12)', p.lab, literal_bytes(p.X, 4), f'{p.X.size} numbers'))
    if nm == '8':
        p40 = PolyB(HUES40, bf).fit(train12)
        results.append(evaluate(f'M4d polynomial 40 hues x {nm} coeffs (fit C<=12)', p40.lab, literal_bytes(p40.X, 4), f'{p40.X.size} numbers'))

# ---------------------------------------------------------------- M1 with int8 slope encoding
g = Grid(M.ANCH, V10, [2, 4, 6, 8, 10, 12, 16]).sample().fit(train)
cn = np.tile(np.array([2, 4, 6, 8, 10, 12, 16], float), len(g.X) // 7)[:, None]
slope = g.X / cn
q = np.clip(np.round(slope / 0.05), -127, 127)
gq = Grid(M.ANCH, V10, [2, 4, 6, 8, 10, 12, 16]); gq.X = q * 0.05 * cn
results.append(evaluate('M1e M1b nodes stored as int8 (a/C, b/C step 0.05)', gq.lab, (int(len(q.ravel()) * 4 / 3), None), f'{q.size} int8 -> base64'))
gp = Grid(M.ANCH, V10, [2, 4, 6, 8, 10, 12, 16], polar=True); gp.X = g.X.copy()
results.append(evaluate('M1c(fixed) M1b nodes, polar (LCh) hue blend', gp.lab, g.nbytes(), ''))
g6 = Grid(M.ANCH, V10, [2, 4, 8, 12, 16]).sample().fit(train)
results.append(evaluate('M1f 20 anchors x V1-10 x C{2,4,8,12,16}, LS', g6.lab, g6.nbytes(), f'{g6.X.size} numbers'))

# worst chips for M1b and M0
for nm, fn in (('M1b', g.lab), ('M0', lambda h, v, c: M.current_lab(hd, h, v, c))):
    lab = np.array([fn(h, v, c) for h, v, c in zip(aqpH, aqpV, aqpC)]); d = M.de2000(render(lab), refAQP)
    m = dom['typical (10R-5Y, V2-8, C1-8)'] | dom['dark V1-2.5 soil hues C1-4']
    o = np.argsort(-np.where(m, d, -1))[:8]
    print('worst', nm, [(aqpH[i], aqpV[i], aqpC[i], round(float(d[i]), 2)) for i in o])

# floor: aqp vs aqp re-rendered with D1535 L* (isolates aqp's Y rescale)
lab = refAQP.copy(); lab[:, 0] = [L_of(v) for v in aqpV]
d = M.de2000(render(lab), refAQP)
for k, m in dom.items():
    m2 = m & np.all((aqpRGB > 0.002) & (aqpRGB < 0.998), 1)
    print('L-floor', k, round(float(d[m2].mean()), 2), round(float(np.percentile(d[m2], 95)), 2))
print('L-floor OSD-weighted', round(float((d * wOSD).sum() / wOSD.sum()), 3))



# ---------------------------------------------------------------- compact encodings of the value-dependent grid
def delta_chars(X, nc, step):
    """quantize nodes to `step`, delta-code along chroma; return (max |delta| in steps, string length)."""
    q = np.round(X / step).astype(int).reshape(-1, nc, 2)
    d = np.diff(np.concatenate([np.zeros((q.shape[0], 1, 2), int), q], 1), axis=1)
    return int(np.abs(d).max()), d
gC = [2, 4, 6, 8, 12, 16]
for polar in (False, True):
    gg = Grid(M.ANCH, V10, gC, polar=polar).sample().fit(train)
    for step in (0.25, 0.5, 1.0):
        gq = Grid(M.ANCH, V10, gC, polar=polar); gq.X = np.round(gg.X / step) * step
        mx, d = delta_chars(gg.X, len(gC), step)
        # one printable char per delta if range fits 94 symbols, else 2
        nchar = d.size * (1 if mx <= 46 else 2)
        b = literal_bytes(gq.X, 2 if step == 0.25 else (1 if step == 0.5 else 0))
        s_ = ''.join(chr(48 + int(v) % 64) for v in d.ravel()); gz = len(gzip.compress(s_.encode(), 9))
        results.append(evaluate(f'M1g 20 anchors x V1-10 x C{{2,4,6,8,12,16}} LS{" polar" if polar else ""}, rounded to {step}', gq.lab, b,
                                f'{gq.X.size} numbers; delta-coded max|d|={mx} steps -> ~{nchar} chars (gz~{gz})'))

# polynomial with linear chroma extrapolation beyond C=12
class PolyClamp(PolyB):
    def lab(self, h, v, c):
        if h != 'N' and c > 12:
            L, a, b = PolyB.lab(self, h, v, 12.0); return (L, a * c / 12, b * c / 12)
        return PolyB.lab(self, h, v, c)
pc = PolyClamp(M.ANCH, B8); pc.X = PolyB(M.ANCH, B8).fit(train12).X
results.append(evaluate('M4e = M4c-8 + linear chroma extrapolation above C12', pc.lab, literal_bytes(pc.X, 4), f'{pc.X.size} numbers'))
pc6 = PolyClamp(M.ANCH, B6); pc6.X = PolyB(M.ANCH, B6).fit(train12).X
results.append(evaluate('M4f = M4c-6 + linear chroma extrapolation above C12', pc6.lab, literal_bytes(pc6.X, 4), f'{pc6.X.size} numbers'))

# hex LUT of Munsell Soil Color Book chips (NASIS name list) baked from munsellinterpol, fallback M4e
book = set()
for r in csv.DictReader(open(sys.argv[1] + '/../dl_names/names.csv')):
    t = r['munsell'].replace('/', ' ').split()
    if len(t) == 3 and t[0] != 'N': book.add((t[0], float(t[1]), float(t[2])))
inbook = np.array([(h, v, c) in book for h, v, c in zip(aqpH, aqpV, aqpC)]) & okMI
cov = wOSD[inbook].sum() / wOSD.sum()
print('book chips (chromatic):', len(book), ' found in aqp grid:', int(inbook.sum()), ' OSD chromatic coverage: %.4f' % cov)
lutlab = {(aqpH[i], aqpV[i], aqpC[i]): miLab[i] for i in np.where(inbook)[0]}
lutfn = lambda h, v, c: tuple(lutlab[(h, v, c)]) if (h, v, c) in lutlab else pc.lab(h, v, c)
results.append(evaluate('M6 hex LUT of soil-book chips (munsellinterpol) + M4e fallback', lutfn, (int(len(book) * 3 * 4 / 3) + len(literal_bytes(pc.X, 4)) and int(len(book) * 4) + literal_bytes(pc.X, 4)[0], None), f'{len(book)} chips x 3 bytes base64 + M4e coeffs'))

# export candidate coefficient tables for a follow-up TS prototype
json.dump({'anchors': M.ANCH, 'basis': 'a,b = sum_k coef[k] * [C, C*V, C*V^2, C*V^3, C^2, C^2*V, C^2*V^2, C^3][k]; linear blend between anchors; C>12 -> scale C/12',
           'coef_a': np.round(pc.X[:, 0].reshape(20, 8), 6).tolist(), 'coef_b': np.round(pc.X[:, 1].reshape(20, 8), 6).tolist()},
          open(sys.argv[1] + '/munsell-ab-polynomial-coefficients.json', 'w'))
gg = Grid(M.ANCH, V10, gC).sample().fit(train)
json.dump({'anchors': M.ANCH, 'values': V10, 'chromas': gC, 'layout': '[anchor][value][chroma][a,b], C=0 -> (0,0)',
           'nodes': (np.round(gg.X * 2) / 2).reshape(20, 10, len(gC), 2).tolist()}, open(sys.argv[1] + '/candidate_M1g.json', 'w'))

# reference agreement: aqp vs munsellinterpol
dd = M.de2000(refAQP, refMI)
for k, m in dom.items():
    mm = m & okMI; print('aqp-vs-MI', k, round(float(dd[mm].mean()), 2), round(float(np.percentile(dd[mm], 95)), 2), round(float(dd[mm].max()), 1))
m = okMI & (aqpC == 1) & chrom; print('aqp-vs-MI chroma 1 only', round(float(dd[m].mean()), 2), round(float(np.percentile(dd[m], 95)), 2), 'n>2:', int((dd[m] > 2).sum()), 'of', int(m.sum()))
for k in ('typical (10R-5Y, V2-8, C1-8)', 'dark V1-2.5 soil hues C1-4', 'gley (10Y-5G C1-4, 10G-5PB C1-2; V2-8)'):
    for r in results:
        if r['model'].startswith(('M0 current', 'M1b', 'M2a')):
            dM = r['_dM']; mm = dom[k] & okMI; o = np.argsort(-np.where(mm, dM, -1))[:6]
            print('worstMI', r['model'][:4], k[:12], [(aqpH[i], aqpV[i], aqpC[i], round(float(dM[i]), 2)) for i in o])
for r in results: r.pop('_dM')
json.dump(results, open(sys.argv[1] + '/exp1_results.json', 'w'), indent=1)

