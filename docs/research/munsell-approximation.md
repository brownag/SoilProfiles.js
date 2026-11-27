# Munsell to sRGB approximation: accuracy, size and speed options

Research note, 2026-11-26. Branch `fix/munsell-hue-approx`. Scope: `src/utils/munsell-approx.ts` and `src/core/munsell.ts`. No source or test changes were made. Source line references (`file.ts:NNN`) point to commit `4ded6e9`, before the library adopted model M4e. Recommendations 1, 3 and 4 have since been implemented (4 by fixing the label and keeping the Newhall scale).

All colour differences are **CIEDE2000 (ΔE00)** unless marked CIE76. The ΔE00 code follows Sharma, Wu & Dalal (2005). It matches 33 of the 34 published test pairs to within 1e-4. The remaining pair is pair 14, the exact-180° hue-mean discontinuity case, where it is off by 0.058. Each model's Lab output goes through the library's own clip-and-round pipeline to an 8-bit sRGB hex value before it is compared, so every number below is the error a user would actually see.

## 1. Summary

1. **The main error source is structural.** The current model keeps a\*/b\* the same at every Munsell value. Refitting the existing value-independent table by least squares changes nothing: typical-domain ΔE00 goes from 1.12 to 1.08. Making a\*/b\* depend on value cuts the typical-domain error by 2.5 to 5 times.
2. **A small value-dependent polynomial beats the current table at the same size.** The model has 8 coefficients per hue anchor, 20 anchors, and 320 numbers in total, which is about 2.3 KB raw or 0.85 KB gzipped. The current table is 2.1 KB raw or 0.95 KB gzipped. Against munsellinterpol, typical-domain mean ΔE00 drops from 1.12 to 0.42 and the soil-frequency-weighted mean drops from 0.78 to 0.37.
3. **A value × chroma node grid is the most accurate option at moderate size.** It uses the same 20 anchors, values 1–10 and chromas {2,4,6,8,12,16}, with nodes rounded to 0.5 to 1 Lab unit. It reaches a typical-domain mean of 0.24–0.30 and keeps the worst case at or below 1.7 ΔE00 in every soil domain, including gley and dark colours. It costs about 7.7–10 KB raw, or about 2.8–3.4 KB gzipped as a plain number literal. A delta-coded string encoding would bring that down to about 1.5–1.8 KB gzipped (estimated).
4. **aqp is a flawed calibration target.** For the chromatic chips, aqp's own build script rescales renotation Y by its minimum, which darkens values 1 to 3 (L\* 8.8 instead of 10.6 at V=1). Its chroma-1 chips come from backward natural-spline extrapolation and are often wrong: 84 of 520 differ from munsellinterpol by more than 2 ΔE00, and 5GY 1/1 has a\*>0. Its Lab columns are computed from clipped sRGB. Typical-domain agreement between aqp and munsellinterpol is only 0.44 ΔE00, so no model scored against aqp can do better than about 0.45. **Future fitting should use the renotation data directly or munsellinterpol.**
5. **The value function's label is wrong.** The code calls its value polynomial "ASTM D1535" (`src/utils/munsell-approx.ts:289`), but it uses the Newhall–Nickerson–Judd (1943) MgO-relative coefficients (1.2219, …), not the D1535-08 coefficients (1.1914, …). The two differ by 0.2–0.9 L\*, which is about 0.3–0.8 ΔE00. Either fix the comment or switch on purpose; this is a convention choice.
6. **CPU time comes from string handling, not colour math.** One `munsellToHex` call takes about 1.2 µs. Hex formatting with `toString(16)` takes about 185 ns of that, hue parsing plus interpolation about 90 ns, and a single `pow`/`cbrt` about 10 ns. Memoizing gives 43 ns per call. The library only converts one colour per horizon per render, so speed is not a problem today.
7. **Full renotation tables are too large for the bundle.** munsell.js, the main JS library, bundles to 373 KB minified (126 KB gzipped). It is very accurate: within 0.09 ΔE00 of munsellinterpol on typical soil colours. That is about 7 times the size of this whole library.

## 2. Target soil colour domain

### 2.1 Which chips the soil charts contain (primary sources)

- USDA Soil Survey Manual (Handbook 18, 2017), pp. 146–151:
  - "The standard chart for soil has separate hue cards, from 10R through 5Y. In addition, special charts for gley colors and for very light colors are available."
  - Standard cards stop at value 8. Value-9 chips are on a special "white" chart.
  - Soil chroma runs "from 0 … to 8".
  - Neutrals run from "N 2.5/" to "N 8/".
  - "For some hues, chips for value of 2.5 are included."
  - Colours should be "rounded to the nearest chip," never interpolated or "extrapolated beyond the highest chip."
  - Field reproducibility is "within 2.5 units of hue … and 1 unit of value and chroma."
