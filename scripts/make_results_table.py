import json, sys
R = json.load(open(sys.argv[1]))
doms = ['typical (10R-5Y, V2-8, C1-8)', 'gley (10Y-5G C1-4, 10G-5PB C1-2; V2-8)', 'red pages 5R/7.5R V2-8 C1-8', 'high chroma 10R-5Y C8-14', 'dark V1-2.5 soil hues C1-4', 'light V8.5-9.5 7.5YR-5Y C1-4', 'redox conc. 2.5YR-10YR V3-7 C6-8', 'all chromatic aqp rows']
for pre in ('MI ', ''):
    print('\n### reference:', 'munsellinterpol' if pre else 'aqp', '(mean / p95 / max dE00)')
    print('| model | bytes raw/gz | ' + ' | '.join(d.split(' (')[0] if '(' in d else d for d in doms) + ' | OSD-wtd mean/p95 |')
    print('|' + '---|' * (len(doms) + 3))
    for r in R:
        b = r['bytes']; bs = f"{b[0]}/{b[1]}" if b and b[1] else (str(b[0]) if b else '')
        cells = ['/'.join(str(x) for x in r[pre + d]) for d in doms]
        print(f"| {r['model']} | {bs} | " + ' | '.join(cells) + f" | {r[pre + 'OSD-weighted mean dE00']}/{r[pre + 'OSD-weighted p95 dE00']} |")
print('\nCIE76 typical/all mean (vs aqp):'); [print(' ', r['model'][:40], r['CIE76 typical mean'], r['CIE76 all mean'], ' vs renotation typical', r['vs renotation typical'], 'C<=16', r['vs renotation all C<=16']) for r in R]
