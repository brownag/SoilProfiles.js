import { hexToLab, deltaE2000, Lab } from './helpers/ciede2000';

describe('deltaE2000', () => {
  // Published CIEDE2000 reference pairs (Sharma, Wu & Dalal 2005).
  const pairs: Array<[string, Lab, Lab, number]> = [
    ['pair 1', [50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    ['pair 2', [50, 0, 0], [50, -1, 2], 2.3669],
    ['pair 3', [50, 2.5, 0], [73, 25, -18], 27.1492],
    ['pair 4', [60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ];

  it.each(pairs)('matches published value for %s', (_name, lab1, lab2, expected) => {
    const got = deltaE2000(lab1, lab2);
    expect(Math.abs(got - expected)).toBeLessThanOrEqual(1e-4);
  });
});

describe('hexToLab', () => {
  it('maps white to L=100, a=b=0', () => {
    const lab = hexToLab('#ffffff');
    expect(Math.abs(lab[0] - 100)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(lab[1])).toBeLessThanOrEqual(0.02);
    expect(Math.abs(lab[2])).toBeLessThanOrEqual(0.02);
  });

  it('maps black to [0, 0, 0]', () => {
    const lab = hexToLab('#000000');
    lab.forEach(v => expect(v).toBeCloseTo(0, 10));
  });

  it('matches mlib.rgb_to_lab parity on #664d33', () => {
    const expected = [34.7450, 6.8739, 19.4483];
    const lab = hexToLab('#664d33');
    lab.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1e-3));
  });

  it('accepts hex without a leading #', () => {
    expect(hexToLab('ffffff')).toEqual(hexToLab('#ffffff'));
  });

  it('throws on invalid input', () => {
    expect(() => hexToLab('#fff')).toThrow();
    expect(() => hexToLab('zzzzzz')).toThrow();
  });
});