- NASIS traditional colour names, exported in aqp `misc/utils/Munsell/traditional-names-from-NASIS.csv`, list 482 notations. That is 460 chromatic chips plus 22 N spellings. I use this list as the chip inventory of the soil charts. It contains:
  - Hues 5R, 7.5R, 10R, 2.5YR, 5YR, 7.5YR, 10YR, 2.5Y and 5Y, with values 2–8 and chroma up to 8.
  - 10Y and 5GY at chroma 1, 2 and 4.
  - 10GY, 10G, 5BG, 10BG, 5B, 10B and 5PB at chroma 1.
  - 5G at chroma 1 and 2.
  - White-page chips 7.5YR, 10YR and 2.5Y at values 8.5, 9 and 9.5, chroma 1–2.
  - N at values 2–9.5.
  - **Unverified:** which physical page (Gley 1 or Gley 2) each gley chip sits on. The munsell.com product page returned HTTP 403. Retailer listings describe Gley 1 and Gley 2 as two separate charts.

### 2.2 How often colours occur: an OSD survey run for this note

The script parsed the `TYPICAL PEDON` text of all 24,928 Official Series Descriptions in `ncss-tech/SoilKnowledgeBase` (commit `fbf3e54`, 2026-11-09). It found 302,494 Munsell notations covering 510 distinct chips. Moist and dry colours are mixed. Clauses that mention concentrations, depletions, mottles, masses, coats and similar were tagged as "feature" colours (64,063 mentions); all others were tagged as matrix (238,431). These counts describe typical pedons, not a random sample of all pedons.

| Breakdown | Share of all mentions |
|---|---|
| By hue family | YR 86.2 %, Y 12.2 %, N 1.0 %, R 0.25 %, GY 0.21 %, G 0.06 %, BG/B/PB < 0.05 % each |
| By hue | 10YR 59.9, 7.5YR 15.9, 2.5Y 9.1, 5YR 7.9, 5Y 3.0, 2.5YR 2.6, N 1.0, 10R 0.23, 5GY 0.19, 10Y 0.13 % |
| By value | 2: 4.7, 2.5: 0.9, 3: 15.2, 4: 26.4, 5: 28.7, 6: 15.8, 7: 6.2, 8: 2.1, ≥8.5: 0.03 %, 1: ≈0 |
| By chroma | 0: 1.05, 1: 11.9, 2: 28.3, 3: 22.3, 4: 22.2, 6: 11.5, 8: 2.7 %, other: ≈0 |
| Hues 10R–5Y with V 2–8 and C 1–8 | **98.4 %** |
| Gley hues (10Y–5PB) | 0.47 % |
| Chroma ≥ 8 | 2.7 % |
| Value ≤ 2.5 | 5.6 % |
| Value ≥ 8.5 | 0.03 % |
| Chips needed to cover 95 / 99 / 99.9 % | 102 / 174 / 315 |
| Coverage of the 460 chromatic NASIS chips | **99.88 %** of chromatic mentions |
| Feature colours with chroma ≥ 6 | 34.8 % |

### 2.3 Domains used for evaluation

All domains are built from the aqp chip grid: values 1, 2, 2.5, 3–8, 8.5, 9, 9.5 and integer chromas.

- **Typical:** 10R, 2.5YR, 5YR, 7.5YR, 10YR, 2.5Y and 5Y; V 2–8 including 2.5; C 1–8.
- **Rare but real:**
  - Gley: 10Y–5G at C 1–4 and 10G–5PB at C 1–2, V 2–8.
  - Red pages: 5R and 7.5R.
  - High chroma: 10R–5Y at C 8–14.
  - Dark: V 1–2.5.
  - Light: 7.5YR–5Y at V 8.5–9.5.
  - Redox concentrations: 2.5YR–10YR, V 3–7, C 6–8.
- **OSD-weighted:** each chip weighted by its OSD mention count.
- **All chromatic aqp rows:** 10,438 rows, mostly out of gamut and outside the soil domain.

Neutrals are left out because they are pinned to the renotation value scale on purpose (`tests/munsell.test.ts`, commit 6d6be27).

## 3. Reference data and why aqp is not the best target

**References used:**

- **aqp 2.3.2** `data(munsell)`: 10,450 rows.
- **munsellinterpol 3.6-0** `MunsellToxyY()`:
  - Bicubic interpolation over hue × chroma and cubic over value.
  - Inputs are the renotation data plus Centore's work.
  - Converted here to D65 Lab with Bradford adaptation from illuminant C.
  - Y multiplied by 1.02568 to put it on the same Newhall value scale the library uses, so the comparison measures chromatic error only.
- **RIT renotation `all.dat`** (4,995 rows), converted the same way.

munsell.js, an independent implementation, agrees with munsellinterpol within 0.09 ΔE00 mean on typical colours when both use the D1535-08 scale (§6). That cross-check is why munsellinterpol is the primary reference below.

**aqp build issues** (aqp repository at commit `731e3a6`, `misc/utils/Munsell/`):

- `prepare-munsell-LUT.R:46,49` runs `m$Y <- pmin(m$Y, 100)` and then `rescale(m$Y, to = c(0, 1))`. `scales::rescale` maps the data range, whose minimum is renotation V=0.2 with Y=0.237, onto 0–1. That gives Y′ = (Y−0.237)/99.76. I reproduced aqp's L\* = 8.79 at V=1, against 10.63 on the renotation scale. The bias shrinks toward mid values (V2: 19.6 vs 20.5).
- `local-functions.R:110-120` (`interpolateChroma`) fits a natural spline through the even chromas and evaluates it from C=1 upward. C=1 therefore comes from backward extrapolation. Two examples: 5GY 1/1 has a\*=+3.05, b\*=−1.79, which is a purplish hue for a green-yellow chip, and 10R 8/1 has only about 15 % of the chroma of 10R 8/2. Of the 520 aqp C1 chips, 84 differ from munsellinterpol by more than 2 ΔE00 (mean 1.22).
- `local-functions.R:338-345` clips sRGB, and `prepare-munsell-LUT.R:532` computes the L, A, B columns from the clipped RGB. aqp's Lab is therefore not true colorimetry for out-of-gamut chips: 6,530 of 10,450 rows have at least one clipped channel.
- `munsell2rgb()` is a pure table join that snaps to the nearest valid value or chroma (verified by printing the installed function). It does not interpolate.

