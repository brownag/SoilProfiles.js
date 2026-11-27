# Dark and gley parity for the Munsell approximation

Research/prototype findings, 2026-11-27. Repository HEAD `f821a37e00b199c53aeba701278df8edb15285b6`, branch `feat/munsell-polynomial`.

## Recommendation

**Current decision: see §9.** The shipped model is the 9-term hinge fit, fit on all points including the holdout (chosen after the holdout-excluded fit missed the dark bound; see §9). The text below is the recommendation as it stood before implementation, kept as the historical record.

**If no other domain may regress, keep 8-term polynomial (before this change) and add the localized, one-decimal correction table (`low-value table, 1 dp`).** It costs **+400 B gzip** in the measured standalone module (2325 → 2725 B), lowers the dark and gley maxima from **2.546 to 1.643 ΔE00**, and leaves highC, light, and redox output **bit-identical**. All seven domains' mean/p95/max are no worse on the fixture. Typical mean/max improve or hold at **0.400 / 1.434**. The union of dark/gley chips above 1.5 falls from **23 to 5 of 324**. This is not a claim of ≤1.5 everywhere.

For the smallest code/data increment, **`hinge term, w4`** is the better compromise: **+183 B**, dark/gley max **1.807 / 1.530**, typical **0.383 / 1.433**, but light mean increases **0.418 → 0.471**, and highC mean **0.451 → 0.455**. It therefore does **not** satisfy a strict no-regression interpretation. `nine term, w4` (C/V ninth term) costs +215 B and has the same dark/gley maxima; it improves typical mean further but has small light/highC regressions too.

No production change was made. Recommended coefficients: the prototype table (not kept), key `local_correction`, layout **[20 hue anchors][2 value nodes][2 chroma terms][a,b]**. Existing 8-term polynomial (before this change) coefficients are unchanged. The standalone prototype module was not kept. Exact proposed edit is in §7.

## 1. Evidence and method

