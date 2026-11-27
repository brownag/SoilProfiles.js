# SoilProfiles.js 0.3.0 (unreleased)

Behaviour changes:
* `munsellToHex()` returns different (more accurate) hex colours for chromatic Munsell notations. Neutral grays (`N v/0`) are unchanged.
* Hue is interpolated continuously between the 20 standard anchors (5R, 10R, … 5RP), so intermediate hues such as 2.5YR and 7.5YR are no longer snapped to a neighbouring anchor.
* a\*/b\* now depend on Value as well as Hue and Chroma (fitted polynomial model). Against munsellinterpol, typical soil colours (10R–5Y, values 2–8, chromas 1–8) average 0.42 ΔE00 with a maximum of 1.4, down from 1.12 and 5.1. Gley, red, high-chroma, dark, light and redox colours stay within 2.6 ΔE00.

Performance:
* `munsellToHex()` caches up to 4,096 recent results and no longer builds and re-parses an intermediate `"H V/C"` string.
* The Munsell module is smaller: 2,325 B gzipped, down from 2,529 B.

Internal:
* Removed the internal `munsellToRgbApprox()`, `hueData` and `interpolateLab` from `src/utils/munsell-approx.ts`. None of them were exported from the package entry points.
* Corrected the documented source of the Munsell Value → Y polynomial: Newhall, Nickerson & Judd (1943), not ASTM D1535-08.
* Munsell tests use a munsellinterpol reference fixture (`scripts/make_munsellinterpol_fixture.py`) and CIEDE2000 instead of aqp's sRGB table. The study behind the model is in `docs/research/munsell-approximation.md`.

# SoilProfiles.js 0.2.0 (2026-09-01)

Breaking changes:
* `Horizon` interface: only `top` and `bottom` are required. Removed hardcoded fields like `name`, `color`, `clay`, and `sand`. Pass them as regular fields.
* Parsers (`DelimitedParser`, `OSDParser`, `SimpleParser`): require `fieldMapping` to map source columns to horizon fields. Removed `NASIS_ALIASES`.
* Depth validation: now opt-in via `SoilProfileConfig.validateDepths`. Defaults to `true`.
* `OSDParser`: no longer converts Munsell values to hex colors automatically. Call `munsellToHex()` directly.

New features:
* `SoilProfileConfig`: set custom column names (`idColumn`, `depthTopColumn`, `depthBottomColumn`) and configure validation.
* `fieldMapping`: map input columns to horizon properties. Unmapped columns pass through unchanged.
* Depth utilities: exported `repairDepths()` and `validateDepths()` in `src/core/depthRepair.ts`.
* Texture classification: added `TEXTURE_SYSTEM` constant. Added `classifyTextureUSDA()` and deprecated `classifyTexture()`.
* Deprecation warnings: older APIs log warnings and continue working.

Migration:
* See [MIGRATION.md](docs/MIGRATION.md) for code examples.
* Existing `Horizon` and `SoilProfile` constructors continue to work with default settings.
* Legacy parser wrappers (`parseDelimitedProfile()`, `parseOSDProfile()`, `parseSimpleProfile()`) still work. Switch to parser classes when possible.

# SoilProfiles.js 0.1.3 (2026-08-14)
* Support neutral Munsell colors (hue "N", e.g. "N 2/0", "N 2/", "N 2/-", "N 2.5/"). Default missing or dash ("-") chroma to 0.

# SoilProfiles.js 0.1.2 (2026-07-03)
* Add `onHorizonLeave` canvas listener, export `attachHorizonEventListeners`, and fix web demo paths.

# SoilProfiles.js 0.1.1 (2026-07-03)
* Update README, documentation, and demo code.

# SoilProfiles.js 0.1.0 (2026-06-20)
* Initial release with SVG, 2D canvas, and 3D visualizers, custom annotations, tooltips, and soil property support.


