# Execution Plan 3: Value-Dependent Polynomial Munsell Model (M4e)

## Goal & Scope

Implement the value-dependent polynomial Munsell model (candidate M4e: 20 hue anchors × 8 coefficients × 2 for a\*/b\*) recommended in `docs/research/munsell-approximation.md`, replacing the value-independent anchor grid in `src/utils/munsell-approx.ts`. Calibrate and test against munsellinterpol instead of aqp, fix the mislabelled "ASTM D1535" comment, and pass numbers internally instead of re-parsing an `"H V/C"` string.

### In Scope
- **Reference fixture**: committed generator script that builds a munsellinterpol-based CIELAB fixture covering the typical and rare soil domains of research §2.3.
- **CIEDE2000 test helper**: `hexToLab` + `deltaE2000` for tests, verified against published Sharma et al. (2005) pairs.
- **M4e model**: replace `hueData` + chroma-segment interpolation with the polynomial from `scripts/candidate_M4e.json`; add numeric entry point `munsellToHexApprox(hue, value, chroma)`.
- **Cheap CPU work** (user chose "all incl. memoization"): numeric path with no string round trip, single integer `toString(16)` hex formatting, `cbrt(Y)` directly instead of L\*→`(L+16)/116`, and a capped `Map` memo in `munsellToHex`.
- **Comment fix**: the value polynomial is Newhall, Nickerson & Judd (1943), MgO-relative — not ASTM D1535-08.
- **Test replacement**: remove the aqp fixture and its tests; add ΔE00 accuracy tests against the new fixture; re-point the neutral-gray test at the new fixture.

### Out of Scope
- Switching the value scale to ASTM D1535-08 (research §8.4). Neutral output must stay bit-identical.
- The M1g value × chroma grid, polar (LCh) hue blending, the 460-chip hex LUT (M6), and 40-hue variants.
- Refitting coefficients. M4e is ported as fitted; `scripts/exp1.py` stays the record of how it was fitted.
- Modifying `docs/research/munsell-approximation.md` or anything else under `scripts/` except the one new generator script.
- Unrelated renderers (`src/render/three3d.ts`, `src/render/interactive.ts`).
- Any remote action (push, PR). The orchestrator asks the user first.

### Verbatim Constraints
- "Implement the value-dependent polynomial Munsell model (candidate M4e, 20 hues × 8 coefficients × 2) recommended in docs/research/munsell-approximation.md, replacing the anchor grid in src/utils/munsell-approx.ts"
- "calibrate/test against munsellinterpol instead of aqp"
- "fix the mislabelled ASTM D1535 comment"
- "pass numbers internally instead of re-parsing the "H V/C" string"

---

## Decision Log

