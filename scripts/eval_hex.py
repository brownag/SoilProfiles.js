import sys, numpy as np
sys.path.insert(0, sys.argv[1]); import mlib as M
exec(open(sys.argv[1] + '/exp1.py').read().split('# ---------------------------------------------------------------- M0 current')[0])
hx = {}
for l in open(sys.argv[6]).read().split('\n'):
    h, v, c, x = l.split(','); hx[(h, float(v), float(c))] = x
labfn = lambda h, v, c: tuple(M.rgb_to_lab(np.array([int(hx[(h, v, c)][i:i + 2], 16) / 255 for i in (1, 3, 5)])))
lab = np.array([labfn(h, v, c) for h, v, c in zip(aqpH, aqpV, aqpC)]); out = render(lab)
dM = M.de2000(out, refMI)
for k, m in dom.items():
    mm = m & okMI; print(k, round(float(dM[mm].mean()), 2), round(float(np.percentile(dM[mm], 95)), 2), round(float(dM[mm].max()), 1))
ww = wOSD * okMI; print('OSD', round(float(np.nansum(dM * ww) / ww.sum()), 3))
