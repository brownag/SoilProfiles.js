# Orchestration 4 State

## Baseline (Pre-Wave 1)
*(Recorded 2026-11-27. Deviation: PR #31 still open, so the branch stacks on its HEAD — see Decision Log.)*
- [x] **Date / base commit**: 2026-11-27, `feat/munsell-polynomial` @ `64a0cb0` (PR #31 HEAD, unmerged)
- [x] **Branch**: `feat/munsell-low-value-fit` created from that commit; plan files committed (`docs(planning):`)
- [x] **`make check`**: 9/9 suites, 193/193 tests, smoke ok
- [x] **Module size**: 4,430 B minified / 2,325 B gzipped
- [x] **Neutral baseline**: identical to EXECUTION_PLAN_4.md Recon
- [x] **Untracked inputs present in main checkout**: `scripts/mi_xyY.csv`, `.development/dark_parity.py`, `docs/research/munsell-dark-parity.md`
- **Worker / escalation models**: 4.1.1 `sonnet`; others `haiku` → `sonnet`
- **Planning artifacts**: tracked (`git add -f`), separate `docs(planning):` commits; `planning/tasks/` untracked

## Wave Board

| Wave | Task | Title | Status | Worker model | Commit |
|---|---|---|---|---|---|
| 1 | `4.1.1` | Low-value fit script, coefficient tables, holdout fixture | `done` | sonnet | `78a0715` |
| gate | — | User picks candidate; holdout bounds set | `done` (hinge, all-points fit) | — | — |
| 2 | `4.2.1` | Port chosen candidate, allocation-free hot path | `done` | haiku (1 retry) | `65f245f` |
| 2 | `4.2.2` | Rare bounds 2.0, highC C ≤ 12, holdout test | `done` | haiku | `dbc29f8` (cherry-picked from `778b6d8`) |
| 3 | `4.3.1` | Commit research report, portable and descriptive | `pending` | | |
| 3 | `4.3.2` | NEWS 0.3.0 and README accuracy line | `pending` | | |

## Task Reports

*(The orchestrator appends worker reports below as tasks complete, <=15 lines each.)*

## 4.1.1
- **Status**: done (one re-scope at the gate: first run blocked on dark 5Y 1/4 = 2.143 with the holdout-excluded fit; the user chose the all-points fit plus hinge).
- **Files**: created `scripts/fit_low_value_models.py` (178 lines), `scripts/munsell-ab-{shape,hinge}-coefficients.json` (all-points fit), `scripts/low-value-fit-results.json` (`current`; `shape`/`hinge` × `all_points`/`holdout_excluded`), `tests/fixtures/munsell-reference-holdout.json` (1,187 rows; 95 low; 77 gley).
- **Commit**: `78a0715` feat(scripts): add low-value munsell fit script, coefficient tables and holdout fixture.
- **Tests**: script exits 0; a second run is byte-identical (verified by the worker and again by the orchestrator: clean `git status` after a re-run). The all-points metrics match report §3 exactly. Holdout-excluded hinge holdout 0.447/2.822, 0.470/2.143, 0.418/1.406 matches §4.
- **Shipped hinge (all_points), main fixture max**: typical 0.383 mean / 1.433 max; gley 1.530; red 1.854; highC (C ≤ 12) 1.227; dark 1.807; light 1.084; redox 0.813. Holdout: all 0.434/2.647, low 0.430/1.545, gley 0.389/1.406.
- **Honest generalization (hinge holdout_excluded)**: holdout all 0.447/2.822, low 0.470/2.143, gley 0.418/1.406; main-fixture dark max 2.143 (5Y 1/4, held out).
- **Gotchas**: hinge JSON `coef_a`/`coef_b` are 20 × 9, and the anchors start `10RP, 5R, 10R` (assert against `HUE_ANCHOR_ORDER`). The holdout fixture is in-sample for the shipped coefficients, so its bounds are optimistic.

## 4.2.1
- **Status**: done after one retry. The first attempt measured 2,537 B gzip (> 2,525). The orchestrator approved flattening `COEF_A`/`COEF_B` into flat row-major arrays (9 per anchor, offset `9*i`), with the bound unchanged.
- **Files**: `src/utils/munsell-approx.ts`. Flat tables at :25 and :48, generated from `scripts/munsell-ab-hinge-coefficients.json` (the orchestrator verified all 360 values equal the JSON). `f_inv`, `gamma_correct` and `clamp` are module-level functions. `dot9(row, o, c0..c8)`. Lab → XYZ → sRGB is inlined with locals.
- **Commit**: `65f245f` feat(munsell): port the hinge-term model with an allocation-free hot path.
- **Tests**: `tsc --noEmit` 0. The allocation grep shows only `HUE_FAMILIES`, `HUE_ANCHOR_ORDER`, `COEF_A`, `COEF_B`. Neutral baseline identical. ΔE00 matches `hinge.all_points` within 0.002. Targeted jest: 19 pass, 6 skipped.
- **Orchestrator end-of-wave measurement (one run, vs `64a0cb0`)**: 4,794 B minified / **2,510 B gzipped** (baseline 4,430 / 2,325, so +364 / +185). Uncached `munsellToHex` 10YR 4/3: old 528.3/496.4 ns, new 483.2/498.2 ns (two rounds; no slowdown). Cached: old 64.8/67.8, new 73.4/72.4 ns (the memo path is unchanged).
- **Shipped accuracy (main fixture, mean/max)**: typical 0.383/1.433. Rare max: gley 1.530, red 1.854, highC (C ≤ 12) 1.227, dark 1.807, light 1.084, redox 0.813. Holdout (in-sample): all 0.434/2.647, low 0.430/1.544, gley 0.389/1.406. Honest holdout (fit excluding it): all 0.447/2.822, low 0.470/2.143, gley 0.418/1.406.
- **Gotcha**: regenerated tables must keep the flat layout.

## 4.2.2
- **Status**: done. **File**: `tests/munsell.test.ts`. `loadInterpolRows(fixture)` takes the fixture name. The rare `it.each` is bounded at 2.0, with highC filtered to C ≤ 12 (365 of 481 rows). New `it.each` holdout test: all ≤ 0.5/2.9, low ≤ 0.5/1.8, gley max ≤ 1.7. It prints `[rare …]`/`[holdout …]` with `console.log`.
- **Commit**: `778b6d8` on `o4/4.2.2`, cherry-picked to `dbc29f8`.
- **Tests**: against the old model, 5 failed as expected (gley 2.546, red 2.0006, dark 2.546, holdout low 0.795/2.266, holdout gley 2.266). After merging: `npx jest --testPathIgnorePatterns /.claude/ -- tests/munsell.test.ts` 28/28 pass.

## Wave 2 end
- `make check` (worktrees removed): 9/9 suites, **196/196** tests, smoke ok. Neutral baseline identical.
- Gotcha: with worktrees present, `npx jest tests/munsell.test.ts` also runs the worktree copies. Use `--testPathIgnorePatterns /.claude/`.
