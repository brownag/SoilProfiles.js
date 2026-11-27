"""Fit the `shape` and `hinge` low-value munsell models and write tables, results and holdout fixture.

usage: python3 -I scripts/fit_low_value_models.py <mi_xyY.csv> <outdir>

Each candidate is fit twice: on all training points (shipped coefficients) and with the
holdout excluded (reporting only).
"""
import os, sys, csv, json, hashlib
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from scipy.linalg import lstsq
import munsell_color as M

if len(sys.argv) != 3:
    sys.exit(__doc__)
src, outdir = sys.argv[1:]
FIXTURES = os.path.join(HERE, '..', 'tests', 'fixtures')

rows = list(csv.DictReader(open(src)))
H = np.array([r['hue'] for r in rows])
V = np.array([float(r['value']) for r in rows])
C = np.array([float(r['chroma']) for r in rows])
x, y, Y = np.array([[float(r[k]) for k in ('x', 'y', 'Y')] for r in rows]).T
xyz = np.stack([x * Y / y, Y, (1 - x - y) * Y / y], 1) * 1.02568 / 100 @ M.M_C2D65.T
f = lambda t: np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)
ff = f(xyz / M.WP)
LAB = np.stack([116 * ff[:, 1] - 16, 500 * (ff[:, 0] - ff[:, 1]), 200 * (ff[:, 1] - ff[:, 2])], 1)

fixture = json.load(open(os.path.join(FIXTURES, 'munsell-reference-munsellinterpol.json')))['rows']
EH = np.array([r[0] for r in fixture])
EV = np.array([float(r[1]) for r in fixture])
EC = np.array([float(r[2]) for r in fixture])
REF = np.array([r[3:6] for r in fixture])
ORDER = ['typical', 'gley', 'red', 'highC', 'dark', 'light', 'redox']
DOM = {d: np.array([d in r[6] for r in fixture]) for d in ORDER}
DOM['highC'] &= EC <= 12  # fitted range only
TYP = {'10R', '2.5YR', '5YR', '7.5YR', '10YR', '2.5Y', '5Y'}
GLEY = {'10Y', '5GY', '10GY', '5G', '10G', '5BG', '10BG', '5B', '10B', '5PB'}

BASIS_TEXT = {
    'shape': 'a,b = sum_k coef[k] * [C, C*V, C*V^2, C*(1-V/10)^8, C^2, C^2*V, C^2*V^2, C^3][k]; linear blend between anchors; C>12 -> scale C/12',
    'hinge': 'a,b = sum_k coef[k] * [C, C*V, C*V^2, C*V^3, C^2, C^2*V, C^2*V^2, C^3, C*max(0,3-V)^2][k]; linear blend between anchors; C>12 -> scale C/12',
}


def basis(v, c, kind):
    b = [c, c * v, c * v * v, c * v ** 3, c * c, c * c * v, c * c * v * v, c ** 3]
    if kind == 'shape': b[3] = c * (1 - v / 10) ** 8
    if kind == 'hinge': b.append(c * np.maximum(0, 3 - v) ** 2)
    return np.stack(b, 1)


def design(h, v, c, kind='base', nh=20):
    s = np.array([M.hue_angle(a) for a in h]) / (100 / nh)
    i = np.floor(s).astype(int) % nh
    t = s - np.floor(s)
    b = basis(v, c, kind)
    A = np.zeros((len(h), nh * b.shape[1]))
    for k in range(b.shape[1]):
        A[np.arange(len(h)), i * b.shape[1] + k] += (1 - t) * b[:, k]
        A[np.arange(len(h)), ((i + 1) % nh) * b.shape[1] + k] += t * b[:, k]
    return A


def render(ab, v):
    # Match production's cbrt(Y), including below the Lab breakpoint.
    fy = np.cbrt(np.maximum(0, M.d1535_Y(v)))
    return M.rgb_to_lab(np.floor(M.lab_to_rgb(116 * fy - 16, ab[:, 0], ab[:, 1]) * 255 + 0.5) / 255)


# ---------------------------------------------------------------- training pool, weights, holdout
mask = (V >= 1) & (C <= 12) & np.isfinite(LAB).all(1)
idx = np.flatnonzero(mask)
h, v, c, lab = H[mask], V[mask], C[mask], LAB[mask]
typ = np.isin(h, list(TYP)) & (v >= 2) & (v <= 8) & (c <= 8)
low = (v <= 2.5) & (c <= 4)
gley = np.isin(h, list(GLEY)) & (c <= 4) & (v <= 8)
w = np.where(typ, 3., 1.) * np.where(low | gley, 4., 1.)
# Deterministic point holdout, not independent source validation.
hold = np.array([int(hashlib.sha256(f'{a}/{b}/{cc}'.encode()).hexdigest()[:8], 16) % 5 == 0
                 for a, b, cc in zip(h, v, c)])


def fit(kind, all_points):
    use = np.ones(len(h), bool) if all_points else ~hold
    A = design(h, v, c, kind)
    aa = A[use] * w[use, None]
    yy = lab[use, 1:] * w[use, None]
    norm = np.linalg.norm(aa, axis=0)
    norm[norm == 0] = 1
    return np.round(lstsq(aa / norm, yy, lapack_driver='gelsy')[0] / norm[:, None], 6)


# ---------------------------------------------------------------- metrics
def chip(i):
    return f'{EH[i]} {EV[i]:g}/{EC[i]:g}'