**Disagreement between aqp and munsellinterpol** (mean / p95 ΔE00):

| Domain | Mean | p95 |
|---|---|---|
| Typical | 0.44 | 0.84 |
| Gley | 0.56 | 1.42 |
| Dark | 1.29 | 2.41 |
| Light | 0.53 | 1.28 |
| Redox | 0.29 | 0.52 |

Recomputing aqp's own colours with the library's L\* gives a floor of 0.37 on typical colours. aqp's Y rescale alone produces most of the gap.

**Value scale.** The renotation Y column is relative to MgO (Y=102.57 at V=10 in `all.dat`). colour-science defines two functions:

- `luminance_Newhall1943`: 1.2219V − 0.23111V² + … (`colour/colorimetry/luminance.py:162`). This is the library's polynomial.
- `luminance_ASTMD1535`: 1.1914V − 0.22533V² + 0.23352V³ − 0.020484V⁴ + 0.00081939V⁵ (`:214`). This is the D1535-08 form.

munsellinterpol (`R/VandY.R:12,33`) and munsell.js (`src/convert.ts:31-33`) both use the D1535 form, where Y(10)=100. The library's numbers sit about 2.5 % higher in Y:

| Value | Newhall L\* (current) | D1535-08 L\* | Difference |
|---|---|---|---|
| 2 | 20.54 | 20.24 | +0.31 |
| 5 | 51.57 | 51.00 | +0.57 |
| 8 | 81.35 | 80.53 | +0.82 |
| 9.5 | 96.00 | 95.06 | +0.94 |

That is at most about 0.8 ΔE00 (1.5 at 10YR 9.5/2-like colours), or 1–2 hex steps.

## 4. Current baseline

- **Code:**
  - `munsellValueToY` (`src/utils/munsell-approx.ts:293-301`) uses the Newhall polynomial.
  - `hueData` (`:34-220`) holds 20 anchors and 145 (chroma, a\*, b\*) points.
  - `interpolateLab` (`:310-336`) interpolates linearly in Cartesian a\*b\* between anchors and piecewise-linearly in chroma.
  - Lab→XYZ→sRGB runs at `:342-398`. Hex formatting is at `:458-461`.
- **Bundle:**
  - The module alone, bundled with esbuild, is 11,064 B unminified, **6,453 B minified and 2,540 B gzipped**. That is 12 % of `dist/index.esm.min.js` (53,477 B) and 14 % of its gzipped size (17,764 B).
  - Adding the `munsellToHex` wrapper brings it to 6,859 B minified.
  - The `hueData` numbers as a literal are 2,056 B raw and 946 B gzipped.
- **Accuracy** (ΔE00 mean / p95 / max):

| Reference | Typical | Gley | Red 5R/7.5R | High C | Dark V≤2.5 | Light V≥8.5 | Redox | All chromatic | OSD-weighted mean / p95 |
|---|---|---|---|---|---|---|---|---|---|
| munsellinterpol | 1.12 / 2.34 / 5.1 | 1.05 / 2.32 / 3.2 | 1.48 / 3.57 / 5.7 | 0.94 / 2.52 / 5.1 | 2.19 / 4.04 / 6.1 | 1.83 / 2.60 / 2.9 | 0.72 / 1.50 / 1.8 | 2.53 / 8.59 / 28.3 | 0.78 / 1.58 |
| aqp | 1.18 / 2.34 / 5.3 | 1.27 / 3.04 / 4.3 | 1.54 / 4.08 / 5.6 | 0.94 / 2.70 / 5.3 | 2.74 / 5.20 / 11.7 | 1.99 / 2.60 / 2.7 | 0.70 / 1.24 / 1.6 | 2.60 / 8.60 / 28.3 | 0.80 / 1.49 |

  - For reference, the CIE76 means against aqp are 1.53 (typical) and 5.24 (all), consistent with the numbers in the brief.
  - Against munsellinterpol, the worst typical chips are dark reds: 10R 2/7 at 5.1, 10R 2/8 at 4.9, and 2.5YR 2/5–2/7 at 3.5–3.8. At value 1, 10R/2.5YR at C 3–4 reach about 6.
  - The value-independent a\*b\* is the cause: chroma-per-a\*b\* shrinks at low value, so dark reds come out too saturated.
- **CPU** (Node 25, Ryzen 9 9950X):

