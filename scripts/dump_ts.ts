import { readFileSync, writeFileSync } from 'fs';
import { munsellToRgbApprox } from '/home/andrew/workspace/SoilProfiles.js/src/utils/munsell-approx';
const lines = readFileSync(process.argv[2], 'utf8').trim().split('\n').slice(1);
const out = lines.map(l => { const [h, v, c] = l.split(',').map(s => s.replace(/"/g, '')); return `${h},${v},${c},${munsellToRgbApprox(`${h} ${v}/${c}`)}`; });
writeFileSync(process.argv[3], out.join('\n'));
