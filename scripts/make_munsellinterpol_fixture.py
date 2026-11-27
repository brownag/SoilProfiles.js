"""Build the munsellinterpol reference Lab fixture from mi_xyY.csv.

usage: python3 -I scripts/make_munsellinterpol_fixture.py <mi_xyY.csv> <out.json>
"""
import os, sys, csv, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import munsell_color as M

src, out = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(src)))
H = np.array([r['hue'] for r in rows])
V = np.array([float(r['value']) for r in rows])
C = np.array([float(r['chroma']) for r in rows])
X = np.array([float(r['x']) for r in rows])
Y_ = np.array([float(r['y']) for r in rows])
Yl = np.array([float(r['Y']) for r in rows])


def xyY_to_lab(x, y, Y):
    XYZ = np.array([x * Y / y, Y, (1 - x - y) * Y / y]) @ M.M_C2D65.T
    f = lambda t: np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)
    fx, fy, fz = f(XYZ[0] / M.WP[0]), f(XYZ[1]), f(XYZ[2] / M.WP[2])
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


# ---------------------------------------------------------------- domains (verbatim from fit_munsell_models.py:27-39)
TYP = {'10R', '2.5YR', '5YR', '7.5YR', '10YR', '2.5Y', '5Y'}
GLEY1 = {'10Y', '5GY', '10GY', '5G'}
GLEY2 = {'10G', '5BG', '10BG', '5B', '10B', '5PB'}
aqpH, aqpV, aqpC = H, V, C
chrom = aqpH != 'N'
dom = {
    'typical': chrom & np.isin(aqpH, list(TYP)) & (aqpV >= 2) & (aqpV <= 8) & (aqpC <= 8),
    'gley': chrom & (aqpV >= 2) & (aqpV <= 8) & ((np.isin(aqpH, list(GLEY1)) & (aqpC <= 4)) | (np.isin(aqpH, list(GLEY2)) & (aqpC <= 2))),
    'red': np.isin(aqpH, ['5R', '7.5R']) & (aqpV >= 2) & (aqpV <= 8) & (aqpC <= 8),
    'highC': np.isin(aqpH, list(TYP)) & (aqpC >= 8) & (aqpC <= 14),
    'dark': np.isin(aqpH, list(TYP | GLEY1)) & (aqpV <= 2.5) & (aqpC <= 4),
    'light': np.isin(aqpH, ['7.5YR', '10YR', '2.5Y', '5Y']) & (aqpV >= 8.5) & (aqpC <= 4),
    'redox': np.isin(aqpH, ['2.5YR', '5YR', '7.5YR', '10YR']) & (aqpV >= 3) & (aqpV <= 7) & (aqpC >= 6) & (aqpC <= 8),
}
ORDER = ['typical', 'gley', 'red', 'highC', 'dark', 'light', 'redox']

# ---------------------------------------------------------------- reference Lab (fit_munsell_models.py:57-65 equivalent)
tags = [[d for d in ORDER if dom[d][i]] for i in range(len(rows))]
keep = [i for i in range(len(rows)) if tags[i]]
labs = np.array([xyY_to_lab(X[i], Y_[i], Yl[i] * 1.02568 / 100) for i in range(len(rows))])
ref = M.rgb_to_lab(M.quant(M.lab_to_rgb(labs[:, 0], labs[:, 1], labs[:, 2])))
if not np.isfinite(ref[keep]).all():
    sys.exit('non-finite Lab in tagged rows')

# ---------------------------------------------------------------- write strict JSON, one row per line
def fmt_row(i):
    L, a, b = (round(float(v), 3) for v in ref[i])
    return json.dumps([H[i], int(V[i]) if V[i].is_integer() else V[i], int(C[i]) if C[i].is_integer() else C[i],
                       L, a, b, tags[i]])

header = {
    'source': 'munsellinterpol 3.6-0 MunsellToxyY, Bradford C->D65, Y x1.02568 (Newhall scale), sRGB-quantized',
    'columns': ['hue', 'value', 'chroma', 'L', 'a', 'b', 'domains'],
}
head = json.dumps(header, ensure_ascii=True)[:-1]  # drop closing brace
body = ',\n'.join('  ' + fmt_row(i) for i in keep)
with open(out, 'w') as fh:
    fh.write(head + ', "rows": [\n' + body + '\n]}\n')
