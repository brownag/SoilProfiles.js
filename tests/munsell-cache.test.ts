import { munsellToHexApprox } from '../src/utils/munsell-approx';

jest.mock('../src/utils/munsell-approx', () => ({
  munsellToHexApprox: jest.fn((hue: string) => (hue === '5XX' ? null : '#123456')),
}));

const approx = munsellToHexApprox as jest.MockedFunction<typeof munsellToHexApprox>;

// Each test gets a fresh module, so it starts with an empty cache.
function loadMunsellToHex(): typeof import('../src/core/munsell').munsellToHex {
  let fn!: typeof import('../src/core/munsell').munsellToHex;
  jest.isolateModules(() => {
    fn = require('../src/core/munsell').munsellToHex;
  });
  return fn;
}

describe('munsellToHex cache', () => {
  beforeEach(() => {
    approx.mockClear();
  });

  it('should reuse cached hex and null results', () => {
    const munsellToHex = loadMunsellToHex();

    expect(munsellToHex('10YR', 4, 3)).toBe('#123456');
    expect(munsellToHex('10yr', '4.0', '3')).toBe('#123456');
    expect(approx).toHaveBeenCalledTimes(1);

    expect(munsellToHex('5XX', 4, 3)).toBeNull();
    expect(munsellToHex('5XX', 4, 3)).toBeNull();
    expect(approx).toHaveBeenCalledTimes(2);
  });

  it('should keep 4,096 entries and recompute after eviction', () => {
    const munsellToHex = loadMunsellToHex();

    for (let i = 0; i < 4096; i++) {
      munsellToHex('10YR', 4, i);
    }
    expect(approx).toHaveBeenCalledTimes(4096);

    // A full cache still serves existing keys.
    expect(munsellToHex('10YR', 4, 0)).toBe('#123456');
    expect(approx).toHaveBeenCalledTimes(4096);

    // One more distinct key evicts, so an old key is recomputed with the same result.
    munsellToHex('10YR', 4, 4096);
    expect(approx).toHaveBeenCalledTimes(4097);
    expect(munsellToHex('10YR', 4, 0)).toBe('#123456');
    expect(approx).toHaveBeenCalledTimes(4098);
  });
});
