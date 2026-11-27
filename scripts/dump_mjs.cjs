const fs = require('fs');
const { munsellToHex } = require('/tmp/claude-1000/-home-andrew-workspace-SoilProfiles-js/3d1d69da-2601-4e31-9f29-cf31a5432436/scratchpad/dl_npm/node_modules/munsell/dist/src/index.js');
const lines = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').slice(1);
const out = lines.map(l => { const [h, v, c] = l.split(',').map(s => s.replace(/"/g, '')); const s = h === 'N' ? 'N ' + v : h + ' ' + v + '/' + c; return h + ',' + v + ',' + c + ',' + munsellToHex(s); });
fs.writeFileSync(process.argv[3], out.join('\n'));
const t0 = process.hrtime.bigint(); let k = 0; for (let i = 0; i < 200000; i++) k += munsellToHex('10YR 4/3').length; console.log('ns/call', Number(process.hrtime.bigint() - t0) / 200000);
