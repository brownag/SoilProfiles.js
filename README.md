# SoilProfiles.js

A comprehensive TypeScript library for managing and rendering soil profile data in the browser or Node.js. Inspired by the R `aqp` package and the Python `soilprofilecollection` package.

## Features
- **Data Structures**: `SoilProfile` and `SoilProfileCollection` classes for managing horizons with depth tracking, color attribution, and validation.
- **Static SVG Rendering**: Generate high-quality SVG visualizations of soil profiles with customizable dimensions and styling.
- **Interactive 2D Rendering**: Render horizontally or vertically aligned soil profiles on an HTML Canvas with:
  - Depth-scaled horizon visualization
  - Interactive hover tooltips showing horizon metadata (name, depth, texture, color)
  - Centered alignment option for better visual comparison
  - Annotation support for adding custom labels and notes
- **Comparison Rendering**: Visualize multiple soil profiles side-by-side for easy comparison in both static and interactive modes.
- **Thematic Legends**: Generate texture and pH scale legends to accompany soil profile visualizations.
- **3D Rendering**: Optional Three.js-based 3D visualization with basic extrusions via the `soilprofiles/three3d` entry point.
- **Soil Properties**: Built-in support for soil color codes, texture classification, and pH scale representation.

## Installation

```bash
npm install soilprofiles
```

*(Note: `three` is an optional peer dependency for 3D functionality. Install it only if you import from `soilprofiles/three3d`.)*
```bash
npm install three
```

## Bundle Sizes

| Bundle | Size | Gzipped |
|--------|------|---------|
| `dist/index.js` (CommonJS) | 2.5 KB | 0.7 KB |
| `dist/index.esm.js` (ESM) | 77.9 KB | 16.8 KB |
| `dist/index.umd.js` (UMD) | 84.0 KB | 17.5 KB |
| `dist/index.umd.min.js` (minified) | 40.4 KB | 13.6 KB |

**Which format to use:**
- **Node.js/CommonJS**: `dist/index.js`
- **Modern bundlers** (Vite, webpack, esbuild): `dist/index.esm.js`
- **Browser `<script>`**: `dist/index.umd.min.js` (production)

**Lightweight entry points** (modular imports):
- `soilprofiles/core` — Data structures only
- `soilprofiles/static` — SVG rendering
- `soilprofiles/interactive` — Canvas/2D rendering

## Quick Start

### Create a Soil Profile

```typescript
import { SoilProfile, SoilProfileCollection, renderStaticSVG } from 'soilprofiles';

const profile = new SoilProfile('P001', [
  { top: 0, bottom: 20, name: 'A', color: '#3b2f2f', texture: 'loam' },
  { top: 20, bottom: 50, name: 'Bw', color: '#8b5a2b', texture: 'clay loam' },
  { top: 50, bottom: 100, name: 'C', color: '#a0a0a0', texture: 'sandy loam' }
]);

const collection = new SoilProfileCollection([profile]);
```

### Static SVG Rendering

```typescript
const svgString = renderStaticSVG(collection, {
  width: 300,
  height: 600,
  format: 'svg'
});

// Write to file or display in DOM
document.getElementById('profile-container').innerHTML = svgString;
```

### Interactive 2D Rendering (Browser Only)

```typescript
import { renderInteractive2D } from 'soilprofiles';

const container = document.getElementById('profile-canvas');
renderInteractive2D(container, collection, {
  interactive: true,
  arrangement: 'centered',  // 'centered', '2d', or other arrangements
  width: 800,
  height: 600
});
```

The interactive renderer provides:
- **Hover Tooltips**: Display horizon details on mouse over
- **Multiple Arrangements**: Center-aligned, grid-based, or custom layouts
- **Responsive Canvas**: Automatically scales to container size

### Comparing Multiple Profiles

```typescript
import { renderComparisonSVG } from 'soilprofiles';

const comparison = renderComparisonSVG(collection, {
  width: 900,
  height: 600,
  profilesPerRow: 3
});

document.getElementById('comparison').innerHTML = comparison;
```

### Adding Annotations

```typescript
import { renderInteractive2D } from 'soilprofiles';

renderInteractive2D(container, collection, {
  interactive: true,
  annotations: [
    { profileId: 'P001', depth: 25, label: 'Diagnostic horizon', color: '#ff6b6b' }
  ]
});
```

