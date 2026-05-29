import { Horizon, PropertyMap } from './types';

/**
 * Maps raw data (e.g., from SSURGO) to a standardized Horizon object using a PropertyMap.
 * 
 * @param raw Raw horizon data object
 * @param map Property mapping (e.g., { clay: 'claytotal_r' })
 * @returns Standardized Horizon object
 */
export function mapToHorizon(raw: any, map: PropertyMap = {}): Horizon {
  return {
    top: Number(raw.hzdept_r ?? raw.top ?? 0),
    bottom: Number(raw.hzdepb_r ?? raw.bottom ?? 10),
    name: String(raw[map.name || 'hzname'] || raw.name || ''),
    color: String(raw.color || '#cccccc'),
    texture: raw.texture,
    metadata: { ...raw },
    
    clay: (raw[map.clay || 'claytotal_r'] ?? raw.clay) ?? undefined,
    sand: (raw[map.sand || 'sandtotal_r'] ?? raw.sand) ?? undefined,
    silt: (raw[map.silt || 'silttotal_r'] ?? raw.silt) ?? undefined,
    ph: (raw[map.ph || 'ph1to1h2o_r'] ?? raw.ph) ?? undefined,
    om: (raw[map.om || 'om_r'] ?? raw.om) ?? undefined,
    ksat: (raw[map.ksat || 'ksat_r'] ?? raw.ksat) ?? undefined
  };
}

/**
 * Common PropertyMaps for various data sources
 */
export const DATA_MAPS = {
  SSURGO: {
    clay: 'claytotal_r',
    sand: 'sandtotal_r',
    silt: 'silttotal_r',
    ph: 'ph1to1h2o_r',
    om: 'om_r',
    ksat: 'ksat_r',
    name: 'hzname'
  }
};