| Operation | Time per call |
|---|---|
| `munsellToHex` | 1,189 ns |
| `munsellToRgbApprox(string)` | 1,136 ns |
| `parseMunsellHueAngle` | 68 ns |
| `interpolateLab` | 88 ns |
| 3 × `toString(16)` hex formatting | 185 ns (vs 25 ns with one integer `toString`) |
| `Math.pow(Y, 1/3)` | 12 ns (`Math.cbrt` 10 ns) |
| 3 × gamma `pow` | 45 ns (15 ns with a 256-entry threshold search) |
| Map-memoized `munsellToHex` | 43 ns |

  - Most of the remaining time is in the string round trip: `munsellToHex` builds `"H V/C"` and `munsellToRgbApprox` splits and re-parses it.
  - `labToXyz` cubes `(L+16)/116`, which only undoes the `cbrt` used to compute L\*. Using `cbrt(Y)` directly would remove one cbrt and three multiplications.

## 5. How other implementations do it (primary source code)

| Implementation | Method | Data size | Notes |
|---|---|---|---|
| **colour-science** `munsell_specification_to_xyY_Centore2014` (`colour/notation/munsell/centore2014.py`, commit `136aa0b`) | Y from `luminance_ASTMD1535(value)` (`:404`). Non-integer values: linear interpolation of x,y against Y between floor and ceil value planes (`:409-438`). Odd chroma: linear between even renotation chromas, with C=0 collapsing to the illuminant C point (`:2232`). Non-renotation hues: bounding renotation hues, then linear or radial interpolation about the grey point, chosen per (hue, value, chroma) from a hand-made table (`interpolation_method_from_renotation_ovoid`, `:1577`; radial branch `:2000`). Requires integer value 1–9 for the ovoid step and even chroma 2–50 (`:1906,1918`). | `datasets/munsell/all.py` is 287 KB of source; `real.py` 158 KB | Reference-grade. The method table and full dataset are far too large for a browser bundle. |
| **colour-science ONNX** (`colour/notation/munsell/onnx.py:9`) | Pre-trained MLPs from the `colour-science/learning-munsell` HuggingFace repository, "approximately 0.5 ΔE accuracy" | ONNX model files plus a runtime | Out of scope: needs an ONNX runtime. |
| **munsellinterpol** 3.6-0 (`R/MunsellToxyY.R`, CRAN mirror `cran/munsellinterpol`; authors Gama, Centore, Davis) | Per value plane, bicubic cardinal-spline interpolation over hue × chroma in xy, or optionally in ab (`:8-10, 64-67, 151`). Cubic interpolation across value planes, falling back to linear below V=2 (`:160-204`). | Lookup tables in `R/sysdata.rda` | Used here as the primary reference. |
| **aqp** `munsell2rgb` (installed 2.3.2) | Table join on (hue, value, chroma) with snapping. The table is built offline from `all.dat` with univariate natural splines for odd chromas and V 2.5/8.5 (`prepare-munsell-LUT.R`, `local-functions.R:110-195`). | 10,450 rows | See §3 for its biases. |
| **munsell.js** 1.1.7 (`privet-kitty/munsell.js`, `src/convert.ts`, commit `66229e7`) | Precomputed renotation data in LCHab (illuminant C) over 40 hues × values × 26 half-chroma steps (`src/MRD.ts`, 372 KB source). Polar (circular) interpolation between hues (`:120`), Cartesian a\*b\* interpolation between chromas (`:155`), linear in value, D1535-08 Y (`:31-33`), Bradford to D65 (`:314`). | Bundle 373,127 B minified / 126,425 B gzipped (measured) | Accurate (§6) but about 7 times this whole library. |

## 6. Experiments

Every model shares the library's L\* (Newhall scale) and clip/round pipeline; only the a\*b\* model changes. Training data is the renotation `all.dat` at V 1–10, C ≤ 16, all 40 hues. Typical-domain chips get 3 times the weight. Bytes are the node or coefficient numbers written as a JS literal (raw / gzip −9), not counting code.

Model labels are run IDs from `scripts/fit_munsell_models.py`, grouped by family:
- **M0**: the value-independent anchor grid the library used before this study.
- **M1, M2**: value × chroma node grids.
- **M4**: per-anchor polynomials in value and chroma.
- **M6**: a lookup table of soil-book chips.

The letter is the variant. The library now uses **M4e**, the 8-term polynomial over 20 hue anchors.

ΔE00 against **munsellinterpol** (mean / p95 / max; OSD-weighted as mean / p95):

