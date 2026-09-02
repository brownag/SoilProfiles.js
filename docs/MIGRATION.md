# Migration Guide: v0.1.x → v0.2.0+

Welcome! This guide helps you migrate to SoilProfiles.js v0.2.0, which introduces a flexible schema for soil horizons and explicit field mapping for parsers. The changes make the library more adaptable to different data sources while maintaining backward compatibility.

## What Changed

### 1. Flexible Horizon Schema
**v0.1.x** assumed hardcoded horizon fields (`name`, `color`, `texture`, etc.). **v0.2.0+** allows arbitrary fields on horizons—any property you need is now first-class.

### 2. Explicit Field Mapping for Parsers
Instead of implicit NASIS field aliases, v0.2.0 parsers accept a `fieldMapping` config to map raw data columns to horizon properties.

### 3. Optional Validation & Repair
Depth validation and auto-repair are now configurable flags (both default to `true` for backward compatibility). You can disable them if your data is already clean.

### 4. Munsell Conversion is User-Driven
The OSDParser no longer auto-converts Munsell hue/value/chroma to hex color. Instead, unmapped Munsell fields are preserved as-is, and you convert them explicitly if needed.

---

## Old Code Example (v0.1.x)

In v0.1.x, parsers assumed NASIS field names and converted Munsell automatically:

```typescript
import { parseDelimitedHorizons } from 'soilprofiles';

// This worked in v0.1.x because parsers assumed specific field names
const csv = `hzname,hzdept_r,hzdepb_r,moist_hue,moist_value,moist_chroma
A,0,20,10YR,4,3
B,20,50,7.5YR,5,4`;

const horizons = parseDelimitedHorizons(csv);
// v0.1.x silently assumed: hzname → name, hzdept_r → top, hzdepb_r → bottom
// and Munsell was auto-converted (if color wasn't provided)
```

---

## New Code Example (v0.2.0+)

In v0.2.0, you explicitly map fields using `fieldMapping`:

```typescript
import { DelimitedParser } from 'soilprofiles';

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

**Key differences:**
- `fieldMapping` explicitly renames columns (e.g., `hzname` → `name`)
- All unmapped columns pass through as first-class properties
- Munsell fields are NOT auto-converted; they're just data
- Depth columns (`top`, `bottom`) can be renamed via `depthTopColumn` / `depthBottomColumn`

---

## Field Mapping Migration

### NASIS Parsing Example

If you were parsing NASIS data in v0.1.x, here's how to migrate:

**v0.1.x:**
```typescript
// Assumed NASIS field names implicitly
const horizons = parseDelimitedHorizons(nasisCsv);
```

**v0.2.0+:**
```typescript
import { DelimitedParser } from 'soilprofiles';

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
    ksat_r: 'ksat',
    // ...add more mappings as needed
  },
  // All unmapped NASIS columns (structure, consistence, etc.) pass through automatically
});

const horizons = parser.parse(nasisCsv);
```

### Unmapped Fields Pass Through

Any column not in `fieldMapping` is added as-is to horizons. This means you don't need to map every field—just the ones you want renamed:

```typescript
const parser = new DelimitedParser({
  fieldMapping: {
    hzname: 'name'  // Only rename this one
  }
});

const horizons = parser.parse(csv);
// horizons will have:
// - .name (from hzname)
// - .top, .bottom (depth defaults if present in CSV)
// - .structure (unmapped, passed through)
// - .ph_class (unmapped, passed through)
// - ... any other columns in the CSV
```

### OSD & Simple Parsers

The same pattern applies to `OSDParser` and `SimpleParser`:

```typescript
import { OSDParser } from 'soilprofiles';

const parser = new OSDParser({
  fieldMapping: {
    moist_hue: 'munsellHue',
    moist_value: 'munsellValue',
    moist_chroma: 'munsellChroma'
  }
});

const horizons = parser.parse(osdData);
```

---

## SoilProfile Config: Validation & Repair

By default, SoilProfile validates depths and auto-repairs overlaps/gaps. In v0.2.0, you can disable this:

**v0.1.x:** Always validated and repaired
```typescript
const profile = new SoilProfile('P001', horizons);
```

**v0.2.0+:** Same behavior, but now configurable
```typescript
// Default: validateDepths=true, autoRepair=true (same as v0.1.x)
const profile = new SoilProfile('P001', horizons);

// Disable validation if your data is already clean
const profile = new SoilProfile('P001', horizons, undefined, {}, [], {
  validateDepths: false,
  autoRepair: false
});

// Or use the shorthand config
const profile = new SoilProfile('P001', horizons, undefined, {}, [], {
  validateDepths: false
});
```

---

## Deprecation Timeline

| Version | Status | Notes |
|---------|--------|-------|
| **v0.1.x** | EOL | Last version with implicit field assumptions |
| **v0.2.0–0.2.x** | Current | Backward-compatible; old APIs still work with warnings in dev |
| **v1.0.0** | Future | Old function wrappers (`parseDelimitedHorizons`, etc.) removed; use classes instead |

**What this means:**
- v0.1.x code **will not work** in v0.2.0 without adding `fieldMapping`
- v0.2.x code **will work in v1.0**, but function wrappers are gone (use classes)
- Existing tests and examples work as-is in v0.2.0

---

## FAQ

### Q: Do I have to update my code?
**A:** Not immediately if you're on v0.1.x. But v0.2.0 requires explicit `fieldMapping`; implicit NASIS names no longer work. Update your parsers when you upgrade.

### Q: Can I disable validation/repair?
**A:** Yes! Pass `validateDepths: false` and/or `autoRepair: false` in the SoilProfile config. Both default to `true` for backward compatibility.

### Q: My data has different column names. What do I do?
**A:** Use `fieldMapping` to map your columns to standard names. Unmapped columns pass through unchanged.

### Q: Will Munsell colors be auto-converted anymore?
**A:** No. In v0.2.0, Munsell fields (hue, value, chroma) are preserved as data. Convert them explicitly using `munsellToHex()` if you need hex color.

### Q: The old function wrappers still work, right?
**A:** Yes, in v0.2.x. They're marked for removal in v1.0. Prefer the class-based API: `new DelimitedParser({...}).parse(csv)` instead of `parseDelimitedHorizons(csv)`.

### Q: Can I mix mapped and unmapped fields?
**A:** Absolutely! Only map the fields you want renamed. Everything else passes through as-is.

### Q: What if I have extra soil properties (bulk_density, ec, etc.)?
**A:** They're now first-class! Just include them in your CSV or JSON, and they'll be available on horizon objects. No special handling needed.

---

## See Also

- [NEWS.md](../NEWS.md) — Release notes for v0.2.0
- [README.md](../README.md) — Full library documentation
- Tests in `tests/parsers.test.ts` — Working examples of fieldMapping usage
