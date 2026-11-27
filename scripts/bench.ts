import { munsellToHex } from '/home/andrew/workspace/SoilProfiles.js/src/core/munsell';
import { munsellToRgbApprox } from '/home/andrew/workspace/SoilProfiles.js/src/utils/munsell-approx';
const hues = ['10R','2.5YR','5YR','7.5YR','10YR','2.5Y','5Y','5GY','5G','N'];
const inputs: [string, number, number][] = [];
for (const h of hues) for (const v of [2,2.5,3,4,5,6,7,8]) for (const c of [1,2,3,4,6,8]) inputs.push([h, v, h === 'N' ? 0 : c]);
const N = 2_000_000;
function bench(name: string, fn: (i: number) => unknown) {
  for (let i = 0; i < 50000; i++) fn(i);
  const t0 = process.hrtime.bigint(); let sink = 0;
  for (let i = 0; i < N; i++) { const r = fn(i) as string | null; sink += r ? r.length : 0; }
  const ns = Number(process.hrtime.bigint() - t0) / N;
  console.log(`${name.padEnd(48)} ${ns.toFixed(0)} ns/call  (${(1e3 / ns).toFixed(2)} M calls/s) ${sink % 7}`);
}
bench('munsellToHex (validation + approx)', i => { const x = inputs[i % inputs.length]; return munsellToHex(x[0], x[1], x[2]); });
bench('munsellToRgbApprox (string in)', i => { const x = inputs[i % inputs.length]; return munsellToRgbApprox(`${x[0]} ${x[1]}/${x[2]}`); });
const cache = new Map<string, string | null>();
bench('Map-memoized munsellToHex', i => { const x = inputs[i % inputs.length]; const k = `${x[0]}|${x[1]}|${x[2]}`; let r = cache.get(k); if (r === undefined) { r = munsellToHex(x[0], x[1], x[2]); cache.set(k, r); } return r; });
// pipeline pieces: gamma via Math.pow vs threshold table
const thr = new Float64Array(256); for (let k = 0; k < 256; k++) { const s = (k - 0.5) / 255; thr[k] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
const lin = new Float64Array(1024); for (let i = 0; i < 1024; i++) lin[i] = Math.random();
bench('3x sRGB gamma via Math.pow + round', i => { let s = 0; for (let k = 0; k < 3; k++) { const c = lin[(i + k) & 1023]; s += Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); } return 'x'.repeat(s & 1); });
bench('3x sRGB gamma via 256-entry threshold search', i => { let s = 0; for (let k = 0; k < 3; k++) { const c = lin[(i + k) & 1023]; let lo = 0, hi = 255; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (thr[m] <= c) lo = m; else hi = m - 1; } s += lo; } return 'x'.repeat(s & 1); });
