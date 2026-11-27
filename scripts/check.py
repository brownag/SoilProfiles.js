import sys, numpy as np
sys.path.insert(0, sys.argv[1]); import mlib as M
t = np.loadtxt(sys.argv[2]); d = M.de2000(t[:, :3], t[:, 3:6]); print('sharma maxerr', np.abs(d - t[:, 6]).max(), 'n', len(t))
hd = M.parse_current_hue_data('/home/andrew/workspace/SoilProfiles.js/src/utils/munsell-approx.ts'); print('anchors', len(hd), 'points', sum(len(v) for v in hd.values()))
H, V, C, rgb, lab = M.load_aqp(sys.argv[3])
ts = [l.split(',')[3] for l in open(sys.argv[4]).read().split('\n')]
mis = 0
for i in range(len(H)):
    L, a, b = M.current_lab(hd, H[i], V[i], C[i]); hx = M.to_hex(M.lab_to_rgb(np.array(L), np.array(a), np.array(b)))
    mis += hx != ts[i]
print('port hex mismatches', mis, 'of', len(H))
# aqp rescale hypothesis: renotation Y(V=1) with (Y-0.237)/(100-0.237)
rH, rV, rC, rlab = M.load_renotation(sys.argv[5])
print('renotation rows', len(rH), 'Y at V=1 sample L', rlab[(rV == 1)][:1, 0], ' D1535 L(1)=', M.L_from_Y(M.d1535_Y(1.0)))
for v in [1, 2, 3, 5, 9, 10]:
    Yr = M.d1535_Y(v) * 100; print(v, 'aqp-like L', round(float(M.L_from_Y((min(Yr,100) - 0.237) / (100 - 0.237))), 2), 'D1535 L', round(float(M.L_from_Y(M.d1535_Y(v))), 2))
