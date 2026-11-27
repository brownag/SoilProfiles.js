# Execution Plan 4: Low-value (dark/gley) Munsell parity

## Goal & Scope

The value-dependent polynomial from orchestration 3 renders a few dark and low-value gley colours up to 2.546 ΔE00 from munsellinterpol. The worst is 5GY 2/2. Bring every rare soil-colour domain to max ≤ 2.0 ΔE00 without giving up the module's size and speed. This follows `docs/research/munsell-dark-parity.md` (written by a separate research agent and still untracked), and the goals G1–G7 in `planning/GOALS.md`.

The fit must be reproducible from committed code. An honest holdout test must check accuracy off the fixture grid. The hot path must not allocate.

### In Scope
- **Fit script (G1).** A committed, deterministic script fits two candidates on an 80% training split:
  - the **shape-term swap**: 8 terms, `C·V³` replaced by `C·(1−V/10)⁸`;
  - the **9th hinge term**: `C·max(0, 3−V)²` appended.

  Both weight dark and gley colours 4×. The script writes both coefficient tables, per-domain metrics, holdout metrics and a holdout reference fixture. **The user picks the shipped candidate at the Wave 1 gate.**
- **Production model (G2 + G5).** Port the chosen candidate into `munsellToHexApprox` with an unrolled, allocation-free hot path.
- **Tests (G3 + G4).**
  - Every rare domain has max ≤ 2.0. highC is filtered to chroma ≤ 12.
  - Typical stays at mean ≤ 0.5 and max ≤ 2.0.
  - A new holdout test checks the held-out reference points.
- **Docs (G6 + G7).**
  - Commit the research report with portable links and descriptive names, plus an "Implemented" section.
  - Update the `NEWS.md` 0.3.0 entry and the README accuracy line.

### Out of Scope
- The low-value correction table (+400 B) and the packed value × chroma grid (GOALS G8, G9).
- Polar hue blending, 40 hue anchors, single-slope correction (pruned in GOALS).
- Any change to the value scale (Newhall 1943), the Lab → sRGB constants, the clamp, `parseMunsellHueAngle`, or neutral output.
- Weighting the fit toward high chroma. The user ruled that C 13–14 chips such as 10R 8/14 and 10R 4/13 are not real soil colours.
- Changes to the main fixture's rows or domain tags, or to `scripts/make_munsellinterpol_fixture.py`.
- Regenerating `scripts/mi_xyY.csv` (R munsellinterpol is not installed).
- Any remote action (push, PR) without explicit user instruction.

### Verbatim Constraints
- "i dont see why this should add +400B gzipped. i dont think the regressions are that significant, these are almost imperceptible changes in the color"
- "can we set the rare domains at max of 2?"
- "yeah, 10R 8/14 is not a concern at all. that is not a real soil color"
- Goals G4 (holdout test) and G10 (no allocations) are in scope at the user's request. G10 is task 4.2.1 here.

---

## Decision Log

