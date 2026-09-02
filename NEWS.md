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


