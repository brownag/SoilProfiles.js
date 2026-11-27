import { interpolateLab, parseMunsellHueAngle } from '/home/andrew/workspace/SoilProfiles.js/src/utils/munsell-approx';
const hs = ['10R','2.5YR','5YR','7.5YR','10YR','2.5Y','5Y','5GY'];
const N = 3_000_000;
function bench(name: string, fn: (i: number) => number) {
  for (let i = 0; i < 50000; i++) fn(i);
  const t0 = process.hrtime.bigint(); let s = 0; for (let i = 0; i < N; i++) s += fn(i);
  console.log(name.padEnd(40), (Number(process.hrtime.bigint() - t0) / N).toFixed(0), 'ns/call', s > 0 ? '' : '.');
}
bench('parseMunsellHueAngle', i => parseMunsellHueAngle(hs[i & 7])!);
bench('interpolateLab (parse + 2 anchors)', i => interpolateLab(hs[i & 7], 1 + (i % 8))!.a);
bench('Math.pow(Y,1/3) vs cbrt: pow', i => Math.pow(0.1 + (i & 255) / 300, 1 / 3));
bench('Math.cbrt', i => Math.cbrt(0.1 + (i & 255) / 300));
bench('hex format toString(16)x3', i => { const r = (i * 7) & 255, g = (i * 13) & 255, b = (i * 29) & 255; const h = (c: number) => { const x = c.toString(16); return x.length === 1 ? '0' + x : x; }; return ('#' + h(r) + h(g) + h(b)).length; });
bench('hex format via int', i => { const r = (i * 7) & 255, g = (i * 13) & 255, b = (i * 29) & 255; return ('#' + (0x1000000 | (r << 16) | (g << 8) | b).toString(16).slice(1)).length; });