### Rendering Legends

```typescript
import { renderTextureLegendSVG, renderPhLegendSVG } from 'soilprofiles';

// Soil texture classification legend
const textureLegend = renderTextureLegendSVG({ width: 300, height: 200 });

// pH scale legend
const phLegend = renderPhLegendSVG({ width: 300, height: 100 });

document.getElementById('legends').innerHTML = textureLegend + phLegend;
```

## Data Input Formats

SoilProfiles.js supports multiple input formats for soil profile data.

### Parser Imports

Each parser can be imported directly from its subpath:

```typescript
import { parseOSDJson } from 'soilprofiles/parsers/osd';
import { parseSimpleJson } from 'soilprofiles/parsers/simple';
import { parseDelimitedProfile } from 'soilprofiles/parsers/delimited';
```

### OSD JSON (SoilKnowledgeBase Format)

The OSD JSON format is used by the USDA Soil Knowledge Base and includes soil series information with detailed horizon data including Munsell color notation.

```json
{
  "SERIES": "PAXTON",
  "HORIZONS": [
    {
      "name": "A",
      "top": 0,
      "bottom": 20,
      "moist_hue": "10YR",
      "moist_value": 3,
      "moist_chroma": 2,
      "texture_class": "sandy loam"
    },
    {
      "name": "Bw",
      "top": 20,
      "bottom": 50,
      "moist_hue": "10YR",
      "moist_value": 4,
      "moist_chroma": 4,
      "texture_class": "sandy loam"
    },
    {
      "name": "C",
      "top": 50,
      "bottom": 100,
      "moist_hue": "2.5Y",
      "moist_value": 6,
      "moist_chroma": 2,
      "texture_class": "sandy loam"
    }
  ]
}
```

**Usage:**
```typescript
import { parseOSDJson } from 'soilprofiles/parsers/osd';

const profile = parseOSDJson(osdDocument);
```

### Simple JSON (Programmatic Format)

The simple JSON format is designed for programmatic input with minimal required fields: profile `id`, and a `horizons` array where each horizon requires `name`, `top`, `bottom`, and `color` (as hex string).

```json
{
  "id": "PROFILE_001",
  "horizons": [
    {
      "name": "A",
      "top": 0,
      "bottom": 20,
      "color": "#3b2f2f",
      "texture": "loam"
    },
    {
      "name": "Bw",
      "top": 20,
      "bottom": 50,
      "color": "#8b5a2b",
      "texture": "clay loam"
    },
    {
      "name": "C",
      "top": 50,
      "bottom": 100,
      "color": "#a0a0a0",
      "texture": "sandy loam"
    }
  ]
}
```

**Usage:**
```typescript
import { parseSimpleJson } from 'soilprofiles/parsers/simple';

const profile = parseSimpleJson(jsonData);
```

### Delimiter-Separated Values (CSV/Pipe/Tab)

Delimiter-separated format supports CSV, pipe-delimited (`|`), or tab-delimited data with configurable options. Each row represents a horizon with required columns: `name`, `top`, `bottom`, and `color`.

```csv
name,top,bottom,color
A,0,20,#3b2f2f
Bw,20,50,#8b5a2b
C,50,100,#a0a0a0
```

**Usage:**
```typescript
import { parseDelimitedProfile } from 'soilprofiles/parsers/delimited';

// CSV (comma-delimited)
const profile = parseDelimitedProfile(csvString, 'PROFILE_ID', { delimiter: ',' });

// Pipe-delimited
const profilePipe = parseDelimitedProfile(pipeString, 'PROFILE_ID', { delimiter: '|' });

// Tab-delimited
const profileTab = parseDelimitedProfile(tabString, 'PROFILE_ID', { delimiter: '\t' });
```

### Extensible Fields

All parsers support custom, extensible fields:

**OSD Parser**: Additional OSD fields (those not explicitly processed) are automatically captured in `horizon.metadata`:

```typescript
const profile = parseOSDJson({
  SERIES: "PAXTON",
  HORIZONS: [
    {
      name: "A",
      top: 0,
      bottom: 20,
      moist_hue: "10YR",
      moist_value: 3,
      moist_chroma: 2,
      texture_class: "loam",
      custom_field: "custom_value"  // Stored in horizon.metadata
    }
  ]
});

console.log(profile.horizons[0].metadata?.custom_field); // "custom_value"
```

