# Migration Guide: v0.1.x → v0.2.0+

This guide details migrating to SoilProfiles.js v0.2.0, which introduces a flexible schema for soil horizons, modular entrypoint exports, and explicit field mapping for parsers.

## What Changed

### 1. Flexible Horizon Schema
**v0.1.x** enforced hardcoded horizon properties (`name`, `color`, `texture`, `clay`, `sand`, etc.).  
**v0.2.0+** allows arbitrary fields on horizons (`[key: string]: any`). Only `top` and `bottom` depths are required. Custom properties (such as bulk density, EC, or chemical extracts) are preserved as first-class properties.

### 2. Explicit Field Mapping for Parsers
Instead of implicit NASIS column aliases, v0.2.0 parsers accept a `fieldMapping` configuration (`Record<string, string>`) to map source data columns to horizon properties. Unmapped columns pass through automatically.

### 3. Modular Subpath Exports & Tree-Shaking
v0.2.0 provides isolated entry points with dedicated CommonJS and ESM builds:
- `soilprofiles` — Full package (all modules, static & interactive renderers, parsers)
- `soilprofiles/core` — Lightweight data structures & utilities only (`SoilProfile`, `SoilProfileCollection`, depth repair, layout, color scales; ~2–3 KB, no rendering code)
- `soilprofiles/static` — Server-safe static SVG rendering (`renderStaticSVG`, `renderComparisonSVG`)
- `soilprofiles/interactive` — Browser canvas and interactive rendering (`renderInteractive2D`)
- `soilprofiles/parsers/delimited` — Delimited CSV/TSV parser (`DelimitedParser`, `parseDelimitedProfile`, `parseDelimitedHorizons`)
- `soilprofiles/parsers/osd` — USDA Soil Knowledge Base OSD JSON parser (`OSDParser`, `parseOSDJson`)
- `soilprofiles/parsers/simple` — Minimal programmatic JSON parser (`SimpleParser`, `parseSimpleJson`)
- `soilprofiles/three3d` — Optional 3D Three.js renderer

### 4. Optional Validation & Repair
Depth validation and auto-repair are now configurable via `SoilProfileConfig` (both default to `true` for backward compatibility):
```typescript
const profile = new SoilProfile(id, horizons, position, metadata, annotations, {
  validateDepths: false,
  autoRepair: false
});
```
Standalone validation and repair utilities are also exported from `src/core/depthRepair.ts` (`repairDepths`, `validateDepths`, `validateDepthsStructured`).

### 5. Texture Classification System
Added `TEXTURE_SYSTEM = 'USDA'` constant and `classifyTextureUSDA()`. The legacy `classifyTexture()` function remains as a deprecated wrapper that logs a warning.

### 6. User-Driven Munsell Conversion
`OSDParser` preserves raw Munsell fields (`moist_hue`, `moist_value`, `moist_chroma`) without auto-converting them to hex colors. Convert them explicitly via `munsellToHex()` when hex color strings are required.

---

## Code Examples

### Delimited / CSV Parsing

#### v0.1.x
```typescript
import { parseDelimitedHorizons } from 'soilprofiles';

// Implicitly assumed NASIS field names (hzname, hzdept_r, hzdepb_r)
const csv = `hzname,hzdept_r,hzdepb_r,moist_hue,moist_value,moist_chroma
A,0,20,10YR,4,3
B,20,50,7.5YR,5,4`;

const horizons = parseDelimitedHorizons(csv);
```

#### v0.2.0+
Subpath imports (`soilprofiles/parsers/delimited`) are recommended for optimal tree-shaking, though root imports (`soilprofiles`) are also supported:

```typescript
// Recommended: modular subpath import
import { DelimitedParser } from 'soilprofiles/parsers/delimited';
// Root import also available:
// import { DelimitedParser } from 'soilprofiles';

const csv = `hzname,hzdept_r,hzdepb_r,color,moist_hue,moist_value,moist_chroma
A,0,20,#8B7355,10YR,4,3
B,20,50,#A0826D,7.5YR,5,4`;

const parser = new DelimitedParser({
  fieldMapping: {
    hzname: 'name',
    hzdept_r: 'top',
    hzdepb_r: 'bottom'
  }
});

