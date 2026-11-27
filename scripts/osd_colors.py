import json, os, re, sys, collections, csv
root = sys.argv[1]; out = sys.argv[2]
pat = re.compile(r'\b(N|\d+(?:\.\d+)?(?:YR|GY|BG|PB|RP|R|Y|G|B|P))\s+(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)?')
redox = re.compile(r'concentration|depletion|mottl|masses|redox|nodule|stain|coat|film|streak|lamell|faces of|ped face|segregation|krotovina|tongue|pores', re.I)
cnt = collections.Counter(); nser = 0
for d, _, fs in os.walk(root):
    for f in fs:
        if not f.endswith('.json'): continue
        try: j = json.load(open(os.path.join(d, f)))
        except Exception: continue
        tp = j.get('TYPICAL PEDON')
        if not isinstance(tp, dict): continue
        nser += 1
        for clause in re.split(r';', tp.get('content', '')):
            ctx = 'feature' if redox.search(clause) else 'matrix'
            for m in pat.finditer(clause):
                h, v, c = m.group(1), m.group(2), m.group(3) or '0'
                cnt[(h, v, c, ctx)] += 1
with open(out, 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['hue','value','chroma','ctx','n'])
    for k, n in cnt.most_common(): w.writerow([*k, n])
print('series', nser, 'distinct', len(cnt), 'total', sum(cnt.values()))