- **2026-11-27 — Branch**: PR #30 is merged (`9cd71fc`). Work on `feat/munsell-polynomial`, branched from the latest `main`. The research commit was carried over as `4ded6e9`.
- **2026-11-27 — Fixture & metric**: Lab fixture + ΔE00 tests. Use 1,331 rows (measured from `mi_xyY.csv` with the domain predicates: highC 481, typical 444, gley 224, dark 132, red 128, light 64, redox 60; rows can carry several tags) covering typical, gley, red-page, high-chroma, dark, light and redox chips, and store D65 Lab. Thresholds: typical mean ≤ 0.5 and max ≤ 2.0; each rare domain max ≤ 2.6.
- **2026-11-27 — aqp fixture**: Replace it entirely. Delete `tests/fixtures/munsell-reference-soil.json` and its calibration test. Re-point the neutral-gray test at the new fixture's chroma-1 chips.
- **2026-11-27 — CPU scope**: Do all of it: numeric path, single-`toString` hex, `cbrt` shortcut, and memoization. Orchestrator default: the memo is a module-level `Map` capped at 4,096 entries and cleared when full.
- **2026-11-27 — Value scale**: Keep the Newhall 1943 polynomial and fix only the comment (from the user's request).
- **2026-11-27 — Internal API**: `munsellToRgbApprox(string)`, `hueData` and `interpolateLab` have no callers outside `src/core/munsell.ts` and are not re-exported from `src/index.ts` or `src/core.ts`, so they are removed. `parseMunsellHueAngle` stays exported. (Orchestrator default, from recon.)
- **2026-11-27 — Models**: Workers run on `haiku`; escalate to `sonnet` per the escalation ladder.
- **2026-11-27 — 3.1.2 white tolerance (orchestrator amendment)**: the spec's 0.01 white-point bound was wrong for the `mlib` constants (white b = −0.0104 in the reference itself). Loosened to 0.02 and added an `mlib` parity vector. This is a spec fix, not a worker retry.
- **2026-11-27 — Rare-domain bound (user decision)**: the M4e port measured gley and dark max ΔE00 = 2.546, both from the single chip 5GY 2/2. This matches the research's rounded 2.5. The user chose to loosen the rare-domain max from 2.5 to **2.6** for all six rare domains. Typical bounds are unchanged (mean ≤ 0.5, max ≤ 2.0).
- **2026-11-27 — Planning artifacts**: Track `EXECUTION_PLAN_3.md`, `PROMPT_TEMPLATE_3.md` and `STATE_3.md` with separate `docs(planning):` commits. `planning/tasks/*.todo.md` stays untracked.

---

## Recon & Hazard Notes

- **Baseline** (`feat/munsell-polynomial` @ `4ded6e9`): `npm test -- --runInBand` passes 8/8 suites and 178/178 tests.
- **Module size baseline**: `npx esbuild src/utils/munsell-approx.ts --bundle --format=esm --minify | gzip -9 | wc -c` gives **2,529 B** gzipped (6,453 B minified).
- **Neutral baseline (must stay bit-identical)**: `munsellToHex('N', v, 0)` for v = 0, 0.5, …, 10 gives
  `#000000 #101010 #1d1d1d #272727 #313131 #3d3d3d #484848 #555555 #616161 #6e6e6e #7b7b7b #888888 #959595 #a2a2a2 #afafaf #bdbdbd #cacaca #d8d8d8 #e5e5e5 #f3f3f3 #ffffff`.
- **Dark-branch hazard**: `munsellToRgbApprox` computes `L = 116·Y^(1/3) − 16` unconditionally, but `labToXyz.f_inv` uses the linear branch below `6/29`. For Y < 0.008856 (V < about 1), those two disagree. The `cbrt` shortcut must keep this behaviour: set `fy = Math.cbrt(Y)` and keep `f_inv` for x, y and z exactly as it is. Do **not** set `yr = Y` directly, or N 0.5 changes.
- **Worktree hazard**: `scripts/mi_xyY.csv` is git-ignored, so it is **absent in worktrees**. Pass the main checkout's absolute path: `/home/andrew/workspace/SoilProfiles.js/scripts/mi_xyY.csv`. `scripts/candidate_M4e.json`, `scripts/mlib.py` and `scripts/exp1.py` are tracked.
- **Agent worktree base hazard** (found in Wave 1): `isolation: worktree` branches from `main`, not the current branch. The orchestrator resets each worker worktree to the feature-branch HEAD before work starts. Jest also collects `.claude/worktrees/**`, so full suites run only when no worktrees are live.
- **Python**: numpy 2.5.3 and scipy 1.18.1 are installed. R's `munsellinterpol` is **not** installed, so do not try to regenerate `mi_xyY.csv`.
- **`python3 -I` hazard**: `-I` drops the script directory from `sys.path`, so `import mlib` fails. The generator must do `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` before importing `mlib`.
- **Jest**: `testMatch: ['**/tests/**/*.test.ts']`, so `tests/helpers/*.ts` (no `.test.`) is not collected as a suite. ts-jest, jsdom.
- **Planning `.gitignore`**: `planning/.gitignore` is `*`. Commit plan files with `git add -f planning/EXECUTION_PLAN_3.md planning/PROMPT_TEMPLATE_3.md planning/STATE_3.md`.
- **Temp/scratch**: use `.development/` (untracked) and delete it before reporting. Never commit scratch files.
- **Serial suite rule**: workers run only their targeted commands. The orchestrator runs `make check` serially at wave end.
- **Expected M4e accuracy** (research §6, ΔE00 vs munsellinterpol, mean / p95 / max, rounded to 0.1 for max): typical 0.42 / 0.96 / 1.4; gley 0.59 / 1.62 / 2.5; red 0.53 / 1.14 / 2.0; high-C 0.45 / 1.20 / 2.2; dark 0.93 / 1.98 / 2.5; light 0.42 / 0.90 / 1.1; redox 0.39 / 0.83 / 1.1. **The gley and dark maxima sit at the 2.5 threshold after rounding.** If a measured max is in (2.5, 2.6], the worker stops and reports the exact number. The orchestrator then asks the user whether to loosen that bound; workers never loosen it themselves.
- **Escalation rules**:
  1. Micro-plan off-spec twice: the orchestrator writes the micro-TODO itself.
  2. Acceptance fails after one retry (`FAILED VERIFICATION: …`): stop the `haiku` worker and re-run on `sonnet`. Never a third small-model attempt.
  3. Malformed or missing report: one retry with feedback, then `sonnet`.
  4. Out-of-scope edit needed: re-scope this plan. Never widen permissions ad hoc.

---

## Wave / Dependency Table

| Wave | Task | Title | Files in scope | Depends on |
|---|---|---|---|---|
| **1** data & tooling | `3.1.1` | munsellinterpol Lab fixture + generator | create `scripts/make_munsellinterpol_fixture.py`, `tests/fixtures/munsell-reference-munsellinterpol.json` | — |
| **1** | `3.1.2` | CIEDE2000 test helper | create `tests/helpers/ciede2000.ts`, `tests/ciede2000.test.ts` | — |
| **2** model & tests | `3.2.1` | Port M4e polynomial + numeric entry point | edit `src/utils/munsell-approx.ts` | 3.1.1, 3.1.2 |
| **2** | `3.2.2` | Replace aqp tests with ΔE00 accuracy tests | edit `tests/munsell.test.ts`; delete `tests/fixtures/munsell-reference-soil.json` | 3.1.1, 3.1.2 |
| **3** wrapper | `3.3.1` | Numeric call path + memo in `munsellToHex`; drop string parser | edit `src/core/munsell.ts`, `src/utils/munsell-approx.ts` | 3.2.1, 3.2.2 |

Files are pairwise disjoint within each wave. Wave 2 tasks run in separate worktrees, and their combined result is verified only after the orchestrator merges both (see 3.2.2's acceptance).

---

## Task Specs

### 3.1.1 — munsellinterpol Lab fixture + generator
- **Repo**: SoilProfiles.js. **Depends on**: none.
- **Files in scope**: create `scripts/make_munsellinterpol_fixture.py` and `tests/fixtures/munsell-reference-munsellinterpol.json`. Read-only: `scripts/mlib.py`, `scripts/exp1.py`.
- **Spec**:
  - Write a Python script, run as `python3 -I scripts/make_munsellinterpol_fixture.py <mi_xyY.csv> <out.json>`.
  - Import `mlib`; see the `-I` hazard.
  - For every row of `mi_xyY.csv` (columns `hue,value,chroma,x,y,Y`), compute the reference Lab exactly like `exp1.py:57-65`:
    1. `xyY_to_lab(x, y, Y*1.02568/100)` using `mlib.M_C2D65` and `mlib.WP`.
    2. Then `mlib.rgb_to_lab(mlib.quant(mlib.lab_to_rgb(L, a, b)))`.
  - Tag each row with every domain it belongs to, using the predicates copied verbatim from `exp1.py:27-39`: `typical`, `gley`, `red`, `highC`, `dark`, `light`, `redox`. Keep only rows with at least one tag.
  - Output strict JSON:
    `{"source": "munsellinterpol 3.6-0 MunsellToxyY, Bradford C->D65, Y x1.02568 (Newhall scale), sRGB-quantized", "columns": ["hue","value","chroma","L","a","b","domains"], "rows": [["10YR",4,2,L,a,b,["typical"]], ...]}`.
  - Round Lab to 3 decimals. Write one row per line for diffability.
- **Anchors**: `exp1.py` lines 27-39 (domain predicates), 50-65 (MI load + Lab); `mlib.py` `M_C2D65`, `WP`, `lab_to_rgb`, `quant`, `rgb_to_lab`.
- **Constraints**: do not edit `mlib.py`, `exp1.py` or any other script. Do not commit `mi_xyY.csv`.
- **Acceptance**:
  - `python3 -I scripts/make_munsellinterpol_fixture.py /home/andrew/workspace/SoilProfiles.js/scripts/mi_xyY.csv tests/fixtures/munsell-reference-munsellinterpol.json` exits 0.
  - `python3 -c "import json;d=json.load(open('tests/fixtures/munsell-reference-munsellinterpol.json'));r=d['rows'];import collections;print(len(r), collections.Counter(t for x in r for t in x[6]))"` prints 1,331 rows with domain counts highC 481, typical 444, gley 224, dark 132, red 128, light 64, redox 60.
  - Rerunning the generator produces a byte-identical file.
  - Report the row count and per-domain counts.

### 3.1.2 — CIEDE2000 test helper
- **Repo**: SoilProfiles.js. **Depends on**: none.
- **Files in scope**: create `tests/helpers/ciede2000.ts` and `tests/ciede2000.test.ts`.
- **Spec**:
  - Export `hexToLab(hex: string): [number, number, number]`. It goes sRGB → linear → XYZ → D65 Lab, using the same constants as `scripts/mlib.py:rgb_to_lab`: matrix `M_XYZ`, white `WP = [0.95047, 1, 1.08883]`, threshold `216/24389`, and linear branch `(24389/27·t + 16)/116`.
  - Export `deltaE2000(lab1, lab2): number` per Sharma, Wu & Dalal (2005), with kL = kC = kH = 1. Port `scripts/mlib.py:de2000`.
  - The test file asserts these published pairs to within 1e-4:
    - (50, 2.6772, −79.7751) vs (50, 0, −82.7485) → 2.0425
    - (50, 0, 0) vs (50, −1, 2) → 2.3669
    - (50, 2.5, 0) vs (73, 25, −18) → 27.1492
    - (60.2574, −34.0099, 36.2677) vs (60.4626, −34.1751, 39.4387) → 1.2644
  - Also assert `hexToLab('#ffffff')` ≈ [100, 0, 0] within 0.02 and `hexToLab('#000000')` ≈ [0, 0, 0] (`toBeCloseTo(0, 10)`). *(Amended 2026-11-27: `mlib.rgb_to_lab` itself gives white b = −0.0104 because the `M_XYZ` row sums do not equal `WP`.)*
  - Parity with `mlib.rgb_to_lab`: `hexToLab('#664d33')` ≈ [34.7450, 6.8739, 19.4483] within 1e-3.
- **Anchors**: `scripts/mlib.py` `def de2000` (line ~63) and `def rgb_to_lab` (line ~51).
- **Reference implementation**: `scripts/mlib.py:de2000`.
- **Constraints**: no new dependencies; test-only code (nothing under `src/`).
- **Acceptance**: `npx jest tests/ciede2000.test.ts` passes. `tsconfig.json` includes only `src/**/*`, so ts-jest's type-check during this run is the type gate.

### 3.2.1 — Port M4e polynomial + numeric entry point
- **Repo**: SoilProfiles.js. **Depends on**: 3.1.1, 3.1.2.
- **Files in scope**: edit `src/utils/munsell-approx.ts`. Scratch scripts go in `.development/`.
- **Spec**:
  1. Replace `hueData`, `interpolateChromaLab` and `interpolateLab` with two `readonly number[][]` tables, `COEF_A` and `COEF_B` (20 × 8). Generate them **mechanically** from `scripts/candidate_M4e.json` (`coef_a`, `coef_b`) and paste them; do not hand-type. The anchor order is `HUE_ANCHOR_ORDER` (identical to the JSON's `anchors`; assert this in the scratch check).
  2. For a chromatic hue:
     - `angle = parseMunsellHueAngle(hue)`, `i0 = Math.floor(angle/5) % 20`, `i1 = (i0+1) % 20`, `t = (angle − 5·i0)/5`.
     - `Cc = Math.min(C, 12)`; basis = `[Cc, Cc·V, Cc·V², Cc·V³, Cc², Cc²·V, Cc²·V², Cc³]`.
     - `a = (1−t)·dot(COEF_A[i0], basis) + t·dot(COEF_A[i1], basis)`, and the same for `b`.
     - If `C > 12`, multiply a and b by `C/12`.
     - Chroma 0 or hue `N` gives a = b = 0.
  3. Add the exported `munsellToHexApprox(hue: string, value: number, chroma: number): string | null`, taking an already-normalized uppercase hue or `N`. Return null for a non-finite value or chroma, value outside [0, 10], chroma < 0, or an unparseable chromatic hue.
  4. Keep `munsellToRgbApprox(munsellString)` for now as a thin parser that calls `munsellToHexApprox` (3.3.1 removes it).
  5. Use `fy = Math.cbrt(Y)` instead of computing L and then `(L+16)/116`. Keep `f_inv` for x, y and z unchanged (see the dark-branch hazard).
  6. Format hex with a single integer: `'#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)`, where r, g, b = `Math.round(clamped·255)`.
  7. Fix the `munsellValueToY` doc comment. It is the Newhall, Nickerson & Judd (1943) MgO-relative polynomial; say that it is not ASTM D1535-08 (1.1914…). Update the file header's step list to describe the polynomial.
- **Anchors**: `hueData` (~:34-220), `interpolateChromaLab` (~:255), `munsellValueToY` (~:289-301), `interpolateLab` (~:310), `labToXyz` (~:342), `munsellToRgbApprox` (~:405), hex `toHex` (~:458).
- **Constraints**: do not change `parseMunsellHueAngle`'s behaviour, the Newhall coefficients, the Lab→XYZ→sRGB matrices or the clamp.
- **Acceptance** (all must hold):
  - `npx tsc --noEmit` exits 0.
  - `npx jest tests/munsell.test.ts -t '^(?!.*closely approximate).*$'` passes. The aqp calibration test is excluded because 3.2.2 deletes it.
  - A `.development/check.ts` run with `npx tsx` prints the neutral baseline string from Recon, **identical**.
  - The same scratch script loads the 3.1.1 fixture and uses the 3.1.2 helper to print per-domain ΔE00 mean / p95 / max for `munsellToHexApprox`. Required: typical mean ≤ 0.5 and max ≤ 2.0; every rare domain max ≤ 2.6. Report all numbers. (Bound loosened from 2.5 by user decision; see Decision Log.)
  - `npx esbuild src/utils/munsell-approx.ts --bundle --format=esm --minify | gzip -9 | wc -c` ≤ 2,529.
  - Delete `.development/`.

### 3.2.2 — Replace aqp tests with ΔE00 accuracy tests
- **Repo**: SoilProfiles.js. **Depends on**: 3.1.1, 3.1.2.
- **Files in scope**: edit `tests/munsell.test.ts`; delete `tests/fixtures/munsell-reference-soil.json`.
- **Spec**:
  1. Delete the test `should closely approximate reference sRGB values across common soil hues` and the aqp fixture file.
  2. Add `should match munsellinterpol within ΔE00 bounds on typical soil colors`:
     - Load `tests/fixtures/munsell-reference-munsellinterpol.json`.
     - For rows tagged `typical`, compute `deltaE2000(hexToLab(munsellToHex(h, v, c)), [L, a, b])`.
     - Assert mean ≤ 0.5 and max ≤ 2.0.
  3. Add `should stay within ΔE00 2.6 on rare soil colors`. It is table-driven (`it.each` or a loop with a domain label in the failure message) over `gley`, `red`, `highC`, `dark`, `light` and `redox`, asserting max ≤ 2.6 for each.
  4. Rewrite `should place neutral grays on the same value scale as chromatic colors`:
     - For each value in [2, 2.5, 3, 4, 5, 6, 7, 8] that has `typical` chroma-1 rows in the fixture, take the mean L of those rows.
     - Assert that `munsellToHex('N', v, 0)` is r = g = b, that `|hexToLab(gray)[0] − meanL| ≤ 1.0`, and that L increases strictly with v.
     - Keep the explanatory comment about aqp's measured neutral chips, and add that the fixture is munsellinterpol.
  5. Import the helpers from `./helpers/ciede2000`. Remove now-unused imports.
- **Anchors**: `tests/munsell.test.ts` lines 151-202 (two tests to replace); `readFileSync` and `path` imports at lines 1-2.
- **Constraints**: no other tests in the file change. Do not edit `src/`.
- **Acceptance**:
  - `npx jest tests/munsell.test.ts` runs. Every test passes **except** the two new accuracy tests, which are expected to fail against the pre-M4e model in this worktree. Report their measured numbers, roughly typical mean 1.1 and rare maxima 3–6.
  - The orchestrator re-runs the file after merging 3.2.1 and 3.2.2, and all tests must pass.
  - `git status` shows `tests/fixtures/munsell-reference-soil.json` deleted.

### 3.3.1 — Numeric call path + memo in `munsellToHex`; drop string parser
- **Repo**: SoilProfiles.js. **Depends on**: 3.2.1, 3.2.2.
- **Files in scope**: edit `src/core/munsell.ts` and `src/utils/munsell-approx.ts`.
- **Spec**:
  1. In `munsellToHex`, after the existing validation, call `munsellToHexApprox(normalizedHue, numValue, numChroma)` directly. Delete the `"HUE VALUE/CHROMA"` string build and the try/catch if nothing can throw.
  2. Add a module-level `const cache = new Map<string, string | null>()`, keyed `` `${normalizedHue}|${numValue}|${numChroma}` `` and populated only after validation passes. When `cache.size >= 4096`, call `cache.clear()` before inserting. Cache null results from `munsellToHexApprox` too.
  3. Remove `munsellToRgbApprox` from `src/utils/munsell-approx.ts`. Confirm with grep that there are no other references in `src/`, `tests/` or `examples/` (the `examples/soilknowledgebase-demo.js` list only names built file paths).
  4. Keep every validation rule in `munsellToHex` unchanged: neutral chroma handling, hue regex, value range and negative chroma.
- **Anchors**: `src/core/munsell.ts` `munsellToHex` (lines ~12-70, string build ~:59-66); `src/utils/munsell-approx.ts` `munsellToRgbApprox`.
- **Constraints**: the public exports of `src/core/munsell.ts` (`munsellToHex`, `isMunsellValid`) keep their signatures.
- **Acceptance**:
  - `npx tsc --noEmit` exits 0.
  - `npx jest tests/munsell.test.ts tests/package.test.ts` passes (`package.test.ts` builds dist itself; if not, run `npm run build` first).
  - `grep -rn "munsellToRgbApprox" src tests examples` returns nothing.
  - The neutral baseline string is unchanged (re-run the 3.2.1-style scratch check in `.development/`, then delete it).
  - Report `munsellToHex` ns per call for 10YR 4/3 over 1e6 iterations, uncached (distinct values) and cached (same input), using a scratch benchmark.

---

## Orchestrator end-of-orchestration checks
- `make check` (build + full jest + smoke), run serially.
- Module size via the esbuild command, recorded in STATE_3.md next to the 2,529 B baseline.
- No push or PR without explicit user instruction.
