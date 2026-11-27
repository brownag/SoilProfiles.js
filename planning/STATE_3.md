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
| 2 | `3.2.1` | Port M4e polynomial + numeric entry point | `pending` | | |
| 2 | `3.2.2` | Replace aqp tests with ΔE00 accuracy tests | `pending` | | |
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
