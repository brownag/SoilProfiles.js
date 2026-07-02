export * from './core/types';
export * from './core/SoilProfile';
export * from './core/SoilProfileCollection';
export * from './core/texture';
export * from './core/phScale';
export * from './core/layout';
export * from './core/colors';
export * from './core/mapping';
export * from './core/tooltipUtils';
export * from './render/static';
export * from './render/interactive';
export * from './render/comparison';
export * from './render/events';
export { renderComparisonSVG } from './render/comparison';
export { renderTextureLegendSVG, renderPhLegendSVG, getThematicLegendMetadata } from './render/thematicLegends';
export type { Render3DCleanup } from './render/three3d';

export function renderInteractive3D(
    container: HTMLElement,
    profiles: import('./core/SoilProfileCollection').SoilProfileCollection,
    options: import('./core/types').InteractiveRenderOptions
): import('./render/three3d').Render3DCleanup {
    const three3d = require('./render/three3d') as typeof import('./render/three3d');
    return three3d.renderInteractive3D(container, profiles, options);
}