- **2026-11-27 — Candidates**: fit both the shape-term swap and the 9th hinge term, then choose at the Wave 1 gate. The user picks; workers never pick.
- **2026-11-27 — Bounds**: all six rare domains (gley, red, highC, dark, light, redox) have max ≤ 2.0. Typical stays at mean ≤ 0.5 and max ≤ 2.0.
- **2026-11-27 — highC range**: the highC test and metrics use only chroma ≤ 12, the fitted range. C 13–14 is extrapolated and not a real soil colour. Fixture tags are unchanged; the filter lives in the test and the fit script.
- **2026-11-27 — No high-chroma weighting**: follows from the highC range decision. Both candidates use residual multiplier 3 for typical and an extra 4 for low/gley rows, the same as the research prototype.
- **2026-11-27 — Holdout**: the shipped coefficients are fit with the 20% holdout excluded. The holdout rule: SHA-256 of `"{hue}/{value}/{chroma}"`, first 8 hex digits as an int, mod 5 == 0, over the training pool V ≥ 1, C ≤ 12, finite Lab. Fixture numbers may shift by a few hundredths compared with the report's all-points fit.
- **2026-11-27 — Branch**: `feat/munsell-low-value-fit`, created from `main` **after PR #31 merges** (user choice). PR #31's CodeRabbit findings were fixed and pushed in `f71eae6`, `4d1bf08` and `64a0cb0`.
- **2026-11-27 — Branch (revised)**: PR #31 was still open at run time. The user chose to stack `feat/munsell-low-value-fit` on PR #31 HEAD `64a0cb0` and rebase onto `main` after #31 merges.
- **2026-11-27 — Wave 1 bound failure (gate)**: with the holdout excluded from the fit, both candidates miss dark max ≤ 2.0 on 5Y 1/4 (2.143), a held-out chip that is also in the main fixture. The user chose to **ship the all-points fit** (holdout included). The holdout-excluded fit is still computed and reported as the honest generalization measure (results JSON + docs). This supersedes the "Holdout" entry's "shipped coefficients are fit with the 20% holdout excluded". The holdout test now checks the shipped model on those points, which were in its training set.
- **2026-11-27 — Candidate (gate)**: the user picked **hinge** (9 terms, `C·max(0,3−V)²`). All-points hinge: typical 0.383/0.884/1.433, gley max 1.530, red 1.854, highC (C ≤ 12) 1.227, dark 1.807, light 1.084, redox 0.813. Holdout points: all 0.434/2.647, low 0.430/1.545, gley 0.389/1.406.
- **2026-11-27 — Holdout bounds (gate)**: `all` mean ≤ 0.5, max ≤ 2.9; `low` mean ≤ 0.5, max ≤ 1.8; `gley` max ≤ 1.7 (measured shipped max + 0.2, rounded up to 0.1).
- **2026-11-27 — Models**: 4.1.1 runs on `sonnet`. All other tasks run on `haiku` and escalate to `sonnet` per the ladder.
- **2026-11-27 — Planning artifacts**: track `EXECUTION_PLAN_4.md`, `PROMPT_TEMPLATE_4.md`, `STATE_4.md` and `GOALS.md` with `git add -f` in separate `docs(planning):` commits on the new branch. `planning/tasks/*.todo.md` stays untracked.
- **2026-11-27 — README**: do not link to the research doc from the README (user).

---

## Recon & Hazard Notes

- **Baseline**: record it on `main` after the PR #31 merge, before Wave 1. Expected: `make check` gives 9/9 suites and 193/193 tests, and the module is 4,430 B minified / 2,325 B gzipped. Measure uncached `munsellToHex` speed in the same run as the post-change benchmark, because absolute ns vary between runs (3.3.1 measured 778 ns).
- **Neutral baseline (must stay bit-identical)**: `munsellToHex('N', v, 0)` for v = 0, 0.5, …, 10:
  `#000000 #101010 #1d1d1d #272727 #313131 #3d3d3d #484848 #555555 #616161 #6e6e6e #7b7b7b #888888 #959595 #a2a2a2 #afafaf #bdbdbd #cacaca #d8d8d8 #e5e5e5 #f3f3f3 #ffffff`
- **Reference prototype**: `.development/dark_parity.py`, 196 lines, untracked, in the **main checkout only**. Relevant parts:
  - Lab from xyY: lines 10–15.
  - Domains: 16–20.
  - `basis` (kinds `shape`, `hinge`): 21–28.
  - `design` (hue-blended least-squares matrix): 29–36.
  - `render` (production-equivalent cbrt path): 37–41.
  - `metrics`: 42–45.
  - Training mask, weights and holdout: 61–67.
  - `fit` (column-normalized `scipy.linalg.lstsq`, `gelsy`, round to 6 decimals): 68–80.
  - Holdout evaluation: ~158–167.

  It imports `mlib`, which is now `scripts/munsell_color.py`. Use the same functions: `hue_angle`, `d1535_Y` (the Newhall polynomial despite its name), `lab_to_rgb`, `quant`, `rgb_to_lab`, `de2000`, `M_C2D65`, `WP`, `ANCH`.
