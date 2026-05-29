import { Horizon } from './types';

/**
 * Classifies soil texture based on clay and sand percentages using USDA logic.
 * @param horizon Horizon data containing clay and sand
 * @returns USDA texture class string, or null if data is missing
 */
export function classifyTexture(horizon: Partial<Horizon>): string | null {
  const clay = horizon.clay;
  const sand = horizon.sand;
  
  if (clay === undefined || sand === undefined) return null;

  const silt = horizon.silt ?? (100 - clay - sand);

  // USDA soil texture classification logic
  if (clay < 8 && sand > 85) return 'sand';
  if (clay < 8 && sand > 50) return 'loamy_sand';
  if (clay < 8 && silt > 50) return 'silt';
  if (clay >= 27) return 'clay';
  if (clay >= 20 && clay < 27) return 'clay_loam';
  if (clay >= 20 && sand > 45) return 'sandy_clay';
  if (silt >= 50 && clay >= 12 && clay < 27) return 'silty_clay_loam';
  if (silt >= 50 && clay < 12) return 'silt_loam';
  if (clay >= 7 && clay < 20 && sand > 52) return 'sandy_loam';
  
  return 'loam'; // fallback
}

/**
 * Returns a hex color string for a given USDA texture class.
 * @param textureClass USDA texture class (e.g., 'sand', 'clay') or null
 * @returns Hex color string
 */
export function getTextureColor(textureClass: string | null): string {
  if (!textureClass) return '#9ca3af'; // Neutral gray for missing texture (e.g. bedrock)
  const colors: Record<string, string> = {
    sand: '#e8f4f8',
    loamy_sand: '#d4e8f0',
    sandy_loam: '#c0dce8',
    loam: '#acd0e0',
    silt_loam: '#98c4d8',
    silt: '#84b8d0',
    sandy_clay: '#7091b3',
    clay_loam: '#5c7a96',
    silty_clay_loam: '#486379',
    clay: '#34495e'
  };
  return colors[textureClass] ?? '#9ca3af';
}
