# Orchestration 2 State

## Baseline (Pre-Wave 1)
- **Date**: 2026-11-26
- **Base Commit**: `5d6081e` (`main`)
- **Target Branch**: `fix/munsell-hue-approx` (created off `main` before Wave 1)
- **Test Suite (`npm test`)**: PASS — 8/8 suites, 173/173 tests (1.995s)
- **Build (`npm run build`)**: PASS — `tsc && node esbuild.config.js` (`dist/core.esm.js` 23.5 KB)
- **Worker / Escalation Models**: `flash` -> `hydrogen`

## Wave Board

| Wave | Task ID | Title | Status | Worker Model | Commit |
|------|---------|-------|--------|--------------|--------|
| 1 | `2.1.1` | Implement continuous Munsell hue-angle interpolation | `done` | `flash` | `981e5d3` |
| 2 | `2.2.1` | Verify core wrapper and add Munsell distinctness & calibration tests | `done` | `flash` | `eea3f83` |
| 3 | `2.3.1` | Add ESM dist Munsell verification and validate build | `done` | `flash` | `edb4b8b` |

## Task Reports

*(Worker reports will be appended below as tasks complete, <=15 lines each.)*

## 2.1.1
- **status**: `done`
- **files changed**: `src/utils/munsell-approx.ts` (L1-464; 464 lines total, `.development/` deleted)
- **checks**:
  - `npm test -- tests/munsell.test.ts`: PASS (1/1 suite, 15/15 tests)
  - `! grep -rn "munsell-data" src/`: PASS (exit 0)
  - `wc -l src/utils/munsell-approx.ts`: 464 (`<= 600`)
  - `npx tsc --noEmit`: PASS (exit 0)
- **deviations**: None; value-dependent scaling in `interpolateLab` was unnecessary (offline calibration across soil hues V=2–8, C=1–8, `n=380` measured 1.17/255 mean RGB error).
- **gotchas for dependent tasks**: Neutral `N` in `soilprofiles-munsell/munsell-data.json` uses a separate L* scale from chromatic `munsellValueToY` (e.g., `N 4` is `#3b3b3b` in data vs `#616161` via ASTM D1535 `munsellValueToY`); chromatic calibration tests should exclude `N` and parse `munsell-data.json` as JS object literals rather than strict JSON.

## 2.2.1
- **status**: `done`
- **files changed**: `tests/munsell.test.ts` (L1–3, L44–71, L116–197; 239 lines total); `src/core/munsell.ts` inspected, no edits needed
- **checks**:
  - `npm test -- tests/munsell.test.ts`: PASS (1/1 suite, 18/18 tests)
- **deviations**: none
- **gotchas for dependent tasks**: none

## 2.3.1
- **status**: `done`
- **files changed**: `tests/package.test.ts` (L1–3, L90–115; 117 lines total); `dist/` rebuilt via `npm run build`
- **checks**:
  - `npm run build && npm test -- tests/package.test.ts`: PASS (1/1 suite, 6/6 tests)
  - `node -e "...import('data:text/javascript;base64,' + b64)..."`: PASS (`{ a: '#6e5f4c', b: '#725d51' }`)
  - `node -e "const sz = require('fs').statSync('dist/core.esm.js').size..."`: PASS (`coreEsmBytes: 29742` / 29.0 KB `< 51200`)
- **deviations**: Updated test per revised acceptance criterion to read `dist/index.esm.js` inside the spawned Node `-e` script and import via `data:text/javascript;base64,` (avoids `"type": "commonjs"` `.js` ESM restriction and `argv` `E2BIG`).
- **gotchas for dependent tasks**: none