- **Report numbers that validate the port**:
  - All-points fit (research report §3): `shape4` typical 0.415/0.974/1.778, gley 1.948, dark 1.948; `hinge4` typical 0.383/0.884/1.433, gley 1.530, dark 1.807, highC 2.135.
  - Holdout-excluded refit (report §4, the mode we ship): `hinge4` holdout all 0.447/2.822, low 0.470/2.143, gley 0.418/1.406 (mean/max).
- **highC with C ≤ 12** (orchestrator measurement on the all-points prototypes): hinge highC max drops from 2.135 to below 1.96. The shape swap's worst rare chip is 5GY 2/2 at 1.948.
- **Hot-path allocations today** (`src/utils/munsell-approx.ts`):
  - the `basis` array literal (~:203);
  - the `dot` closure (~:204);
  - `labToXyz` returns an object (~:119);
  - `xyzToRgb` returns an object (~:151).

  G5 removes all of them. So do the closures `f_inv`, `gamma_correct` and `clamp`, which become module-level functions. The returned hex string is the only allowed allocation. `parseMunsellHueAngle` (regex) and the memo key in `src/core/munsell.ts` are out of scope.
- **TS target ES2020**: `**` is allowed, but prefer repeated multiplication in the hot path: `(1−V/10)⁸` as three squarings.
- **Worktree hazards** (from orchestration 3):
  - Agent `isolation: worktree` branches from `main`, so the orchestrator creates worktrees itself at the branch HEAD.
  - Jest also collects `.claude/worktrees/**`, so full suites run only after the worktrees are removed.
  - `scripts/mi_xyY.csv`, `.development/` and `docs/research/munsell-dark-parity.md` are untracked or ignored and **exist only in the main checkout**. Tasks that need them run there.
- **`tsx` is not installed**. Run TS scratch code with `npx esbuild X.ts --bundle --platform=node --outfile=X.cjs && node X.cjs`.
- **`python3 -I`** drops the script directory from `sys.path`. Insert `os.path.dirname(os.path.abspath(__file__))` before `import munsell_color`.
- **`tests/package.test.ts`** tests whatever is in `dist/`, so run `npm run build` before it.
- **Wave 3 worktree**: 4.3.2 reads `STATE_4.md` from its worktree, so the orchestrator commits the Wave 2 reports to `STATE_4.md` **before** creating the Wave 3 worktree.
- **Main checkout branch**: 4.1.1 and 4.3.1 run in the main checkout. Before Wave 1 it must be on `feat/munsell-low-value-fit`; the untracked inputs carry over when switching branches.
- **Planning `.gitignore`** is `*`; commit plan files with `git add -f`.
- **Temp/scratch**: `.development/` already holds the research agent's files. Workers put their scratch in `.development/o4/` and delete only that subfolder.
- **Serial suite rule**: workers run only their targeted commands. The orchestrator runs `make check` serially at each wave end.
- **Escalation rules**:
  1. Micro-plan off-spec twice: the orchestrator writes the micro-TODO.
  2. Acceptance fails after one retry: re-run on `sonnet` (for 4.1.1, the orchestrator takes over or asks the user).
  3. Malformed report: one retry, then `sonnet`.
  4. An out-of-scope edit is needed: re-scope this plan.
  5. A numeric bound fails: stop and report the measured value. Never loosen it.

---

## Wave / Dependency Table