| Model | Bytes raw / gz | Typical | Gley | Red 5R/7.5R | High C 8–14 | Dark V1–2.5 | Light V8.5–9.5 | Redox | All chromatic | OSD-weighted |
|---|---|---|---|---|---|---|---|---|---|---|
| M0 current | 2,056 / 946 | 1.12 / 2.34 / 5.1 | 1.05 / 2.32 / 3.2 | 1.48 / 3.57 / 5.7 | 0.94 / 2.52 / 5.1 | 2.19 / 4.04 / 6.1 | 1.83 / 2.60 / 2.9 | 0.72 / 1.50 / 1.8 | 2.53 / 8.59 / 28.3 | 0.78 / 1.58 |
| M0-LS same structure, least-squares refit | ≈1,350 / 600 | 1.08 / 2.20 / 4.2 | 1.06 / 2.60 / 3.7 | 1.52 / 2.91 / 4.7 | 1.24 / 3.59 / 5.1 | 2.20 / 4.03 / 6.1 | 1.90 / 2.71 / 2.9 | 0.71 / 1.33 / 1.6 | 1.89 / 5.20 / 22.4 | 0.72 / 1.58 |
| M4f polynomial, 6 coefficients × 20 anchors, linear above C12 | 1,774 / 694 | 0.45 / 1.10 / 1.6 | 0.57 / 1.32 / 2.5 | 0.61 / 1.25 / 1.9 | 0.49 / 1.32 / 2.0 | 0.88 / 1.78 / 2.5 | 0.70 / 1.21 / 1.6 | 0.41 / 0.89 / 1.2 | 1.30 / 5.45 / 22.4 | 0.50 / 1.22 |
| **M4e polynomial, 8 coefficients × 20 anchors, linear above C12** | 2,348 / 845 | 0.42 / 0.96 / 1.4 | 0.59 / 1.62 / 2.5 | 0.53 / 1.14 / 2.0 | 0.45 / 1.20 / 2.2 | 0.93 / 1.98 / 2.5 | 0.42 / 0.90 / 1.1 | 0.39 / 0.83 / 1.1 | 1.29 / 5.52 / 22.4 | 0.37 / 0.77 |
| M4d polynomial, 8 coefficients × 40 hues | 4,719 / 1,639 | 0.38 / 0.98 / 1.7 | 0.59 / 1.57 / 2.5 | 0.54 / 1.10 / 1.9 | 0.40 / 1.15 / 1.8 | 0.90 / 2.07 / 2.5 | 0.36 / 0.76 / 0.9 | 0.32 / 0.84 / 1.2 | 2.09 / 8.34 / 50.4 | 0.36 / 0.78 |
| M1g grid 20 × V1–10 × C{2,4,6,8,12,16}, least squares, nodes rounded to 1.0 | 7,708 / 2,793 | 0.30 / 0.81 / 1.5 | 0.38 / 0.94 / 1.7 | 0.32 / 0.79 / 1.0 | 0.23 / 0.62 / 1.1 | 0.39 / 0.81 / 1.5 | 0.25 / 0.87 / 1.2 | 0.27 / 0.64 / 0.8 | 0.60 / 2.17 / 16.7 | 0.36 / 1.05 |
| **M1g same grid, nodes rounded to 0.5** | 10,168 / 3,422 | 0.24 / 0.74 / 1.3 | 0.25 / 0.71 / 1.3 | 0.26 / 0.74 / 1.3 | 0.21 / 0.56 / 0.9 | 0.29 / 0.80 / 1.5 | 0.16 / 0.62 / 0.8 | 0.25 / 0.59 / 0.8 | 0.58 / 2.19 / 16.3 | 0.25 / 0.80 |
| M1b grid 20 × V1–10 × C{2..12,16}, full precision | 14,108 / 5,340 | 0.21 / 0.68 / 1.3 | 0.19 / 0.65 / 1.3 | 0.23 / 0.64 / 1.2 | 0.18 / 0.51 / 0.9 | 0.25 / 0.73 / 1.5 | 0.17 / 0.57 / 0.8 | 0.23 / 0.59 / 0.8 | 0.58 / 2.26 / 16.7 | 0.20 / 0.86 |
| M1c = M1b nodes with polar (LCh) hue blend | 14,108 / 5,340 | 0.20 / 0.71 / 1.3 | 0.19 / 0.65 / 1.3 | 0.22 / 0.49 / 0.8 | 0.21 / 0.60 / 1.0 | 0.27 / 0.76 / 1.5 | 0.22 / 0.74 / 1.1 | 0.19 / 0.56 / 0.8 | 0.60 / 2.38 / 17.0 | 0.18 / 0.68 |
| M1d grid with only 7 value nodes {1,2,3,5,7,9,10} | 9,875 / 3,792 | 0.26 / 0.68 / 1.2 | 0.22 / 0.70 / 1.3 | 0.24 / 0.58 / 1.2 | 0.22 / 0.63 / 1.0 | 0.28 / 0.76 / 1.5 | 0.23 / 0.60 / 0.9 | 0.26 / 0.64 / 0.9 | 0.59 / 2.22 / 17.4 | 0.34 / 0.68 |
| M1e = M1b stored as int8 a/C, b/C (step 0.05) | ≈3,730 (base64) | 0.46 / 1.59 / 2.3 | 0.33 / 1.45 / 2.3 | 0.22 / 0.73 / 1.2 | 0.49 / 2.02 / 2.6 | 0.27 / 0.69 / 1.5 | 1.59 / 2.87 / 3.2 | 0.25 / 0.59 / 0.9 | 0.71 / 2.68 / 17.0 | 0.44 / 1.28 |
| M2a 40 renotation hues × V1–10 × C ≤ 16, sampled | 28,053 / 10,334 | 0.13 / 0.60 / 1.2 | 0.14 / 0.59 / 1.3 | 0.11 / 0.47 / 0.7 | 0.11 / 0.43 / 0.9 | 0.23 / 0.73 / 1.2 | 0.09 / 0.49 / 0.8 | 0.05 / 0.32 / 0.7 | 0.49 / 2.16 / 15.8 | 0.11 / 0.68 |
| M6 hex lookup table of the 460 NASIS chips (from munsellinterpol) + M4e fallback | ≈4,200 raw (estimated) | 0.19 / 0.83 / 1.4 | 0.34 / 1.35 / 2.5 | 0.15 / 0.72 / 1.3 | 0.43 / 1.20 / 2.2 | 0.69 / 1.84 / 2.5 | 0.29 / 0.75 / 0.9 | 0.19 / 0.77 / 0.9 | 1.27 / 5.52 / 22.4 | ≈0.00 (by construction) |
| munsell.js 1.1.7, D1535-08 scale, vs unscaled munsellinterpol | 373,127 / 126,425 (bundle) | 0.09 / 0.57 / 1.6 | 0.09 / 0.57 / 1.0 | 0.06 / 0.49 / 1.2 | 0.03 / 0.30 / 1.0 | 0.23 / 0.81 / 1.6 | 0.11 / 0.55 / 0.8 | 0.02 / 0.25 / 0.3 | 0.05 / 0.40 / 3.3 | 0.03 |

