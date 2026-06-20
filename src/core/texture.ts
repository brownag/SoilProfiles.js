import { Horizon } from './types';

/**
 * Classifies soil texture based on sand, silt, and clay percentages using USDA texture triangle.
 * Implements the official USDA soil texture classification scheme using the same logic as
 * the AQP R package's ssc_to_texcl() function, which follows NASIS particle size estimator logic.
 *
 * Reference: https://github.com/ncss-tech/aqp/blob/master/R/texture.R (lines 306-320)
 *
 * @param horizon Horizon data containing clay and sand (silt is calculated if not provided)
 * @returns USDA texture class code (si, sil, sicl, sic, c, cl, l, scl, sc, s, ls, sl) or null
 */
export function classifyTexture(horizon: Partial<Horizon>): string | null {
  const clay = horizon.clay;
  const sand = horizon.sand;

  if (clay === undefined || sand === undefined) return null;

  const silt = horizon.silt ?? (100 - clay - sand);

  // Apply NASIS particle size estimator logic (same as AQP ssc_to_texcl)
  // Check conditions in order; first match wins. Thresholds match NASIS/AQP exactly.

  // Silt (si): silt >= 80% and clay < 12%
  if (silt >= 79.99 && clay < 11.99) return 'si';

  // Silt loam (sil): silt >= 50% and clay < 27% and (silt < 80% or clay >= 12%)
  if (silt >= 49.99 && clay < 26.99 && (silt < 79.99 || clay >= 11.99))
    return 'sil';

  // Silty clay loam (sicl): clay 27-40% and sand <= 20%
  if (clay >= 26.99 && clay < 39.99 && sand <= 20.01) return 'sicl';

  // Silty clay (sic): clay >= 40% and silt >= 40%
  if (clay >= 39.99 && silt >= 39.99) return 'sic';

  // Clay (c): clay >= 40% and sand <= 45% and silt < 40%
  if (clay >= 39.99 && sand <= 45.01 && silt < 39.99) return 'c';

  // Clay loam (cl): clay 27-40% and sand > 20% and sand <= 45%
  if (clay >= 26.99 && clay < 39.99 && sand > 20.01 && sand <= 45.01)
    return 'cl';

  // Loam (l): clay 7-27% and silt 28-50% and sand <= 52%
  if (clay >= 6.99 && clay < 26.99 && silt >= 27.99 && silt < 49.99 && sand <= 52.01)
    return 'l';

  // Sandy clay loam (scl): clay 20-35% and silt < 28% and sand > 45%
  if (clay >= 19.99 && clay < 34.99 && silt < 27.99 && sand > 45.01)
    return 'scl';

  // Sandy clay (sc): clay >= 35% and sand > 45%
  if (clay >= 34.99 && sand > 45.01) return 'sc';

  // Sand (s): (silt + 1.5*clay) < 15
  if (silt + 1.5 * clay < 15) return 's';

  // Loamy sand (ls): (silt + 1.5*clay) >= 15 and (silt + 2*clay) < 30
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 29.99) return 'ls';

  // Sandy loam (sl): default for anything not caught above
  if (!isNaN(sand) && !isNaN(clay)) return 'sl';

  return null;
}

/**
 * Converts a USDA texture class code to a human-readable name.
 * @param textureCode USDA texture class code (e.g., 's', 'cl')
 * @returns Human-readable texture class name (e.g., 'sand', 'clay loam')
 */
export function textureCodeToName(textureCode: string | null): string {
  if (!textureCode) return 'Unknown';
  const names: Record<string, string> = {
    s: 'sand',
    ls: 'loamy sand',
    sl: 'sandy loam',
    l: 'loam',
    sil: 'silt loam',
    si: 'silt',
    scl: 'sandy clay loam',
    sc: 'sandy clay',
    cl: 'clay loam',
    sicl: 'silty clay loam',
    sic: 'silty clay',
    c: 'clay'
  };
  return names[textureCode] ?? textureCode;
}

/**
 * Returns a hex color string for a given USDA texture class.
 * @param textureClass USDA texture class code (e.g., 's', 'c') or null
 * @returns Hex color string
 */
export function getTextureColor(textureClass: string | null): string {
  if (!textureClass) return '#9ca3af'; // Neutral gray for missing texture (e.g. bedrock)
  const colors: Record<string, string> = {
    s: '#e8f4f8',           // sand
    ls: '#d4e8f0',          // loamy sand
    sl: '#c0dce8',          // sandy loam
    l: '#acd0e0',           // loam
    sil: '#98c4d8',         // silt loam
    si: '#84b8d0',          // silt
    scl: '#7eb3cc',         // sandy clay loam
    sc: '#7091b3',          // sandy clay
    cl: '#5c7a96',          // clay loam
    sicl: '#486379',        // silty clay loam
    sic: '#3d5a7f',         // silty clay
    c: '#34495e'            // clay
  };
  return colors[textureClass] ?? '#9ca3af';
}