| Wave | Task | Title | Files in scope | Depends on | Model | Where |
|---|---|---|---|---|---|---|
| **1** fit & data | `4.1.1` | Low-value fit script, coefficient tables, holdout fixture | create `scripts/fit_low_value_models.py`, `scripts/munsell-ab-shape-coefficients.json`, `scripts/munsell-ab-hinge-coefficients.json`, `scripts/low-value-fit-results.json`, `tests/fixtures/munsell-reference-holdout.json` | — | sonnet | main checkout |
| **gate** | — | User picks the candidate; orchestrator sets the holdout bounds | `EXECUTION_PLAN_4.md` Decision Log | 4.1.1 | — | — |
| **2** model & tests | `4.2.1` | Port the chosen candidate, allocation-free hot path | edit `src/utils/munsell-approx.ts` | gate | haiku | worktree |
| **2** | `4.2.2` | Rare bounds 2.0, highC C ≤ 12, holdout test | edit `tests/munsell.test.ts` | gate | haiku | worktree |
| **3** docs | `4.3.1` | Commit the research report, portable and descriptive | create (track) `docs/research/munsell-dark-parity.md` | 4.2.1, 4.2.2 | haiku | main checkout |
| **3** | `4.3.2` | NEWS 0.3.0 and README accuracy line | edit `NEWS.md`, `README.md` | 4.2.1, 4.2.2 | haiku | worktree |

Files are pairwise disjoint within each wave. Wave 2's combined result is verified only after the orchestrator merges both tasks.

---

## Task Specs

### 4.1.1 — Low-value fit script, coefficient tables, holdout fixture
- **Repo**: SoilProfiles.js, main checkout (needs the untracked `scripts/mi_xyY.csv` and `.development/dark_parity.py`). **Depends on**: none. **Model**: sonnet.
- **Files in scope**: create the five files listed in the wave table. Read-only:
  - `.development/dark_parity.py`
  - `scripts/munsell_color.py`
  - `scripts/munsell-ab-polynomial-coefficients.json`
  - `tests/fixtures/munsell-reference-munsellinterpol.json`
  - `scripts/make_munsellinterpol_fixture.py`

  Scratch goes in `.development/o4/`.
- **Spec**:
  1. Usage: `python3 -I scripts/fit_low_value_models.py <mi_xyY.csv> <outdir>`, where `<outdir>` is `scripts/`. It also writes the holdout fixture to `tests/fixtures/`, located relative to the script. Import `munsell_color` via the `sys.path` insert.
  2. Port from `dark_parity.py`:
     - Lab from xyY (Bradford C → D65, Y × 1.02568 / 100, unclipped);
     - the training mask (V ≥ 1, C ≤ 12, finite);
     - the weights (typical ×3, plus ×4 on rows that are `(V ≤ 2.5 & C ≤ 4) | (gley-hue & C ≤ 4 & V ≤ 8)`, gley hues 10Y…5PB);
     - the holdout rule (Decision Log);
     - `basis` for `shape` and `hinge`;
     - `design`;
     - `fit` (see step 6 for which rows), column-normalized `lstsq` with `lapack_driver='gelsy'`, rounded to 6 decimals.

     Pass only the two models. Do not port the other experiments.
  3. Write `scripts/munsell-ab-shape-coefficients.json` and `scripts/munsell-ab-hinge-coefficients.json`. Each has keys:
     - `anchors` (= `munsell_color.ANCH`);
     - `basis`, a human-readable string listing the terms in order;
     - `coef_a` and `coef_b` (20 × 8 and 20 × 9 respectively);
     - `fit`, a short provenance string giving the weights and the holdout rule.
  4. Write `tests/fixtures/munsell-reference-holdout.json`, with the same layout as the main fixture: `source`, `columns`, one row per line. It holds the holdout rows of the training pool, in CSV order. Reference Lab is `rgb_to_lab(quant(lab_to_rgb(L, a, b)))`, rounded to 3 decimals. Tags:
     - `low` = V ≤ 2.5 & C ≤ 4;
     - `gley` = the gley-hue fitting mask;
     - `all` on every row.
  5. Write `scripts/low-value-fit-results.json`. For the current model and each candidate:
     - main-fixture metrics: mean / p95 / max per domain (typical, gley, red, highC filtered to C ≤ 12, dark, light, redox), rendered with the production-equivalent path from `dark_parity.py:render`, with C > 12 scaled by C/12;
     - holdout-fixture metrics: mean / max for `all`, `low` and `gley`;
     - the chip naming the worst case in each domain.

     Round floats to 4 decimals. Also print a compact table to stdout.
  6. *(Revised at gate.)* No `--all-points` flag. Every run fits each candidate twice: **all-points** (whole training pool, the shipped coefficients) and **holdout-excluded** (generalization check). The coefficient JSONs hold the all-points fit; their `fit` string says the holdout rule is used for reporting only. `low-value-fit-results.json` has, per candidate, `all_points` and `holdout_excluded` blocks, each with main-fixture and holdout metrics; `current` has one block. stdout prints both tables.
  7. Deterministic output: sorted keys where order is not meaningful, fixed formatting. Set `OPENBLAS_NUM_THREADS=1` inside the script before importing numpy (`os.environ.setdefault`).
