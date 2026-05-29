# soil-profile-ts

A minimum viable product (MVP) TypeScript library for managing and rendering soil profile data in the browser or Node.js. Inspired by the R `aqp` package and the Python `soilprofilecollection` package.

## Features
- **Data Structures**: `SoilProfile` and `SoilProfileCollection` classes for managing horizons with depth tracking and validation.
- **Static Rendering**: Generate SVG strings of soil profiles.
- **Interactive 2D Rendering**: Render horizontally aligned, depth-scaled profiles on an HTML Canvas with a hover tooltip showing horizon metadata.
- **Stubbed 3D Rendering**: Optional basic extrusions in Three.js via the `soilprofiles/three3d` entry point.

## Installation

```bash
npm install soilprofiles
```

*(Note: `three` is an optional peer dependency for 3D functionality. Install it only if you import from `soilprofiles/three3d`.)*
```bash
npm install three
```

## Basic Usage

```typescript
import { SoilProfileCollection, SoilProfile, renderStaticSVG } from 'soilprofiles';

const p1 = new SoilProfile('P001', [
  { top: 0, bottom: 20, name: 'A', color: '#3b2f2f', texture: 'loam' },
  { top: 20, bottom: 50, name: 'Bw', color: '#8b5a2b', texture: 'clay loam' }
]);

const collection = new SoilProfileCollection([p1]);

// 1. Static output
const svgStr = renderStaticSVG(collection, { width: 300, height: 600, format: 'svg' });
console.log(svgStr);

// 2. Interactive DOM output
// import { renderInteractive2D } from 'soilprofiles';
// const container = document.getElementById('my-div');
// renderInteractive2D(container, collection, { interactive: true, arrangement: '2d' });
```

## Optional 3D Usage

```typescript
import { renderInteractive3D } from 'soilprofiles/three3d';

const cleanup = renderInteractive3D(container, collection, {
  interactive: true,
  arrangement: '3d'
});

// Stop animation and release WebGL resources when removing the viewer.
cleanup();
```

## Future MapLibre 3D Integration
The `renderInteractive3D` logic currently uses basic `Three.js` box extrusions from `soilprofiles/three3d`. Future extensions can be applied to export these geometries into GeoJSON or 3D Tiles compliant formats for overlay onto a `MapLibre GL JS` scene or similar map container.

## SoilKnowledgeBase demo page

The repository includes a browser demo that fetches real OSD JSON documents from SoilKnowledgeBase for:
`PAXTON`, `MONTAUK`, `WOODBRIDGE`, `RIDGEBURY`, `WHITMAN`, and `CATDEN`.

```bash
npm run build
npm run demo:web
```

Then open: `http://localhost:4173/examples/soilknowledgebase-demo.html`

## Makefile workflows

Core local workflows are also exposed via `make`:

```bash
make install
make check
make demo
```