**Polynomial basis (M4).** For each anchor, a\* and b\* are each Σ cₖ·[C, CV, CV², CV³, C², C²V, C²V², C³]ₖ (8 terms; M4f uses the first 6). Values are blended linearly in hue between anchors. Above C=12, the C=12 result is scaled linearly by C/12, because without that the cubic terms blow up (max error 50). The coefficients are fitted at C ≤ 12.

**What the experiments show:**

- **Value dependence is the main gain.** Every value-dependent model, at any size, roughly halves to quarters the current error. Refitting the current value-independent structure (M0-LS) does not help.
- **Adding hues helps less than adding value nodes.** Going from 20 to 40 hues (M1b to M2a) lowers the typical mean from 0.21 to 0.13 at twice the bytes. Removing 3 of the 10 value planes (M1d) raises the OSD-weighted mean from 0.20 to 0.34.
- **Polar (LCh) hue blending is a small win.** OSD-weighted mean goes from 0.20 to 0.18 and the red-page p95 from 0.64 to 0.49, for 4 extra trig calls. munsell.js also blends polar.
- **Quantization must be done carefully.** Rounding nodes to 0.5 Lab costs only +0.03. The naive int8 slope encoding overflowed at high values: 5Y b\*/C is more than 6.35 at V9, so the light domain rose to 1.59.
- **A chip lookup table matches only the chips it holds.** It is exact for the 99.88 % of OSD mentions that are book chips, but odd chromas and off-book chips fall back to the fallback model's accuracy.
- **Rare domains need the grid.** The polynomial is good for the typical and OSD-weighted cases. For dark colours (0.9 vs 0.3–0.4) and gley (0.6 vs 0.25–0.4) the grid (M1g) is clearly better.

### Reproducing the results

The scripts are in `scripts/`. The large reference exports (`aqp_munsell.csv`, `mi_xyY.csv`) and the munsell.js bundle are git-ignored; steps 1–2 regenerate them.

Steps 5–6 measure the original value-independent anchor grid, which the library no longer uses. Run them from a checkout of commit `4ded6e9` (`git worktree add ../munsell-study 4ded6e9`). There, the fit script parses `hueData` from the TS source, and the benchmark scripts are present. The scripts were renamed afterwards; at `4ded6e9` they are called:
- `exp1.py` (now `fit_munsell_models.py`)
- `mlib.py` (now `munsell_color.py`)
- `table.py` (now `make_results_table.py`)
- `exp1_results.json` (now `munsell-model-results.json`)
- `exp1_table.md` (now `munsell-model-results-table.md`)
- `exp1_stdout.txt` (now `munsell-model-fit-log.txt`)
- `candidate_M4e.json` (now `munsell-ab-polynomial-coefficients.json`)
- `candidate_M1g.json` (now `munsell-ab-grid-coefficients.json`) The munsellinterpol reference fixture used by the tests is built by `scripts/make_munsellinterpol_fixture.py` from `mi_xyY.csv`.

1. Export the reference data:
   - aqp: `Rscript -e 'library(aqp); data(munsell); write.csv(munsell,"aqp_munsell.csv",row.names=FALSE)'`.
   - RIT `all.dat`: `gh api repos/ncss-tech/aqp/contents/misc/utils/Munsell/munsell-all.dat.gz --jq .download_url | xargs curl -sLO`.
2. munsellinterpol reference: install `munsellinterpol` 3.6-0 from CRAN, run `MunsellToxyY(sprintf("%s %s/%s",hue,value,chroma), warn=FALSE)` over the chromatic aqp rows, and write `x,y,Y` to `mi_xyY.csv`.
3. Convert xyY (illuminant C) to D65 Lab:
   - Bradford matrix (Lindbloom): `[[0.9904476,-0.0071683,-0.0116156],[-0.0123712,1.0155950,-0.0029282],[-0.0035635,0.0067697,0.9181569]]`.
   - Y/100. For munsellinterpol, multiply Y by 1.02568 to put it on the library's Newhall scale.
4. OSD frequencies:
   - `git clone --depth 1 --filter=blob:none --sparse https://github.com/ncss-tech/SoilKnowledgeBase && git sparse-checkout set inst/extdata/OSD`.
   - Regex `\b(N|\d+(?:\.\d+)?(?:YR|GY|BG|PB|RP|R|Y|G|B|P))\s+(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)?` over each `TYPICAL PEDON.content`, split on `;` for the feature/matrix tag (`osd_colors.py`).