- **Anchors**: `dark_parity.py` lines listed in Recon. `munsell_color.py` `hue_angle` (:10), `d1535_Y` (:16), `lab_to_rgb` (:34), `quant` (:47), `rgb_to_lab` (:51), `de2000` (:63). Reference implementation: `.development/dark_parity.py`.
- **Constraints**:
  - Do not edit `munsell_color.py`, `make_munsellinterpol_fixture.py`, the main fixture, `src/` or `tests/*.ts`.
  - Do not commit `.development/` or `mi_xyY.csv`.
  - Do not choose a candidate.
- **Acceptance**:
  - `python3 -I scripts/fit_low_value_models.py /home/andrew/workspace/SoilProfiles.js/scripts/mi_xyY.csv scripts` exits 0.
  - Running it a second time gives byte-identical output for all four files (`cmp` against copies in `.development/o4/`).
  - **Port check** *(revised at gate)*: the `all_points` blocks give main-fixture metrics that match research report §3 within 0.005. Targets: `shape` typical mean 0.415, gley and dark max 1.948; `hinge` typical mean 0.383, gley max 1.530, dark max 1.807.
  - The `holdout_excluded` `hinge` holdout metrics match report §4 within 0.005: all 0.447/2.822, low 0.470/2.143, gley 0.418/1.406.
  - The holdout fixture row count equals the holdout size printed by the script (report: 1,187 rows; 95 `low`; 77 `gley`).
  - **Report the full metric table for both candidates** (main fixture with highC C ≤ 12, plus holdout), and state for each candidate whether it passes: typical mean ≤ 0.5 and max ≤ 2.0, and every rare domain max ≤ 2.0. Never loosen these. If neither passes, stop and report. *(Gate: the pass check applies to the `all_points` fit, the shipped one.)*
  - Delete `.development/o4/`.

### Gate (orchestrator + user, between Waves 1 and 2)
- Present both candidates' metrics. The size estimate comes from bundling each coefficient table into a scratch copy of the module.
- **The user picks.** Record the choice in the Decision Log.
- Set holdout test bounds: `all` and `low` mean ≤ 0.5, and per-tag max ≤ measured (shipped candidate, from `low-value-fit-results.json`) + 0.2, rounded up to 0.1. Record them in the Decision Log and in 4.2.2's spec.
- Fill 4.2.1's `hinge` slots.

### 4.2.1 — Port the chosen candidate, allocation-free hot path
- **Repo**: SoilProfiles.js, worktree at the branch HEAD. **Depends on**: gate. **Model**: haiku.
- **Files in scope**: edit `src/utils/munsell-approx.ts`. Scratch goes in `.development/o4/` inside the worktree.
- **Spec**:
  1. Replace `COEF_A` and `COEF_B` with the tables from `scripts/munsell-ab-hinge-coefficients.json`. Generate them **mechanically** with a script, never by hand. Assert that the anchor order equals `HUE_ANCHOR_ORDER`. Keep them module-private.
  2. Update the coefficient comment: the basis terms in order and the source JSON file name.
  3. Evaluate the basis **without arrays or closures**:
     - compute the terms into local consts (`shape`: replace `Cc·V³` with `Cc·w⁸`, w = 1 − V/10, by squaring; `hinge`: append `Cc·h²`, h = max(0, 3 − V));
     - write the two dot products per anchor as explicit sums over the row entries.

     A small helper `dot(row, b0, …)` taking scalars is allowed if it does not allocate.
  4. Inline `labToXyz` and `xyzToRgb`, or have them write to locals, so that **no objects or arrays are created per call**. Keep every constant, the gamma function, the clamp and the `f_inv` branch exactly the same.
  5. Update the file header's step list.