def main_metrics(coef, kind):
    scale = np.maximum(1, EC / 12)[:, None]
    d = M.de2000(render(design(EH, EV, np.minimum(EC, 12), kind) @ coef * scale, EV), REF)
    out = {}
    for k in ORDER:
        m = DOM[k]
        worst = np.flatnonzero(m)[np.argmax(d[m])]
        out[k] = {'mean': float(d[m].mean()), 'p95': float(np.percentile(d[m], 95)), 'max': float(d[m].max()),
                  'worst': {'chip': chip(worst), 'de': float(d[worst])}}
    return out


ref_hold = M.rgb_to_lab(M.quant(M.lab_to_rgb(lab[hold, 0], lab[hold, 1], lab[hold, 2])))
HOLD_TAGS = {'all': np.ones(int(hold.sum()), bool), 'low': low[hold], 'gley': gley[hold]}


def holdout_metrics(coef, kind):
    d = M.de2000(render(design(h[hold], v[hold], c[hold], kind) @ coef, v[hold]), ref_hold)
    return {k: {'mean': float(d[m].mean()), 'max': float(d[m].max()), 'n': int(m.sum())} for k, m in HOLD_TAGS.items()}


cur = json.load(open(os.path.join(HERE, 'munsell-ab-polynomial-coefficients.json')))
CUR = np.stack([cur['coef_a'], cur['coef_b']], 2).reshape(-1, 2)
cands = ('shape', 'hinge')
coefs = {(k, m): fit(k, m == 'all_points') for k in cands for m in ('all_points', 'holdout_excluded')}
results = {'current': {'main': main_metrics(CUR, 'base'), 'holdout': holdout_metrics(CUR, 'base')}}
for k in cands:
    results[k] = {m: {'main': main_metrics(coefs[k, m], k), 'holdout': holdout_metrics(coefs[k, m], k)}
                  for m in ('all_points', 'holdout_excluded')}


def rnd(o):
    if isinstance(o, float): return round(o, 4)
    if isinstance(o, dict): return {k: rnd(x) for k, x in o.items()}
    return o


# ---------------------------------------------------------------- stdout tables
print(f"train {len(h)}; holdout {int(hold.sum())} (low {int(low[hold].sum())}, gley {int(gley[hold].sum())})")
print(f"{'model':8s} {'domain':8s} {'mean':>7s} {'p95':>7s} {'max':>7s}  worst")
for name, label, r in [('current', 'frozen table', results['current'])] + \
        [(k, m, results[k][m]) for k in cands for m in ('all_points', 'holdout_excluded')]:
    print(f'-- {name} [{label}]')
    for k in ORDER:
        m = r['main'][k]
        print(f"{name:8s} {k:8s} {m['mean']:7.3f} {m['p95']:7.3f} {m['max']:7.3f}  {m['worst']['chip']} ({m['worst']['de']:.3f})")
    for k, m in r['holdout'].items():
        print(f"{name:8s} hold-{k:3s} {m['mean']:7.3f} {'':7s} {m['max']:7.3f}  n={m['n']}")

# ---------------------------------------------------------------- outputs
FIT_TEXT = ('fit on all points: least squares on mi_xyY.csv rows with V>=1, C<=12, finite Lab; weights: x3 typical (typical hues, 2<=V<=8, C<=8), '
            'x4 on (V<=2.5 & C<=4) or (gley hue & C<=4 & V<=8); column-normalized lstsq (gelsy), rounded to 6 decimals; '
            'holdout rule (sha256("hue/value/chroma")[:8] as int mod 5 == 0) is used only for reporting')
for kind in cands:
    coef = coefs[kind, 'all_points']
    k = coef.shape[0] // 20
    payload = {'anchors': M.ANCH, 'basis': BASIS_TEXT[kind], 'coef_a': coef[:, 0].reshape(20, k).tolist(),
               'coef_b': coef[:, 1].reshape(20, k).tolist(), 'fit': FIT_TEXT}
    with open(os.path.join(outdir, f'munsell-ab-{kind}-coefficients.json'), 'w') as fh:
        json.dump(payload, fh, indent=2)
        fh.write('\n')

with open(os.path.join(outdir, 'low-value-fit-results.json'), 'w') as fh:
    json.dump(rnd(results), fh, indent=2, sort_keys=True)
    fh.write('\n')

num = lambda t: int(t) if float(t).is_integer() else float(t)
body = []
for j, i in enumerate(idx[hold]):
    L, a, b = (round(float(t), 3) for t in ref_hold[j])
    tags = [t for t, m in (('low', low[hold][j]), ('gley', gley[hold][j])) if m] + ['all']
    body.append('  ' + json.dumps([H[i], num(V[i]), num(C[i]), L, a, b, tags]))
header = {
    'source': 'munsellinterpol 3.6-0 MunsellToxyY, Bradford C->D65, Y x1.02568 (Newhall scale), sRGB-quantized; holdout rows of the training pool (sha256 of hue/value/chroma, mod 5 == 0)',
    'columns': ['hue', 'value', 'chroma', 'L', 'a', 'b', 'domains'],
}
with open(os.path.join(FIXTURES, 'munsell-reference-holdout.json'), 'w') as fh:
    fh.write(json.dumps(header, ensure_ascii=True)[:-1] + ', "rows": [\n' + ',\n'.join(body) + '\n]}\n')
