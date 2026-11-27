# Project Goals (`planning/GOALS.md`)

Last Updated: 2026-11-27
Source State: STATE_3.md (orchestration 3, PR #31); plan: EXECUTION_PLAN_4.md; research input `docs/research/munsell-dark-parity.md` (untracked)

## Circled Goal (Active)

- **[G1]** A committed, deterministic fit script (`scripts/fit_low_value_models.py`) builds two candidate coefficient tables from `scripts/mi_xyY.csv`:
  - the **shape-term swap**: 8 terms per hue, with `C·V³` replaced by `C·(1−V/10)⁸`;
  - the **9th hinge term**: `C·max(0, 3−V)²` appended.

  Both weight dark and gley colours 4×. The fit holds out a fixed 20% of points (SHA-256 of `hue/value/chroma` mod 5 = 0). The script reports each domain's mean, p95 and max on the fixture (highC limited to C ≤ 12), plus the holdout metrics. **The user picks the shipped candidate**, which must pass typical mean ≤ 0.5 and max ≤ 2.0, and every rare domain max ≤ 2.0.
  - Why now: every other goal depends on the chosen coefficients, which have to be reproducible. The prototypes exist only in untracked `.development/`.
  - Exit criteria:
    - Two runs give byte-identical JSON output.
    - The script's metrics for the swap match the research report (worst rare 1.948) to within 0.005.
    - At least one candidate passes the ≤ 2.0 rule. If none does, stop and report.
  - First action: once PR #31 merges, create `feat/munsell-low-value-fit` from `main`, then plan with plan-wave.

## Sequenced Goals (Dependency DAG)

- **[G2]** `munsellToHexApprox` uses the selected candidate. It passes all rare max ≤ 2.0 and typical mean ≤ 0.5 / max ≤ 2.0 on the fixture. The 5GY 2/2 chip is ≤ 2.0. Neutral output is bit-identical. The module grows by at most 200 B gzipped over 2,325 B.
  - Depends on: G1
- **[G3]** The rare-domain test bound is 2.0 for all six domains (gley, red, highC, dark, light, redox), alongside the existing typical bounds.
  - Depends on: G2
- **[G4]** A held-out reference fixture (the G1 holdout rows, exported with Lab) has a test: low-value (V ≤ 2.5, C ≤ 4) mean ≤ 0.5 and overall mean ≤ 0.5. Bounds are set from the measured values plus a margin and recorded at the plan gate.
  - Depends on: G1 (holdout split must be excluded from fitting), G2
- **[G5]** The `munsellToHexApprox` hot path makes no per-call allocations: the basis is unrolled and there are no closures or arrays. Uncached `munsellToHex` is no slower than the old code + 5%, measured in the same run. The cached path is unchanged.
  - Depends on: G2 (basis shape fixed)
- **[G6]** `docs/research/munsell-dark-parity.md` is committed. It links only to tracked files, uses the new script names, and uses descriptive candidate names instead of `localtable1`/`hinge4`/`shape4`. It records the selection made at the gate.
  - Depends on: G2
- **[G7]** The `NEWS.md` 0.3.0 entry and the README accuracy line give the new rare-domain maxima. They add caveats: holdout worst cases are higher, and V < 1 chromatic colours are not calibrated.
  - Depends on: G2, G3, G4

## Independent Backlog

- *(none: G4 (holdout) and G5 (no allocations) were pulled into this branch at the user's request)*

## Deferred

- **[G8]** Low-value correction table: dark and gley max 1.643 with no aggregate regression, +400 B.
  - Trigger: the user requires dark/gley ≤ 1.7 with zero change outside V < 2.5. It cannot meet highC ≤ 2.0 by itself.
- **[G9]** Packed value × chroma grid model: ≤ 1.55 ΔE00 in every domain, about +1.6–2.4 KB full module.
  - Trigger: rare-domain worst cases need to be ≤ 1.5, or the size budget grows past ~4 KB gzipped.

## Blocked / Pruned

- **[G10]** PR #31 is merged to `main`.
  - Status: Blocked / External Watch
  - Reason: in external review. The user chose to branch from `main` after the merge.
- **[G11]** Polar (LCh) hue blending.
  - Status: Pruned
  - Reason: the research report measured +88 B and +92 ns with no change to dark/gley max; gley hues sit on anchors.
- **[G12]** 40 hue anchors.
  - Status: Pruned
  - Reason: +1,196 B and the dark/gley max stays at 2.546.
- **[G13]** Single-slope low-value correction.
  - Status: Pruned
  - Reason: +209 B and the max stays at 2.546.