- **Anchors**: `COEF_A` (~:22), `COEF_B` (~:45), `labToXyz` (~:119), `xyzToRgb` (~:151), `munsellToHexApprox` (~:182–230).
- **Constraints**: keep `parseMunsellHueAngle`, `munsellValueToY`, the matrices, gamma, clamp, the C/12 scaling, and the exported signature of `munsellToHexApprox` unchanged. Do not edit tests.
- **Acceptance**:
  - `npx tsc --noEmit` exits 0.
  - `grep -nE '=>|return \{|= \[|\.map\(|\.reduce\(' src/utils/munsell-approx.ts` prints only the module-level constant declarations (`HUE_FAMILIES`, `HUE_ANCHOR_ORDER`, `COEF_A`, `COEF_B`). Today it also prints `f_inv`, `gamma_correct`, `clamp`, two object returns, `basis` and `dot`. Turn `f_inv`, `gamma_correct` and `clamp` into module-level `function`s. Report the output.
  - Neutral baseline identical (scratch check via esbuild + node).
  - In the same scratch script, load both fixtures and compute ΔE00 with `tests/helpers/ciede2000.ts`. The results must match `scripts/low-value-fit-results.json` for `hinge` within 0.002 on every reported mean and max. They must also pass: typical mean ≤ 0.5 and max ≤ 2.0, every rare domain max ≤ 2.0 (highC C ≤ 12).
  - `npx esbuild src/utils/munsell-approx.ts --bundle --format=esm --minify | gzip -9 | wc -c` ≤ 2,525 (2,325 + 200).
  - Benchmark in one scratch run: uncached `munsellToHex` for 10YR 4/3 over 1e6 distinct inputs (value = 4 + (i % 1e6)·1e-7), against a bundle of `git show HEAD:` copies of `src/core/munsell.ts` and `src/utils/munsell-approx.ts`. The new code must not be slower than old + 5%. Report both, plus the cached ns.
  - `npx jest tests/munsell.test.ts -t '^(?!.*(rare soil colors|holdout)).*$'` passes.
  - Delete `.development/o4/`.

### 4.2.2 — Rare bounds 2.0, highC C ≤ 12, holdout test
- **Repo**: SoilProfiles.js, worktree at the branch HEAD. **Depends on**: gate. **Model**: haiku.
- **Files in scope**: edit `tests/munsell.test.ts`.
- **Spec**:
  1. Rare-domain test (`it.each`, ~:173): rename it to `should stay within ΔE00 2.0 on rare soil colors (%s)` and assert `max ≤ 2.0`. For `highC`, keep only rows with chroma ≤ 12, and add a comment: C 13–14 is extrapolated and not a real soil colour.
  2. Add `should match the held-out munsellinterpol points`:
     - load `tests/fixtures/munsell-reference-holdout.json` (same row layout as the main fixture; tags `all`, `low`, `gley`);
     - for each tag, compute ΔE00 of `munsellToHex(h, v, c)` against the row's Lab;
     - assert the bounds recorded at the gate: `all` mean ≤ 0.5 and max ≤ 2.9; `low` mean ≤ 0.5 and max ≤ 1.8; `gley` max ≤ 1.7.

     Use `it.each` over the tags, with the tag in the title. Generalize `loadInterpolRows` to take the fixture name rather than duplicating it.
  3. Do not change any other test.
- **Anchors**: `loadInterpolRows` (:8), the typical test (~:159), the rare `it.each` (~:173).
- **Constraints**: do not edit `src/` or the fixtures.
- **Acceptance**:
  - `npx jest tests/munsell.test.ts` runs. Against the pre-port model in this worktree, the rare tests for gley and dark (and possibly others) and the holdout tests may fail. Report every measured max and mean. Every other test passes.
  - The orchestrator re-runs the file after merging 4.2.1 and 4.2.2, and all tests must pass.