const horizons = parser.parse(csv);
// horizons[0] = {
//   name: 'A',
//   top: 0,
//   bottom: 20,
//   color: '#8B7355',
//   moist_hue: '10YR',      // unmapped fields pass through as-is
//   moist_value: 4,
//   moist_chroma: 3
// }
```

### NASIS Data Mapping Example

To parse NASIS horizon export data:

```typescript
import { DelimitedParser } from 'soilprofiles/parsers/delimited';

const parser = new DelimitedParser({
  fieldMapping: {
    hzname: 'name',
    hzdept_r: 'top',
    hzdepb_r: 'bottom',
    claytotal_r: 'clay',
    sandtotal_r: 'sand',
    silttotal_r: 'silt',
    ph1to1h2o_r: 'ph',
    om_r: 'om',
    ksat_r: 'ksat'
  }
});

const horizons = parser.parse(nasisCsv);
// Unmapped columns (e.g. bulk density, structure) pass through automatically
```

### Custom Depth Column Names

If your source data uses non-standard depth headers:

```typescript
const parser = new DelimitedParser({
  depthTopColumn: 'upper_depth',
  depthBottomColumn: 'lower_depth',
  fieldMapping: {
    layer_name: 'name'
  }
});
```

### OSD & Simple Parsers

```typescript
// Recommended subpath imports:
import { OSDParser } from 'soilprofiles/parsers/osd';
import { SimpleParser } from 'soilprofiles/parsers/simple';

// Root imports also available:
// import { OSDParser, SimpleParser } from 'soilprofiles';

const osdParser = new OSDParser({
  fieldMapping: {
    moist_hue: 'munsellHue',
    moist_value: 'munsellValue',
    moist_chroma: 'munsellChroma'
  }
});

const horizons = osdParser.parse(osdDocument.HORIZONS);
```

---

## SoilProfile Configuration: Validation & Repair

In v0.1.x, validation and gap/overlap repair were always executed during instantiation. In v0.2.0+, behavior is configurable via `SoilProfileConfig`:

```typescript
import { SoilProfile } from 'soilprofiles/core';

// Default behavior: validateDepths=true, autoRepair=true (backward compatible with v0.1.x)
const profile = new SoilProfile('P001', horizons);

// Disable validation and auto-repair when working with pre-cleaned data:
const cleanProfile = new SoilProfile('P001', horizons, undefined, {}, [], {
  validateDepths: false,
  autoRepair: false
});
```

---

## Deprecation & Removal Schedule

| API | Status in v0.2.0 | Recommended Replacement | Planned Removal |
|-----|------------------|-------------------------|-----------------|
| Implicit NASIS column aliases | Removed | Use `fieldMapping` config | Removed in v0.2.0 |
| `classifyTexture()` | Deprecated (logs warning) | `classifyTextureUSDA()` | v1.0.0 |
| `parseDelimitedProfile()` wrapper | Deprecated | `new DelimitedParser().parse()` | v1.0.0 |
| `parseDelimitedHorizons()` wrapper | Deprecated | `new DelimitedParser().parse()` | v1.0.0 |
| `parseOSDJson()` wrapper | Deprecated | `new OSDParser().parse()` | v1.0.0 |
| `parseSimpleJson()` wrapper | Deprecated | `new SimpleParser().parse()` | v1.0.0 |

---

## FAQ

### Do I have to update my parser code?
Yes, if your code relied on implicit NASIS column aliases. Add explicit `fieldMapping` when instantiating or calling parsers.

### Which import paths should I use?
- For maximum tree-shaking in modern bundlers: use subpaths (`soilprofiles/core`, `soilprofiles/static`, `soilprofiles/parsers/delimited`).
- For quick prototyping or full bundle usage: `import { ... } from 'soilprofiles'` remains fully supported.

### Will Munsell colors be converted to hex automatically?
No. Munsell values are retained as discrete fields. If hex colors are needed, call `munsellToHex(hue, value, chroma)` explicitly.

### How do unmapped properties behave?
All unmapped columns and JSON attributes are preserved as first-class properties on the resulting `Horizon` object (with numeric strings coerced to numbers when applicable).

---

## See Also
- [README.md](../README.md) — Comprehensive library documentation and API reference
- [NEWS.md](../NEWS.md) — Release notes for v0.2.0
- [tests/parsers.test.ts](../tests/parsers.test.ts) — Executable test cases demonstrating `fieldMapping` and custom property handling
