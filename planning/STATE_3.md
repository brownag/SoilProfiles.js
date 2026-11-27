# Orchestration 3 State

## Baseline (Pre-Wave 1)
- **Date**: 2026-11-27
- **Base commit**: `4ded6e9` on `feat/munsell-polynomial` (branched from `main` @ `9cd71fc`, PR #30 merge)
- **Test suite** (`npm test -- --runInBand`): PASS, 8/8 suites, 178/178 tests
- **Build + full check** (`make check`): PASS at `4ded6e9` (build, 178/178 tests, smoke ok)
- **Module size** (`npx esbuild src/utils/munsell-approx.ts --bundle --format=esm --minify`): 6,453 B minified / 2,529 B gzipped
- **Neutral baseline** (`munsellToHex('N', v, 0)`, v = 0…10 step 0.5): see EXECUTION_PLAN_3.md Recon
- **Worker / escalation models**: `haiku` → `sonnet`
- **Planning artifacts**: tracked (`git add -f`), separate `docs(planning):` commits; `planning/tasks/` untracked

## Wave Board

| Wave | Task | Title | Status | Worker model | Commit |
|---|---|---|---|---|---|
| 1 | `3.1.1` | munsellinterpol Lab fixture + generator | `done` | haiku | `49a159c` |
| 1 | `3.1.2` | CIEDE2000 test helper | `done` | haiku | `05cafc7` |
| 2 | `3.2.1` | Port M4e polynomial + numeric entry point | `done` | haiku | `839b8df` |
| 2 | `3.2.2` | Replace aqp tests with ΔE00 accuracy tests | `done` | haiku | `c3aa65f` |
| 3 | `3.3.1` | Numeric call path + memo in `munsellToHex`; drop string parser | `pending` | | |

## Task Reports

*(Worker reports are appended below as tasks complete, <=15 lines each.)*

## 3.1.1
- **Status**: done (haiku). Commit `49a159c` (cherry-picked from worktree `0dbb585`).
- **Files**: `scripts/make_munsellinterpol_fixture.py` (new, 65 lines); `tests/fixtures/munsell-reference-munsellinterpol.json` (new, 1,333 lines).
- **Tests**: the generator exits 0. 1,331 rows: highC 481, typical 444, gley 224, dark 132, red 128, light 64, redox 60. The rerun is byte-identical (worker, then the orchestrator re-ran it independently).
- **Deviations**: none. Domain tag order: typical, gley, red, highC, dark, light, redox.
- **Gotchas**: `value`/`chroma` are ints when integral, otherwise floats (e.g. 2.5). `xyY_to_lab` is copied from exp1.py, not imported.

## 3.1.2
- **Status**: done (haiku). Commit `05cafc7` (cherry-picked from worktree `9eaba6c`).
- **Files**: `tests/helpers/ciede2000.ts` (new, 96 lines: `Lab` type, `hexToLab`, `deltaE2000`); `tests/ciede2000.test.ts` (new, 45 lines, 9 tests).
- **Tests**: `npx jest tests/ciede2000.test.ts` 9/9. Sharma pair errors: 4.03e-5, 4.12e-5, 3.13e-5, 2.00e-5.
- **Deviations**: the spec was amended by the orchestrator (white tolerance 0.02, black `toBeCloseTo(0,10)`, `#664d33` mlib parity vector). See the Decision Log. This was a spec bug, not a worker retry.
- **Gotchas**: `hexToLab` reproduces mlib exactly, including white b = −0.0104. `hexToLab` accepts an optional `#`.

## Wave 1 close
- `make check` PASS. With `--testPathIgnorePatterns /.claude/`, the full jest run gives 9/9 suites and 187/187 tests (178 baseline + 9). Smoke ok.
- **Hazard found**: jest `testMatch` also collects `.claude/worktrees/**/tests`, so the full suite must run with no live worktrees (or with `--testPathIgnorePatterns '/.claude/'`). Agent worktrees are created from `main`, not the current branch: reset each one to the feature-branch HEAD before work starts.

## 3.2.1
- **Status**: done (haiku). Commit `839b8df` (cherry-picked from `baf03e2`).
- **Files**: `src/utils/munsell-approx.ts` (rewritten, 264 lines; +116/−316).
- **Tests**: `npx tsc --noEmit` exits 0. `npx jest tests/munsell.test.ts -t '^(?!.*closely approximate).*$'` 18 pass / 1 skipped. Neutral baseline bit-identical. Gzipped size **2,451 B** (baseline 2,529).
- **ΔE00 (mean/p95/max)**: typical 0.420/0.966/1.434; gley 0.595/1.627/2.546; red 0.535/1.161/2.001; highC 0.451/1.199/2.180; dark 0.933/2.101/2.546; light 0.418/0.911/1.075; redox 0.386/0.831/1.054. The orchestrator reproduced these independently.
- **Blocked once**: gley/dark max 2.546 (chip 5GY 2/2) was in the (2.5, 2.6] stop band. The user loosened the rare bound to 2.6 (see Decision Log). No code change.
- **Deviations**: `labToXyz` now takes `fy`; `LabColor`/`ChromaPoint` removed. `COEF_A`/`COEF_B` are `export`ed (not in spec; 3.3.1 makes them module-private).
- **Discovered**: `scripts/mlib.py`, `bench.ts`, `bench2.ts`, `dump_ts.ts` reference removed symbols (`hueData`, `interpolateLab`). Left as the research record.

## 3.2.2
- **Status**: done (haiku). Commit `c3aa65f` (cherry-picked from `7b523d0`, which was amended for the 2.6 bound).
- **Files**: `tests/munsell.test.ts` (imports + `loadInterpolRows` helper at 1-17; tests ~151-212); `tests/fixtures/munsell-reference-soil.json` deleted.
- **Tests**: against the pre-M4e model in its worktree, 6 expected failures / 19 pass (typical mean 1.116, max 5.117; rare max: gley 3.18, red 5.69, highC 5.08, dark 6.11, light 2.94, redox 1.82). After merge with 3.2.1: 25/25 pass.
- **Deviations**: none (bound amended by the user decision).

## Wave 2 close
- Merged on `feat/munsell-polynomial` @ `c3aa65f`. Worktrees removed. `make check` PASS: 9/9 suites, 193/193 tests (187 − 1 aqp test + 7 new), smoke ok.
- **Follow-up (user request)**: a dark/gley parity research prompt is in `planning/PROMPT_dark_gley_parity.md` (untracked). The residual is a chroma error at V ≤ 2: greens are over-saturated at V2, reds under-saturated at V1; L* is correct.