### 4.3.1 — Commit the research report, portable and descriptive
- **Repo**: SoilProfiles.js, **main checkout** (the report is untracked there). **Depends on**: 4.2.1, 4.2.2. **Model**: haiku.
- **Files in scope**: `docs/research/munsell-dark-parity.md`, to edit and then track.
- **Spec**:
  1. Replace the run IDs with descriptive names everywhere: in prose, in tables and in the candidate key. Use the report's own definitions. For example:
     - `shape4` → "shape-term swap (C·(1−V/10)⁸, dark/gley weight 4)";
     - `hinge4` → "9th hinge term (C·max(0,3−V)², weight 4)";
     - `localtable1` → "low-value correction table (1 decimal)";
     - `reweightW` → "refit, weight W".

     Tables may use short descriptive names, such as "hinge term, w4", as long as the candidate key defines each one. Refer to the old model as "the current polynomial" or "8-term polynomial (before this change)". Keep the old labels only in a one-line mapping in the candidate key, so readers of the earlier note can cross-reference.
  2. Remove or replace every link into `.development/` (15 occurrences). Point to the committed `scripts/fit_low_value_models.py` and its JSON outputs where they correspond, and otherwise say the prototype artifacts were not kept.
  3. Update the script names `exp1.py`, `mlib.py` and `candidate_*.json` to their current names (see the mapping in `munsell-approximation.md`).
  4. Add a section `## 9. Implemented`. It names the candidate the user chose and why, the shipped fixture and holdout metrics (copied from `scripts/low-value-fit-results.json`), the measured size and speed (from the 4.2.1 report in `STATE_4.md`), the bound decisions (rare ≤ 2.0, highC C ≤ 12, holdout bounds), and that the shipped fit excludes the holdout.
  5. Change the "Recommendation" section's opening to point at §9. Keep the rest as the historical record.
- **Constraints**: do not change any measured number in §§1–8 except as names. Do not edit other files.
- **Acceptance**:
  - `grep -nE "\.development|exp1|mlib|candidate_|localtable[0-9]?|hinge[0-9]|shape[0-9]|reweight[0-9]|nine[0-9]|inv[0-9]|sqrt[0-9]" docs/research/munsell-dark-parity.md` returns only the one-line label mapping.
  - Every relative link resolves: check with a small scratch script that tests each `](../..` path.
  - `git add docs/research/munsell-dark-parity.md` and commit.

### 4.3.2 — NEWS 0.3.0 and README accuracy line
- **Repo**: SoilProfiles.js, worktree. **Depends on**: 4.2.1, 4.2.2. **Model**: haiku.
- **Files in scope**: edit `NEWS.md` and `README.md`.
- **Spec**:
  1. In `NEWS.md`, the 0.3.0 entry's accuracy bullet should give typical mean/max and "every rare soil-colour domain within 2.0 ΔE00 (chroma ≤ 12)". Take the numbers from the 4.2.1 report in `STATE_4.md`. Add a bullet: held-out points stay within the measured holdout bounds, and chromatic colours below Value 1 are not calibrated. Update the module-size bullet with the new gzip size.
  2. In `README.md`, update the "Accuracy" line (~:418) so it does not say "can reach about 2.5". Use the new maximum, such as "stay within about 2 ΔE00". Do **not** add a link to the research doc (Decision Log).
- **Constraints**: every number must come from `STATE_4.md`. Do not invent numbers.
- **Acceptance**: `git diff` touches only those lines. `grep -n "2.5 ΔE00\|2.6" NEWS.md README.md` shows no stale bounds. Run `npx jest tests/package.test.ts` after `npm run build` (README is unaffected, but this confirms nothing else broke). Report the output.

---

## Orchestrator end-of-orchestration checks
- `make check` (build + full jest + smoke), run serially with no worktrees present.
- Module size and the uncached/cached benchmark in one run against the baseline, recorded in `STATE_4.md`.
- Neutral baseline identical.
- No push or PR without explicit user instruction.
