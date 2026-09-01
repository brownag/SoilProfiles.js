// Static SVG rendering (server-safe, no canvas/interactivity)
export * from './core';
export * from './render/annotations';
export {
  renderComparison,
  renderComparisonHTML,
  renderComparisonSVG,
  renderComparisonToDataURL,
} from './render/comparison';
export {
  renderStaticSVG,
  renderStaticToDataURL,
  renderStaticToDOM,
} from './render/static';
export {
  getThematicLegendMetadata,
  renderPhLegendSVG,
  renderTextureLegendSVG,
} from './render/thematicLegends';
