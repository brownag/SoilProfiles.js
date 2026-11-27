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
| 2 | `4.2.1` | Port chosen candidate, allocation-free hot path | `pending` | | |
| 2 | `4.2.2` | Rare bounds 2.0, highC C ≤ 12, holdout test | `pending` | | |
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