5. Models and metrics, at `4ded6e9` (original file names): `python3 -I scripts/exp1.py <expdir> aqp_munsell.csv all.dat osd_colors.csv src/utils/munsell-approx.ts` (numpy + scipy). `<expdir>` holds `mi_xyY.csv` and receives the outputs. Then run `python3 -I scripts/table.py <expdir>/exp1_results.json`.
   - The soil-book lookup-table experiment (M6) also reads `<expdir>/../dl_names/names.csv`. This is a CSV with a `munsell` column of Munsell Soil Color Book chip notations, such as a NASIS colour-name export. At `4ded6e9` the script imports `mlib` from `<expdir>`, so copy `scripts/mlib.py` there first. In the current tree, `fit_munsell_models.py` takes `names.csv` as an optional 6th argument and finds `munsell_color.py` itself.
   - The Python port of the current algorithm (`munsell_color.py`) reproduces the TS hex output exactly for all 10,450 rows.
   - Candidate coefficient tables are written to `munsell-ab-polynomial-coefficients.json` (M4e, 20×8×2) and `munsell-ab-grid-coefficients.json` (20×10×6×2).
6. Benchmarks (at `4ded6e9` only; the scripts were removed afterwards): `npx --prefix <repo> tsx scripts/bench.ts` and `scripts/bench2.ts` (2–3 M iterations after warm-up).
7. Bundle size: `npx esbuild src/utils/munsell-approx.ts --bundle --format=esm --minify | gzip -9 | wc -c`.

## 7. Options compared

Accuracy is the typical-domain / OSD-weighted mean ΔE00 against munsellinterpol. Byte counts are for data only.

| Option | Accuracy | Data bytes raw / gz | CPU per call | Complexity | Fits bundle? |
|---|---|---|---|---|---|
| Current (M0) | 1.12 / 0.78 | 2.1 K / 0.95 K | ~1.2 µs (mostly strings) | Low | Yes |
| **Value-dependent polynomial (M4e)** | 0.42 / 0.37 | 2.3 K / 0.85 K | Same or less (≈16 multiply-adds per anchor, no search loop) | Low; needs an offline fit script | Yes, about the same size |
| Smaller polynomial (M4f) | 0.45 / 0.50 | 1.8 K / 0.69 K | Same | Low | Yes, smaller than today |
| **Value × chroma grid (M1g, 0.5 rounding)** | 0.24 / 0.25; worst case ≤ 1.5 in every soil domain | 10 K / 3.4 K as a literal; ≈4.8 K / 1.8 K delta-coded (estimated) | Same (trilinear, 8 node reads) | Medium; needs an offline fit script and optionally a decoder | Yes, +3–8 KB minified |
| Grid + polar hue blend (M1c) | 0.20 / 0.18 | Same as the grid | +4 trig calls | Medium | Yes |
| Hex lookup table of the 460 soil-book chips + polynomial fallback (M6) | Exact on 99.9 % of real usage; fallback elsewhere | ≈1.8 K table (base64) + 2.3 K coefficients | Fastest (table read) | Medium; key layout per hue page | Yes |
| 40-hue renotation table (M2a) | 0.13 / 0.11 | 28 K / 10 K | Same | Medium | Large |
| Full renotation (munsell.js, colour-science) | 0.09 / 0.03 | 370 K+ / 126 K | Similar | High | No |
| ONNX MLP (colour-science) | ≈0.5 ΔE (as stated by the authors) | Model + runtime | High | High | No |
| Memoization (any model) | — | 0 | 43 ns once cached | Trivial | Yes |

## 8. Recommendations (ranked by accuracy gain per byte and per unit of complexity)

1. **Replace `hueData` with the value-dependent polynomial (M4e)**. It is about the same size or smaller and gives 2.5 times lower typical error and 2 times lower frequency-weighted error. Dark-red worst cases drop from 5–6 ΔE00 to at most 2.5. Code is simpler than today: no chroma-segment search. Keep the Newhall (1943) L\* and the neutral path unchanged.
2. **If rare-domain worst cases matter more than about 2 KB gzipped, use the M1g grid instead** (0.5 rounding, optional polar blend). It is the only compact option that keeps gley, dark (V≤2.5), light and redox colours at or below 1.5 ΔE00 maximum.
3. **Recalibrate against the renotation data or munsellinterpol, not aqp.**
   - Commit a small offline fit script, for example under `scripts/`, that reads `all.dat` and writes the coefficient table.
   - Add a test fixture generated from munsellinterpol covering typical plus rare chips (around 600 rows).
   - Keep the aqp fixture only as a loose sanity bound, because of aqp's Y rescale, its C1 extrapolation and its clipped-Lab issues (§3).
4. **Fix the value-function label and make an explicit decision about the scale.**
   - The polynomial is Newhall et al. (1943) MgO-relative, not ASTM D1535-08.
   - Changing it shifts every colour by 0.3–0.8 ΔE00 (darker), and the neutral-gray test (commit 6d6be27) would need the same scale.
   - **Unverified:** which scale best matches printed soil charts under typical display viewing. Both are defensible. The minimum is to correct the comment at `src/utils/munsell-approx.ts:289`.