**Simple JSON & Delimited Parsers**: Unknown fields are captured in `horizon.extra`:

```typescript
const profile = parseSimpleJson({
  id: "PROFILE_001",
  horizons: [
    {
      name: "A",
      top: 0,
      bottom: 20,
      color: "#3b2f2f",
      customProperty: "value"  // Stored in horizon.extra
    }
  ]
});

console.log(profile.horizons[0].extra?.customProperty); // "value"
```

All parsers automatically parse numeric fields when provided:
- `clay`, `sand`, `silt` — soil texture fractions (%)
- `ph` — soil pH (1:1 water)
- `om` — organic matter (%)
- `ksat` — saturated hydraulic conductivity
- `munsellValue`, `munsellChroma` — color components

## 3D Visualization

The library includes optional Three.js-based 3D rendering for soil profiles:

```typescript
import { renderInteractive3D } from 'soilprofiles/three3d';

const cleanup = renderInteractive3D(container, collection, {
  interactive: true,
  arrangement: '3d',
  width: 800,
  height: 600
});

// Clean up WebGL resources when done
cleanup();
```

**Future Extensions**: The 3D rendering can be extended to export geometries to GeoJSON or 3D Tiles formats for integration with MapLibre GL JS or similar mapping libraries.

## API Reference

### Core Classes

#### `SoilProfile`
Represents a single soil profile with horizons.

```typescript
const profile = new SoilProfile(id: string, horizons: Horizon[]);
```

#### `SoilProfileCollection`
Manages a collection of soil profiles for grouped rendering and analysis.

```typescript
const collection = new SoilProfileCollection(profiles: SoilProfile[]);
```

### Munsell Color Support

The library provides conversion functions to translate Munsell colors into hex values:
- **Standard Hues**: Supports standard hues (e.g., `"10YR"`, `"5R"`, `"2.5Y"`).
- **Neutral Hues (Gray Shades)**: Fully supports neutral hues represented by `"N"`.
  - Accepts formats like `"N 2/0"`, `"N 2/"`, or `"N 2/-"`.
  - Missing, empty, or dash (`"-"`) chroma values for neutral hues default to `0`, producing pure shades of gray.
  - Supports decimal values (e.g., `"N 2.5/"` or `"N 10/"` for near-white).

### Rendering Functions

- **`renderStaticSVG()`**: Generate SVG strings for static rendering
- **`renderInteractive2D()`**: Render interactive 2D visualization on Canvas
- **`renderComparisonSVG()`**: Compare multiple profiles side-by-side
- **`renderInteractive3D()`**: Render 3D visualization (requires Three.js)
- **`renderTextureLegendSVG()`**: Generate texture classification legend
- **`renderPhLegendSVG()`**: Generate pH scale legend

## Examples

### Demo Application

The repository includes a SoilKnowledgeBase demo that fetches real USDA Soil Survey OSD data:

```bash
npm run build
npm run demo:web
```

Then open: `http://localhost:4173/examples/soilknowledgebase-demo.html`

The demo includes soil profiles for:
- PAXTON
- MONTAUK
- WOODBRIDGE
- RIDGEBURY
- WHITMAN
- CATDEN

## Development

### Scripts

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to JavaScript
npm test             # Run test suite
npm run demo:web     # Start web demo server
```

### Makefile

Core workflows are also available via `make`:

```bash
make install         # Install npm dependencies
make check           # Run type checking and tests
make build           # Build the library
make demo            # Start the demo server
```

## Browser Compatibility

- **Static Rendering**: Works in all modern browsers (outputs SVG strings)
- **Interactive 2D**: Requires HTML5 Canvas support
- **3D Rendering**: Requires WebGL support (via Three.js)

## License

MIT

## Contributing

Contributions are welcome! Please ensure all tests pass and follow the existing code style.

## Related Projects

- [aqp](https://github.com/ncss-tech/aqp) - R package for soil profile data
- [soilprofilecollection](https://github.com/brownag/soilprofilecollection) - Python package for soil profile data
- [Three.js](https://threejs.org/) - 3D JavaScript library
