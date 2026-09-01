import { Horizon } from '../core/types';
import { SoilProfile } from '../core/SoilProfile';
import { assignOptionalNumericFields, parseNumeric } from './utils';

/**
 * Parse simple JSON format with minimal required fields.
 * Input format:
 * {
 *   "id": "PROFILE_ID",
 *   "horizons": [
 *     { "name": "A", "top": 0, "bottom": 20, "color": "#8B7355" },
 *     { "name": "B", "top": 20, "bottom": 50, "color": "#A0826D", "clay": 35 }
 *   ]
 * }
 *
 * Required fields per profile: id, horizons array
 * Required fields per horizon: name, top, bottom, color
 * Optional fields per horizon: texture, clay, sand, silt, ph, om, ksat, munsellHue, munsellValue, munsellChroma
 *
 * @param data Raw input data (any type)
 * @returns SoilProfile instance with validated horizons
 * @throws Error if id or horizons array is missing
 */
export function parseSimpleJson(data: any): SoilProfile {
  // Validate id
  if (!data || !data.id || typeof data.id !== 'string') {
    throw new Error('id is required and must be a string');
  }

  // Validate horizons array
  if (!Array.isArray(data.horizons)) {
    throw new Error('horizons array is required');
  }

  const validHorizons: Horizon[] = [];

  // Process each horizon
  for (let i = 0; i < data.horizons.length; i++) {
    const h = data.horizons[i];

    // Validate required fields exist
    if (!h || typeof h !== 'object') {
      console.warn(`Horizon ${i}: skipped (not an object)`);
      continue;
    }

    if (!h.name || typeof h.name !== 'string') {
      console.warn(`Horizon ${i}: skipped (missing or invalid name)`);
      continue;
    }

    if (h.color === undefined || h.color === null || typeof h.color !== 'string') {
      console.warn(`Horizon ${i}: skipped (missing or invalid color)`);
      continue;
    }

    // Coerce top and bottom to numbers
    const top = Number(h.top);
    const bottom = Number(h.bottom);

    // Validate numeric fields
    if (isNaN(top) || isNaN(bottom)) {
      console.warn(`Horizon ${i} (${h.name}): skipped (invalid top or bottom depth)`);
      continue;
    }

    // Validate depth logic
    if (top >= bottom) {
      console.warn(`Horizon ${i} (${h.name}): skipped (top >= bottom: ${top} >= ${bottom})`);
      continue;
    }

    // Build horizon object
    const horizon: Horizon = {
      name: h.name,
      top,
      bottom,
      color: h.color,
    };

    // Add optional fields if present
    if (h.texture !== undefined && h.texture !== null) {
      horizon.texture = String(h.texture);
    }

    // Assign optional numeric fields
    assignOptionalNumericFields(
      horizon,
      h,
      ['clay', 'sand', 'silt', 'ph', 'om', 'ksat', 'munsellValue', 'munsellChroma'],
      parseNumeric
    );

    if (h.munsellHue !== undefined && h.munsellHue !== null) {
      horizon.munsellHue = String(h.munsellHue);
    }

    // Capture unknown fields in extra
    const knownFields = new Set([
      'name', 'top', 'bottom', 'color', 'texture',
      'clay', 'sand', 'silt', 'ph', 'om', 'ksat',
      'munsellHue', 'munsellValue', 'munsellChroma'
    ]);
    for (const key in h) {
      if (!knownFields.has(key)) {
        if (!horizon.extra) horizon.extra = {};
        horizon.extra[key] = h[key];
      }
    }

    validHorizons.push(horizon);
  }

  // Create and return SoilProfile
  return new SoilProfile(data.id, validHorizons);
}