5. **Cheap CPU and robustness improvements**, all independent of the model:
   - Pass numbers from `munsellToHex` instead of re-serializing to `"H V/C"` and parsing again.
   - Format hex with one integer `toString(16)`.
   - Use `cbrt(Y)` directly instead of computing L\* and then cubing it back.
   - Optionally add a `Map` memo. These together save roughly 0.8–1 µs per call.
6. **Do not adopt** full renotation tables, munsell.js or ONNX models. Do not use naive int8 slope packing without checking its range.

**Suggested next step:**

- Port `munsell-ab-polynomial-coefficients.json` (or `munsell-ab-grid-coefficients.json`) into a branch of `munsell-approx.ts` behind the existing `munsellToRgbApprox` signature.
- Generate the munsellinterpol fixture with the R snippet in §6 step 2.
- Add tests asserting mean ΔE00 ≤ 0.5 on the typical domain and max ≤ 2.5 on each rare domain.
- Re-measure the module's minified and gzipped size with the esbuild command above.

## 9. Sources

- USDA Soil Survey Staff (2017). *Soil Survey Manual*, USDA Handbook 18, ch. 3 "Soil Color", pp. 146–151.
  - Text read from the mirror https://www.iec.cat/Mapasols/DocuInteres/PDF/Llibre50.pdf.
  - The canonical NRCS copy (https://www.nrcs.usda.gov/resources/guides-and-instructions/soil-survey-manual) timed out from this environment, so whether the two are identical is unverified.
- NASIS traditional colour names: https://github.com/ncss-tech/aqp/blob/731e3a6697259c86f8344b462c74f2cb8f60fbac/misc/utils/Munsell/traditional-names-from-NASIS.csv
- aqp LUT build: https://github.com/ncss-tech/aqp/blob/731e3a6697259c86f8344b462c74f2cb8f60fbac/misc/utils/Munsell/prepare-munsell-LUT.R (lines 46, 49, 52, 532) and `local-functions.R` (lines 110–120, 241–282, 288–345) in the same directory. aqp 2.3.2 `?munsell` and the installed `munsell2rgb` body.
- aqp neutral-chip issue: https://github.com/ncss-tech/aqp/issues/332 (closed; title "review neutral chip color coordinates, estimate spectra").
- Beaudette, Roudier & O'Geen (2013). Algorithms for quantitative pedology. *Computers & Geosciences*. https://doi.org/10.1016/j.cageo.2012.10.020 (cited by aqp's `munsell` documentation; not read here).
- RIT Munsell renotation data (`all.dat`, illuminant C): https://www.rit.edu/science/munsell-color-science-lab-educational-resources#munsell-renotation-data (copy used: aqp `misc/utils/Munsell/munsell-all.dat.gz`).
- Newhall, Nickerson & Judd (1943). Final report of the O.S.A. subcommittee on the spacing of the Munsell colors. *JOSA* 33(7):385–418. https://doi.org/10.1364/JOSA.33.000385 (polynomial as implemented in colour-science; paper not read).
- ASTM D1535 (Munsell notation). https://www.astm.org/d1535-14.html. Coefficients as implemented in colour-science and munsellinterpol; the standard itself was not read (paywalled).
- colour-science, commit `136aa0b`:
  - https://github.com/colour-science/colour/blob/136aa0beccd772355d7abbab17655c93b16a6b9f/colour/notation/munsell/centore2014.py
  - `.../colour/notation/munsell/onnx.py`
  - `.../colour/colorimetry/luminance.py`
- Centore, P. (2012). An open-source inversion algorithm for the Munsell renotation. *Color Research & Application* 37(6):455–464. https://doi.org/10.1002/col.20715. Also the MunsellAndKubelkaMunkToolbox: https://github.com/colour-science/MunsellAndKubelkaMunkToolbox (cited via colour-science; not read).
- munsellinterpol 3.6-0 (Gama, Centore, Davis): https://cran.r-project.org/package=munsellinterpol; source https://github.com/cran/munsellinterpol (`R/MunsellToxyY.R`, `R/VandY.R`).
- munsell.js 1.1.7: https://github.com/privet-kitty/munsell.js/blob/66229e7e8a547322e752e9025c65094d96e8f8a3/src/convert.ts; npm https://www.npmjs.com/package/munsell.
- Sharma, Wu & Dalal (2005). The CIEDE2000 color-difference formula. *Color Research & Application* 30(1):21–30. https://doi.org/10.1002/col.20070. Test data: https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
- Bradford C→D65 and sRGB matrices: http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html (values as used in aqp `local-functions.R`).
- Official Series Descriptions (parsed): https://github.com/ncss-tech/SoilKnowledgeBase/tree/fbf3e54e611b440e141259ac59b766df2c74fc69/inst/extdata/OSD
- Munsell Soil Color Book retail listing (Gley 1 and 2 are separate charts): https://www.pantone.com/products/munsell/munsell-soil-color-book. munsell.com returned HTTP 403.
- Repository code: `src/utils/munsell-approx.ts` (lines 34–220, 289–301, 310–336, 342–398, 450, 458–461), `src/core/munsell.ts`, `tests/munsell.test.ts`, `tests/fixtures/munsell-reference-soil.json`.