- Read the task prompt in full. No `AGENTS.md` exists in this repository or its ancestor directories checked through `/`; no additional repository instructions applied. Existing user changes were left untouched. Prototype scratch artifacts were not kept; nothing was committed.
- **Primary local sources:** [production implementation](../../src/utils/munsell-approx.ts#L181), [original fitting experiment](../../scripts/fit_munsell_models.py), [metric/conversion helpers](../../scripts/munsell_color.py), [fixture generator](../../scripts/make_munsellinterpol_fixture.py), and [1331-row reference fixture](../../tests/fixtures/munsell-reference-munsellinterpol.json). All numerical tables below come from the new executable experiments, not estimates copied from the earlier report.
- Input CSV has **10,438 rows**. Refits use **5840 finite rows, V≥1 and C≤12**, all available hues/values/chromas, fitting **unclipped D65 a,b**, not the clipped fixture Lab. xyY conversion follows the fixture generator: Bradford C→D65, Y×1.02568/100. This rescaling is the existing project convention, not a newly established physical calibration.
- Fit is joint linear least squares across hue anchors (same hue-blended design as `fit_munsell_models.py`), with column normalization for numerical conditioning. Typical rows have residual multiplier 3 (squared-loss weight 9). Low/gley multipliers W in candidate names apply additionally to **(V≤2.5,C≤4) OR (gley hue,C≤4,V≤8)**; W is a **residual multiplier**, not a direct squared-loss weight. Thus `refit, w4` multiplies their squared contribution by 16, on top of the typical weighting when applicable. This fitting emphasis deliberately includes C3–4 for Gley-2 hues, wider than the evaluation gley definition.
- Coefficients round to six decimal places unless stated otherwise. Evaluation caps C at 12 and scales a,b by C/12 above it. Newhall value and production Lab→sRGB constants are unchanged.
- **Reported metrics are production-rendered, clipped, 8-bit-quantized sRGB → D65 Lab → CIEDE2000**, versus the fixture's three-decimal Lab. Python predictions were independently checked against compiled JavaScript for **every candidate and every fixture row**: all metric discrepancies were zero to the 1e-10 assertion tolerance. The generated 8-term polynomial (before this change) prototype also matches the actual production module on all 1331 fixture hex outputs. Fixture rounding may move final decimals by ~0.001; do not infer significance from tiny differences.
- Domain tags/counts are exactly the fixture's: typical 444, gley 224, red 128, highC 481, dark 132, light 64, redox 60. Domains overlap; their counts cannot be added. Dark ∪ gley is 324 chips. Definitions are in the fixture generator, lines 27–40.
- **Reference limitations:** most scored chips also participate in fitting, so main tables are parity/approximation measurements, not independent prediction accuracy. A deterministic 20% point holdout is reported in §4. No new R export was made; munsellinterpol is not installed.

## 2. Root cause: weighting and restricted value/chroma shape, not chiefly hue blending

**Hue-blend error cannot cause the worst gley residual.** Every gley fixture hue lies on a 5-unit anchor; t=0. Original dark-anchor mean/max are **0.981 / 2.546**, compared with inter-anchor **0.806 / 2.226**. Changing only to polar LCh interpolation leaves gley metrics exactly unchanged and dark max at 2.546. Doubling to 40 anchors improves typical mean to 0.366 but still leaves dark/gley max at 2.546. These are direct ablations, not a perceptual argument about polar interpolation.

**The old fitting target is a minor contributor.** Refitting the same eight terms to the dense munsellinterpol CSV with original typical weighting (`refit, w1`) changes dark mean **0.933 → 0.878**, gley **0.595 → 0.570**, but leaves max 2.546. The original coefficients were fit to sparse renotation (`fit_munsell_models.py`, lines 202–207, 271–289), whereas this refit includes odd chromas and fractional values.

**Weighting matters, but cannot cheaply solve everything without tradeoffs.** `refit, w4` reduces dark/gley max to 2.163 at no measured gzip increase, but raises typical mean 0.420→0.455, highC max 2.180→2.564, and light/redox means. At W=8, worst dark/gley improves to 1.793, but typical mean **0.548 violates the required ≤0.5**. This is evidence of a useful but constrained fitting tradeoff, not proof that every possible eight-term weighted fit must fail.

**The low-V basis is also restrictive.** Holding W=4 fixed, replacing CV³ with C√V or C(1−V/10)^8 reaches dark/gley max 1.948. Adding one localized ninth degree of freedom C·max(0,3−V)² reaches **1.807 / 1.530**, with a lower typical mean than same-basis reweighting. Adding C/max(V,0.5) reaches the same maxima. A single correction proportional to C(2.5−V) fails (max stays 2.546); two low-value nodes and a C² term work. Thus a single hue-dependent saturation scalar is insufficient: low-value **value × chroma** shape matters.

The reference source supports this diagnosis without proving it: munsellinterpol's [`MunsellToxyY.R`](https://github.com/cran/munsellinterpol/blob/master/R/MunsellToxyY.R) defaults to bicubic hue/chroma interpolation and cubic value interpolation, with a configurable override to linear value interpolation below V=2. A global cubic ab model does not reproduce that piecewise xy interpolation exactly. This source was fetched/read during this investigation; `master` is not pinned to the historical CSV export version.

**Conclusion:** a combination of low-V underemphasis and insufficient local value/chroma flexibility, with only secondary hue-interpolation effects. These ablations do not uniquely apportion variance between causes or establish a global optimum.

## 3. All seven domain metrics, every candidate

Each cell is **mean / p95 / max ΔE00**; three decimals, not threshold-rounded.

Candidate key (names used in tables and prose):

- **8-term (before)**: the 8-term polynomial before this change; production coefficients, unchanged basis.
- **refit, w W**: same eight terms, CSV refit, residual multiplier W.
- **inverse term, w W**: CV³ replaced by C/max(V,0.5); still eight coefficients per anchor/component; weight W.
- **sqrt term, w W**: CV³ replaced by C√V; weight W.
- **shape term, w W**: shape-term swap, CV³ replaced by C(1−V/10)⁸ (dark/gley weight W).
- **nine term, w W**: original terms plus C/max(V,0.5); weight W.
- **hinge term, w W**: 9th hinge term, original terms plus C·max(0,3−V)²; weight W (w4 is the shipped candidate, §9).
- **40 anchors**: 40 hue anchors, original basis, W=1.
- **polar blend**: unchanged 8-term coefficients, shortest-arc polar hue blending.
- **slope correction**: unchanged 8-term plus 20×2 coefficients multiplying C·max(0,2.5−V).
- **low-value table, N dp**: unchanged 8-term plus 160 coefficients (two low-V nodes, two tapered chroma terms), rounded to N decimal places (6 dp when unrounded). Zero at V≥2.5 and C≥8.
- **grid, 0.5-Lab nodes**: existing grid JSON, 0.5-Lab nodes, Cartesian trilinear interpolation.
- **grid, integer nodes**: existing half-unit nodes re-rounded to integers; a separate measured candidate, not the earlier integer rounding from unrounded nodes.
- Old labels from the earlier note (one line): `M4e` = 8-term (before); `reweightW` = refit, w W; `invW` = inverse term, w W; `sqrtW` = sqrt term, w W; `shapeW` = shape term, w W; `nineW` = nine term, w W; `hingeW` = hinge term, w W; `hue40` = 40 anchors; `polar` = polar blend; `correction` = slope correction; `localtable`/`localtableN` = low-value table; `M1g0.5` = grid, 0.5-Lab nodes; `M1g1` = grid, integer nodes; `exp1.py` = fit_munsell_models.py; `mlib.py` = munsell_color.py; `candidate_M4e.json` = munsell-ab-polynomial-coefficients.json; `candidate_M1g.json` = munsell-ab-grid-coefficients.json.

| Candidate | typical | gley | red | highC | dark | light | redox |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8-term (before) | 0.420 / 0.965 / 1.434 | 0.595 / 1.620 / 2.546 | 0.535 / 1.139 / 2.001 | 0.451 / 1.199 / 2.180 | 0.933 / 1.983 / 2.546 | 0.418 / 0.901 / 1.075 | 0.386 / 0.834 / 1.054 |
| refit, w1 | 0.410 / 0.957 / 1.470 | 0.570 / 1.451 / 2.546 | 0.524 / 1.160 / 1.657 | 0.457 / 1.244 / 2.180 | 0.878 / 1.957 / 2.546 | 0.385 / 0.795 / 0.999 | 0.409 / 1.039 / 1.171 |
| refit, w2 | 0.411 / 0.982 / 1.470 | 0.494 / 1.147 / 2.210 | 0.530 / 1.181 / 1.854 | 0.466 / 1.254 / 2.180 | 0.758 / 1.669 / 2.459 | 0.430 / 0.925 / 0.999 | 0.438 / 1.055 / 1.179 |
| refit, w4 | 0.455 / 1.052 / 1.778 | 0.451 / 0.989 / 2.163 | 0.589 / 1.169 / 1.854 | 0.488 / 1.274 / 2.564 | 0.643 / 1.403 / 2.163 | 0.515 / 1.015 / 1.148 | 0.511 / 1.055 / 1.191 |
| refit, w8 | 0.548 / 1.155 / 1.807 | 0.422 / 1.009 / 1.793 | 0.658 / 1.398 / 1.854 | 0.580 / 1.470 / 2.422 | 0.560 / 1.342 / 1.793 | 0.580 / 1.050 / 1.494 | 0.647 / 1.269 / 1.420 |
| inverse term, w1 | 0.384 / 0.887 / 1.778 | 0.551 / 1.419 / 2.779 | 0.625 / 1.416 / 1.854 | 0.372 / 1.023 / 2.118 | 1.056 / 2.359 / 2.996 | 0.460 / 0.912 / 1.028 | 0.307 / 0.667 / 0.835 |
| inverse term, w2 | 0.377 / 0.863 / 1.778 | 0.478 / 1.218 / 2.366 | 0.629 / 1.359 / 1.854 | 0.394 / 1.051 / 2.118 | 0.763 / 1.972 / 2.556 | 0.528 / 1.094 / 1.293 | 0.316 / 0.724 / 0.835 |
| inverse term, w4 | 0.413 / 0.956 / 1.815 | 0.411 / 1.016 / 1.948 | 0.656 / 1.284 / 2.208 | 0.446 / 1.137 / 2.131 | 0.623 / 1.389 / 2.001 | 0.592 / 1.228 / 1.344 | 0.388 / 0.780 / 0.835 |
| sqrt term, w1 | 0.386 / 0.867 / 1.470 | 0.576 / 1.568 / 2.779 | 0.567 / 1.211 / 1.854 | 0.372 / 1.038 / 1.696 | 0.991 / 2.117 / 2.779 | 0.394 / 0.817 / 0.944 | 0.329 / 0.796 / 0.935 |
| sqrt term, w2 | 0.373 / 0.866 / 1.778 | 0.491 / 1.145 / 2.366 | 0.571 / 1.230 / 1.854 | 0.382 / 1.051 / 1.835 | 0.792 / 1.831 / 2.366 | 0.461 / 0.926 / 1.028 | 0.352 / 0.823 / 0.944 |
| sqrt term, w4 | 0.422 / 0.984 / 1.778 | 0.427 / 0.987 / 1.948 | 0.586 / 1.203 / 1.854 | 0.423 / 1.127 / 2.088 | 0.621 / 1.389 / 1.948 | 0.528 / 1.015 / 1.269 | 0.429 / 0.831 / 1.006 |
| shape term, w1 | 0.378 / 0.867 / 1.470 | 0.566 / 1.469 / 2.779 | 0.566 / 1.230 / 1.854 | 0.363 / 1.051 / 1.807 | 0.997 / 2.180 / 2.779 | 0.439 / 0.912 / 1.028 | 0.318 / 0.786 / 0.835 |
| shape term, w2 | 0.372 / 0.840 / 1.778 | 0.497 / 1.151 / 2.366 | 0.572 / 1.230 / 1.854 | 0.373 / 1.051 / 1.979 | 0.789 / 1.869 / 2.366 | 0.483 / 0.943 / 1.269 | 0.334 / 0.764 / 0.835 |
| shape term, w4 | 0.415 / 0.974 / 1.778 | 0.420 / 1.009 / 1.948 | 0.609 / 1.211 / 1.854 | 0.418 / 1.093 / 1.858 | 0.609 / 1.389 / 1.948 | 0.559 / 1.139 / 1.378 | 0.408 / 0.788 / 1.006 |
| nine term, w1 | 0.353 / 0.874 / 1.470 | 0.498 / 1.270 / 2.366 | 0.510 / 1.095 / 1.854 | 0.380 / 1.042 / 1.936 | 0.877 / 2.067 / 2.961 | 0.345 / 0.753 / 0.999 | 0.273 / 0.686 / 0.786 |
| nine term, w2 | 0.338 / 0.828 / 1.470 | 0.415 / 0.996 / 1.948 | 0.522 / 1.139 / 1.854 | 0.406 / 1.102 / 1.938 | 0.695 / 1.765 / 2.556 | 0.391 / 0.898 / 0.946 | 0.293 / 0.686 / 0.786 |
| nine term, w4 | 0.361 / 0.837 / 1.433 | 0.365 / 0.920 / 1.530 | 0.524 / 1.103 / 1.854 | 0.451 / 1.263 / 2.013 | 0.578 / 1.389 / 1.807 | 0.460 / 0.942 / 1.084 | 0.316 / 0.736 / 0.813 |
| hinge term, w1 | 0.356 / 0.880 / 1.470 | 0.493 / 1.294 / 2.366 | 0.498 / 1.085 / 1.854 | 0.381 / 1.051 / 2.049 | 0.832 / 1.971 / 2.556 | 0.348 / 0.753 / 0.999 | 0.294 / 0.737 / 1.019 |
| hinge term, w2 | 0.349 / 0.836 / 1.470 | 0.414 / 0.996 / 1.948 | 0.495 / 1.095 / 1.854 | 0.411 / 1.102 / 2.049 | 0.679 / 1.765 / 2.079 | 0.396 / 0.898 / 0.946 | 0.314 / 0.721 / 0.786 |
| hinge term, w4 | 0.383 / 0.884 / 1.433 | 0.366 / 0.940 / 1.530 | 0.528 / 1.095 / 1.854 | 0.455 / 1.168 / 2.135 | 0.549 / 1.342 / 1.807 | 0.471 / 0.912 / 1.084 | 0.358 / 0.737 / 0.813 |
| 40 anchors | 0.366 / 0.880 / 1.449 | 0.564 / 1.361 / 2.546 | 0.506 / 1.083 / 1.497 | 0.399 / 1.139 / 1.900 | 0.835 / 1.943 / 2.546 | 0.376 / 0.763 / 0.999 | 0.348 / 0.907 / 1.187 |
| polar blend | 0.422 / 0.966 / 1.657 | 0.595 / 1.620 / 2.546 | 0.554 / 1.162 / 2.001 | 0.469 / 1.294 / 2.180 | 0.935 / 1.882 / 2.546 | 0.433 / 0.901 / 1.148 | 0.351 / 0.825 / 0.965 |
| slope correction | 0.422 / 0.977 / 1.434 | 0.596 / 1.620 / 2.546 | 0.534 / 1.139 / 2.001 | 0.452 / 1.208 / 2.180 | 0.925 / 2.121 / 2.546 | 0.418 / 0.901 / 1.075 | 0.386 / 0.834 / 1.054 |
| low-value table, 6 dp | 0.395 / 0.935 / 1.434 | 0.487 / 1.302 / 1.643 | 0.513 / 1.139 / 2.001 | 0.451 / 1.199 / 2.180 | 0.519 / 1.330 / 1.643 | 0.418 / 0.901 / 1.075 | 0.386 / 0.834 / 1.054 |
| low-value table, 1 dp | 0.400 / 0.956 / 1.434 | 0.488 / 1.302 / 1.643 | 0.519 / 1.139 / 2.001 | 0.451 / 1.199 / 2.180 | 0.520 / 1.344 / 1.643 | 0.418 / 0.901 / 1.075 | 0.386 / 0.834 / 1.054 |
| low-value table, 2 dp | 0.397 / 0.942 / 1.434 | 0.485 / 1.302 / 1.643 | 0.511 / 1.139 / 2.001 | 0.451 / 1.199 / 2.180 | 0.522 / 1.330 / 1.643 | 0.418 / 0.901 / 1.075 | 0.386 / 0.834 / 1.054 |
| low-value table, 3 dp | 0.396 / 0.942 / 1.434 | 0.485 / 1.302 / 1.643 | 0.513 / 1.139 / 2.001 | 0.451 / 1.199 / 2.180 | 0.515 / 1.330 / 1.643 | 0.418 / 0.901 / 1.075 | 0.386 / 0.834 / 1.054 |
| grid, 0.5-Lab nodes | 0.245 / 0.735 / 1.277 | 0.251 / 0.712 / 1.334 | 0.261 / 0.741 / 1.260 | 0.206 / 0.562 / 0.878 | 0.292 / 0.804 / 1.544 | 0.165 / 0.618 / 0.783 | 0.248 / 0.590 / 0.786 |
| grid, integer nodes | 0.358 / 0.958 / 1.796 | 0.427 / 0.962 / 1.531 | 0.347 / 0.850 / 1.260 | 0.247 / 0.682 / 1.216 | 0.445 / 1.168 / 1.544 | 0.315 / 0.860 / 1.311 | 0.278 / 0.654 / 1.236 |


Only `refit, w8` fails the typical mean/max bound. Passing that bound is not the same as having no regression elsewhere: e.g. `nine term, w4` slightly worsens light and highC p95, and `shape term, w4` worsens light and red means.

For recommended `low-value table, 1 dp`, highC/light/redox have **zero changed hex outputs** (481/64/60 rows). Typical, gley, red and dark have 37/25/13/80 changed outputs, respectively. Their aggregate metrics do not regress, but **individual chips can get worse**; this is not pointwise dominance over every old chip.

## 4. Point holdout and generalization limits

Before fitting the selected new models/corrections, hold out rows where SHA-256 of `hue/value/chroma` modulo 5 is zero. Training pool holdout: **1187** rows; low V≤2.5,C≤4: **95**; expanded fitting gley mask: **77**. Entries below are mean / max ΔE00. Unlike §3, these subsets include all hues and broader chroma ranges, not the seven fixture domains. the 8-term polynomial (before this change) is the frozen old fit (originally trained on another, overlapping renotation dataset); its comparison is not a clean independent baseline holdout. `low-value table, 1 dp` freezes that same 8-term polynomial (before this change) baseline and fits only the correction on remaining rows.

| Candidate | all (1187) | low (95) | gley (77) |
| --- | --- | --- | --- |
| 8-term (before) | 0.469 / 2.312 | 0.795 / 2.266 | 0.588 / 2.266 |
| refit, w1 | 0.469 / 2.348 | 0.754 / 1.975 | 0.594 / 1.827 |
| refit, w4 | 0.479 / 2.822 | 0.514 / 1.545 | 0.503 / 1.277 |
| nine term, w4 | 0.443 / 2.647 | 0.463 / 2.143 | 0.409 / 1.406 |
| hinge term, w4 | 0.447 / 2.822 | 0.470 / 2.143 | 0.418 / 1.406 |
| low-value table, 1 dp | 0.435 / 2.312 | 0.460 / 2.143 | 0.419 / 1.584 |


The improvement survives the point holdout in means, but the recommended table's low-value max is **2.143**, not 1.643. Consequently **do not promise the fixture maximum for arbitrary off-grid colours**. Nearby hues and values remain correlated across the split. No independent new measurements of printed chips, leave-one-hue-out validation, extrapolation validation below V=1, or newly generated intermediate-value reference data were available. The CSV is an interpolation model, not a physical colorimetric ground truth.

## 5. Size and speed measurements

**Complete standalone ESM modules**, bundled/minified with installed **esbuild 0.28.2**, gzip level 9 with mtime 0; no source maps. Same exports and renderer for all variants. The production module itself measured **4430 minified / 2325 gzip B**, not the prompt's 2451 B; the earlier build's exact tool/options/artifact are not available here, so the discrepancy is **not attributed to a model improvement**. Use within-run deltas. This is not a measured change to the whole library bundle.

**Node v25.5.0, Linux x86_64**, process pinned to the first permitted CPU. Direct `munsellToHexApprox`, not the public wrapper: cycling the 1331 fixture inputs, 200k warmup per variant, nine rotated-order rounds of 100k calls, result consumed via checksum. Report median and full range; no GC or thermal isolation, no browser/WASM benchmark, and no claim of nanosecond-level significance. All candidates remain O(1). Array sizes or loop bounds depend only on fixed model structure, not dataset size.

| Candidate | gzip B | Δ gzip B | minified B | median ns | min–max ns | Δ median ns | dark/gley >1.5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8-term (before) | 2325 | +0 | 4430 | 428 | 401–483 | +0 | 23 |
| refit, w1 | 2329 | +4 | 4427 | 416 | 402–497 | -12 | 20 |
| refit, w2 | 2329 | +4 | 4445 | 413 | 384–423 | -15 | 14 |
| refit, w4 | 2325 | +0 | 4425 | 426 | 421–459 | -2 | 3 |
| refit, w8 | 2350 | +25 | 4446 | 423 | 397–465 | -6 | 2 |
| inverse term, w1 | 2376 | +51 | 4465 | 420 | 390–460 | -8 | 36 |
| inverse term, w2 | 2378 | +53 | 4466 | 443 | 419–479 | +15 | 19 |
| inverse term, w4 | 2389 | +64 | 4459 | 424 | 421–453 | -4 | 6 |
| sqrt term, w1 | 2411 | +86 | 4503 | 431 | 372–491 | +3 | 36 |
| sqrt term, w2 | 2430 | +105 | 4505 | 430 | 417–457 | +1 | 23 |
| sqrt term, w4 | 2421 | +96 | 4492 | 422 | 386–452 | -6 | 3 |
| shape term, w1 | 2394 | +69 | 4478 | 425 | 389–471 | -3 | 36 |
| shape term, w2 | 2383 | +58 | 4464 | 420 | 400–478 | -8 | 22 |
| shape term, w4 | 2395 | +70 | 4478 | 423 | 408–563 | -6 | 3 |
| nine term, w1 | 2527 | +202 | 4788 | 461 | 431–548 | +33 | 22 |
| nine term, w2 | 2540 | +215 | 4795 | 456 | 401–471 | +28 | 12 |
| nine term, w4 | 2540 | +215 | 4805 | 416 | 394–457 | -12 | 5 |
| hinge term, w1 | 2507 | +182 | 4787 | 424 | 372–473 | -4 | 22 |
| hinge term, w2 | 2512 | +187 | 4787 | 421 | 401–458 | -7 | 11 |
| hinge term, w4 | 2508 | +183 | 4789 | 418 | 375–441 | -10 | 3 |
| 40 anchors | 3521 | +1196 | 7060 | 420 | 414–442 | -8 | 19 |
| polar blend | 2413 | +88 | 4595 | 520 | 492–558 | +92 | 24 |
| slope correction | 2534 | +209 | 4902 | 416 | 396–433 | -12 | 21 |
| low-value table, 6 dp | 3237 | +912 | 6380 | 418 | 390–476 | -11 | 5 |
| low-value table, 1 dp | 2725 | +400 | 5578 | 459 | 429–651 | +31 | 5 |
| low-value table, 2 dp | 2835 | +510 | 5743 | 425 | 406–470 | -3 | 5 |
| low-value table, 3 dp | 2937 | +612 | 5906 | 418 | 387–440 | -11 | 5 |
| grid, 0.5-Lab nodes | 4688 | +2363 | 11956 | 416 | 385–443 | -12 | 1 |
| grid, integer nodes | 3939 | +1614 | 9560 | 449 | 381–471 | +21 | 3 |


The recommended table adds a fixed two-iteration loop only below V=2.5 and C=8, **no new per-call arrays/objects or trig**, and reuses 8-term polynomial (before this change)'s existing eight-element basis/closure. Neutral and chroma-zero paths never enter it. Literal allocation-free conversion was not attempted: production already allocates a basis and uses renderer objects. The constraint is interpreted as **no additional allocations**; strict zero-allocation conversion would need a separate refactor.

Recommended median 459 vs baseline 428 ns (+7.2%). Overlapping/noisy timing ranges prevent a strong speed claim. Polar adds atan2/hypot/sin/cos and has no dark/gley max gain. A second unpinned exploratory run varied substantially in absolute timings; it is not used to claim speedups.

Separate branch-focused run, same CPU pin and nine rotated rounds, 200k calls per round and warmup per case/model: **median ns (min–max)**. `typicalUnaffected` means typical inputs at V≥2.5, where the proposed branch is skipped. These are another noisy run, not values to mix into the preceding ranking as exact speed ratios.

| Candidate | dark (132 inputs) | gley (224 inputs) | typicalUnaffected (390 inputs) |
| --- | --- | --- | --- |
| 8-term (before) | 424 (401–440) | 424 (394–435) | 434 (423–446) |
| low-value table, 1 dp | 464 (436–476) | 397 (385–421) | 419 (404–435) |
| hinge term, w4 | 413 (399–428) | 398 (384–414) | 416 (400–429) |
| nine term, w4 | 405 (390–430) | 408 (379–422) | 422 (396–429) |
| grid, 0.5-Lab nodes | 427 (398–434) | 404 (386–410) | 431 (418–458) |


**Do not compare grid data-only bytes with polynomial full-module bytes.** The older note's grid model 2.8–3.4 KB gzip is *data only*. Here the flattened half-unit grid's numeric literal alone is ~3426 B gzip, but the complete prototype is **4688 B**; the re-rounded integer candidate's literal is ~2699 B and complete module **3939 B**. 8-term polynomial (before this change)'s six-decimal numeric literal alone is ~1208 B; the old 845 B estimate used four-decimal coefficients. Encoding/syntax/runtime differences explain why those are not interchangeable budgets. No packed-grid decoder was measured.

## 6. Pareto front and ranked cheap fixes

Admissibility: typical mean≤0.5 and max≤2.0. **Scalar frontier:** gzip versus max(dark max,gley max). **Vector frontier:** gzip, dark max and gley max separately. Reference endpoints are included even when dominated.

| Candidate | gzip B | dark max | gley max | union max | role |
| --- | --- | --- | --- | --- | --- |
| 8-term (before) | 2325 | 2.546 | 2.546 | 2.546 | reference endpoint, dominated |
| refit, w4 | 2325 | 2.163 | 2.163 | 2.163 | scalar frontier |
| inverse term, w4 | 2389 | 2.001 | 1.948 | 2.001 | scalar frontier |
| shape term, w4 | 2395 | 1.948 | 1.948 | 1.948 | scalar frontier |
| hinge term, w4 | 2508 | 1.807 | 1.530 | 1.807 | scalar frontier |
| low-value table, 1 dp | 2725 | 1.643 | 1.643 | 1.643 | scalar frontier |
| grid, integer nodes | 3939 | 1.544 | 1.531 | 1.544 | scalar frontier |
| grid, 0.5-Lab nodes | 4688 | 1.544 | 1.334 | 1.544 | vector frontier |


The scalar frontier is: **refit, w4, inverse term, w4, shape term, w4, hinge term, w4, low-value table, 1 dp, grid, integer nodes**. The separate-dark/gley vector frontier is: **refit, w4, inverse term, w4, shape term, w4, hinge term, w4, low-value table, 1 dp, grid, integer nodes, grid, 0.5-Lab nodes**. 8-term polynomial (before this change) is a reference endpoint but is dominated on this narrow objective by refitting/reweighting; that refit still regresses other domains. `nine term, w4` is dominated by `hinge term, w4` on bytes and these maxima, though it has the better typical/redox means. The half-unit grid model grid is dominated by the integer grid on the scalar worst-union objective (same dark maximum), but remains on the vector frontier because its gley maximum is lower.

**Decision ranking, accounting for other domains rather than only the frontier:**

1. **Strict aggregate no-regression: `low-value table, 1 dp`, +400 B.** Best measured localized compromise; all seven aggregate triples non-worse, no changes outside low-V/low-C region. More accurate rounding of its coefficients costs bytes without reducing its worst case, because the remaining worst chip is at V=2.5 where the correction is zero.
2. **Smallest useful structural change: `hinge term, w4`, +183 B.** Lower mean dark error and better gley max than the table, but weaker dark maximum and small highC/light regressions. `nine term, w4`, +215 B, favors typical/redox means instead.
3. **Eight-term swap: `shape term, w4`, +70 B; `sqrt term, w4`, +96 B.** Dark/gley max 1.948, but light/red/typical tradeoffs. `inverse term, w4` (+64 B) leaves dark max 2.001 and worsens red max. These change high-V behavior too.
4. **Coefficient-only reweight: `refit, w4`, +0 measured B.** No extra runtime math but worse highC/light/redox; max 2.163. Equal coefficient count does not guarantee equal compressed size for every refit.
5. **Plain one-slope low-V correction and polar blend: reject.** Extra bytes without fixing worst residuals. **40 anchors: reject** for this objective.
6. **grid, 0.5-Lab nodes for global rare-domain accuracy**, if +2363 B full-module gzip over 8-term polynomial (before this change) is acceptable; it is substantially more accurate in every domain, but not the same size class. Packed/delta-coded grid claims in the previous note remain estimates, not measurements here.

## 7. Exact proposed production edit (not applied)

Keep `COEF_A`, `COEF_B`, the eight-element basis, Newhall polynomial, and every Lab/sRGB constant **unchanged**. Add this constant after `COEF_B` in `src/utils/munsell-approx.ts` (same hue order as `HUE_ANCHOR_ORDER`):

```ts
// Low-value residual correction. [hue][V-node 1,2][C,C² tapered][a,b].
const LOCAL: readonly number[][][][] = [
  [[[2.2,-0.2],[-0.4,0.0]],[[1.1,0.3],[-0.4,-0.1]]],
  [[[1.8,0.3],[-0.3,-0.1]],[[0.9,0.4],[-0.3,-0.2]]],
  [[[1.8,0.7],[-0.2,-0.1]],[[0.8,-0.0],[-0.3,-0.0]]],
  [[[0.9,2.5],[0.1,-0.7]],[[0.3,-1.4],[-0.1,0.3]]],
  [[[-0.1,2.1],[0.3,-0.6]],[[-0.4,-1.0],[0.1,0.3]]],
  [[[-0.4,1.9],[0.2,-0.7]],[[-0.2,-0.9],[0.0,0.3]]],
  [[[0.1,1.6],[-0.0,-0.7]],[[0.4,-2.2],[-0.1,0.6]]],
  [[[0.4,0.7],[-0.1,-0.1]],[[1.2,-3.4],[-0.2,0.8]]],
  [[[2.3,-1.0],[-0.7,0.3]],[[1.1,-1.2],[0.0,0.2]]],
  [[[3.0,-0.6],[-0.9,0.2]],[[1.2,-0.4],[0.0,0.0]]],
  [[[2.4,0.1],[-0.7,0.0]],[[1.0,-0.2],[0.1,0.0]]],
  [[[1.1,0.6],[-0.3,-0.1]],[[0.2,-0.0],[0.2,0.1]]],
  [[[0.3,1.1],[-0.2,-0.3]],[[-0.0,0.4],[0.2,0.1]]],
  [[[-0.6,-0.3],[0.1,0.1]],[[-0.2,0.3],[0.1,0.0]]],
  [[[-0.4,-1.0],[0.1,0.2]],[[-0.2,0.1],[0.1,0.0]]],
  [[[0.1,-1.1],[-0.1,0.3]],[[0.2,-0.3],[-0.1,0.1]]],
  [[[0.7,-1.6],[-0.1,0.3]],[[0.4,-0.9],[-0.2,0.3]]],
  [[[1.7,-1.8],[-0.3,0.3]],[[0.9,-1.1],[-0.4,0.3]]],
  [[[2.1,-1.4],[-0.4,0.2]],[[1.4,-0.8],[-0.4,0.3]]],
  [[[2.3,-0.8],[-0.4,0.1]],[[1.6,-0.2],[-0.5,0.1]]],
];
```

Inside `munsellToHexApprox`, immediately after the current assignments to `a` and `b` at lines 206–207 and **before** `if (chroma > 12)`, insert:

```ts
      if (V < 2.5 && chroma < 8) {
        const p = Math.max(0, Math.min(1, V - 1));
        const q = Math.max(0, Math.min(1, (2.5 - V) / 0.5));
        const z = Cc * (1 - Cc / 8);
        for (let j = 0; j < 2; j++) {
          const w = j === 0 ? 1 - p : p * q;
          a += w * z * ((1-t) * (LOCAL[i0][j][0][0] + Cc * LOCAL[i0][j][1][0]) + t * (LOCAL[i1][j][0][0] + Cc * LOCAL[i1][j][1][0]));
          b += w * z * ((1-t) * (LOCAL[i0][j][0][1] + Cc * LOCAL[i0][j][1][1]) + t * (LOCAL[i1][j][0][1] + Cc * LOCAL[i1][j][1][1]));
        }
      }
```

The correction is:

`Δab = Σ_hue_weight Σ_j value_weight[j] · C(1−C/8) · (LOCAL[hue][j][0] + C·LOCAL[hue][j][1])`,

only if V<2.5 and C<8. Value weights are `[1−clamp(V−1,0,1), clamp(V−1,0,1)·clamp((2.5−V)/0.5,0,1)]`. Thus node 1 applies at V=1, node 2 at V=2, and both vanish continuously at V=2.5. The chroma correction vanishes at C=0 and C=8. The prototype retains constant node-1 correction shape below V=1; this region was not calibrated, and physical chromatic V=0 has no reference xy in munsellinterpol. Do not advertise accuracy there.

This exact edit was compiled and its outputs evaluated; standalone TypeScript checking also passed on the prototype module, which was not kept. For **every candidate**, 10,001 values from 0 to 10 at step 0.001 gave zero mismatches against production-equivalent 8-term polynomial (before this change) for `('N',v,0)` and `('5GY',v,0)`. Neutral bit identity also follows structurally: the edit is nested under `hue !== 'N'` and `chroma > 0`, with no change to common rendering. The public wrapper was not modified.

If a +183 B compromise is preferred, the 20×9 hinge coefficients are in [`scripts/munsell-ab-hinge-coefficients.json`](../../scripts/munsell-ab-hinge-coefficients.json) (the prototype module was not kept); append `Cc * Math.max(0, 3 - V) ** 2` to the basis and replace both coefficient tables. **Do not mix those coefficients with the old eight-term basis.**

## 8. Reproduction, artifacts, and primary-source citations

Run from repository root (Python NumPy 2.5.3, SciPy 1.18.1). The shipped fit and its holdout numbers reproduce with the committed script:

```sh
python3 -I scripts/fit_low_value_models.py <mi_xyY.csv> <outdir>
```

The prototype experiment, build, benchmark, branch-benchmark and verification scripts, their logs and raw timings were not kept.

- [Fit script](../../scripts/fit_low_value_models.py): shipped hinge and shape fits, holdout split, JSON outputs. [Results JSON](../../scripts/low-value-fit-results.json); [hinge coefficients](../../scripts/munsell-ab-hinge-coefficients.json); [shape coefficients](../../scripts/munsell-ab-shape-coefficients.json).
- Prototype build/size, benchmark, branch-benchmark, compiled-output verification scripts, raw timings and hex outputs were not kept. The size and speed figures in §9 come from the implementation measurements.
- [Original experiment](../../scripts/fit_munsell_models.py) supplies 8-term polynomial (before this change)/grid model coefficient provenance. [`munsell_color.py`](../../scripts/munsell_color.py) supplies CIEDE2000, citing Sharma, Wu & Dalal (2005); no independent revalidation of its 180-degree edge cases was performed here.
- [munsellinterpol source `MunsellToxyY.R`](https://github.com/cran/munsellinterpol/blob/master/R/MunsellToxyY.R), read during this task: actual interpolation selection, value override, and special handling for neutral and chromatic V=0. CSV source version is recorded as 3.6-0 in the fixture; remote `master` is only implementation corroboration.
- [colour-science primary implementation, pinned `136aa0b`, `luminance.py`](https://github.com/colour-science/colour/blob/136aa0beccd772355d7abbab17655c93b16a6b9f/colour/colorimetry/luminance.py), read during this task: separate `luminance_Newhall1943` (1.2219…) and `luminance_ASTMD1535` (1.1914…) formulas. This confirms the project's scale naming; neither physical standards text nor the original 1943 paper was newly read.
- [Earlier project report](munsell-approximation.md), §§3,6,8: historical context only, not authority for this run's measurements.

Input fingerprints:

| Input | SHA-256 |
| --- | --- |
| scripts/mi_xyY.csv | 25e4ae1d7e7a8c7f1f09195570d32291ab357a166ae2aad181d4d98b975f9a25 |
| scripts/munsell-ab-polynomial-coefficients.json | 0d84618a4951ce216a5866b3890e4a67cf2e887ac5afc40d197bdcb2181b156a |
| scripts/munsell-ab-grid-coefficients.json | 9e4cb11cd5380cd6359a03cc4661db3457ad4428334187b63fe977ac6e1bd03c |
| tests/fixtures/munsell-reference-munsellinterpol.json | 4ec3f3bc2e3f926868163a7cb01bf7bd94d3a1fe2f5a487d8f2f11fae3b6eae5 |
| src/utils/munsell-approx.ts | e3a8a85eb1a608c6a6baf83da8baf14a2f381e160c12b3ccdba8c52e0c1f94a5 |


Only this findings report is intended as a tracked deliverable. Prototype scratch artifacts were not kept. No `src/` or `tests/` edits, no commits, no reference-data regeneration.

## 9. Implemented

**Shipped:** the 9-term hinge fit (9th hinge term, C·max(0,3−V)², dark/gley weight 4). The fit includes all points, holdout included. Coefficients: [`scripts/munsell-ab-hinge-coefficients.json`](../../scripts/munsell-ab-hinge-coefficients.json), stored flat in `src/utils/munsell-approx.ts`. Script and outputs: [`scripts/fit_low_value_models.py`](../../scripts/fit_low_value_models.py), [`scripts/low-value-fit-results.json`](../../scripts/low-value-fit-results.json).

**Correction: the shipped fit is not holdout-excluded.** The first run excluded the 20% holdout from the fit. With it excluded, both the shape-term swap and the hinge candidate missed the dark bound (max ≤ 2.0) on held-out chip 5Y 1/4 (2.143). The user chose the all-points hinge fit. The holdout metrics below therefore measure in-sample points; the out-of-sample estimate is listed separately.

**Why hinge.** The user chose it. It is best on every domain except highC, where the shape-term swap is slightly better on chroma ≤ 12 (mean 0.335 vs 0.364, max 1.176 vs 1.227). Both are far inside the 2.0 bound. Typical mean is 0.383 vs 0.415 for the shape-term swap, and gley max is 1.530 vs 1.948.

**Shipped metrics, main fixture (mean / max ΔE00, all points):** typical 0.383 / 1.433; gley 0.366 / 1.530; red 0.528 / 1.854; highC (C ≤ 12) 0.364 / 1.227; dark 0.549 / 1.807; light 0.471 / 1.084; redox 0.358 / 0.813.

**Holdout test (in-sample; the test checks the shipped model on these points):** all 0.434 / 2.647 (1,187 rows); low 0.430 / 1.545 (95); gley 0.389 / 1.406 (77). Bounds checked: all mean ≤ 0.5, max ≤ 2.9; low mean ≤ 0.5, max ≤ 1.8; gley max ≤ 1.7.

**Out-of-sample estimate (fit excluding the holdout):** all 0.447 / 2.822; low 0.470 / 2.143; gley 0.418 / 1.406.

**Size and speed (measured on the shipped module).** Gzip: 2,510 B shipped vs 2,325 B before (+185 B, within the +200 B budget). Minified: 4,794 B vs 4,430 B. The coefficient tables are stored flat to stay within that budget. Speed: no measurable change. Uncached `munsellToHex` 10YR 4/3: old 528.3 / 496.4 ns, new 483.2 / 498.2 ns (two rounds). Cached: old 64.8 / 67.8 ns, new 73.4 / 72.4 ns.

**Bound decisions.** Rare domains (gley, red, highC, dark, light, redox): max ≤ 2.0 ΔE00. Typical: mean ≤ 0.5 and max ≤ 2.0. highC is tested and fitted on chroma ≤ 12 only, because C 13–14 is extrapolated and not a real soil colour. No high-chroma weighting. Holdout bounds as in the holdout test above.
