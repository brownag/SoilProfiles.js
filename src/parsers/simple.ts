import { Horizon, SimpleParserConfig } from '../core/types';
import { SoilProfile } from '../core/SoilProfile';
import { mapFieldsAndPassthrough, parseNumeric } from './utils';

/**
 * Simple horizon data parser with optional field mapping.
 * Accepts custom fieldMapping config for flexible column name mapping.
 * All fields are treated as first-class properties (no extra demotion).
 */
export class SimpleParser {
  /**
   * Parse array of raw horizon data with optional field mapping config.
   * @param data Array of raw horizon objects
   * @param config Optional config with fieldMapping
   * @returns Array of mapped Horizon objects
   */
  parse(data: any[], config?: SimpleParserConfig): Horizon[] {
    const horizons: Horizon[] = [];

    for (let i = 0; i < data.length; i++) {
      const raw = data[i];

      // Validate horizon is an object
      if (!raw || typeof raw !== 'object') {
        console.warn(`Horizon ${i}: skipped (not an object)`);
        continue;
      }

      const mapped = this.mapFields(raw, config);
      if (mapped) {
        horizons.push(mapped);
      }
    }

    return horizons;
  }

  /**
   * Map raw horizon object to Horizon with optional field mapping.
   * @param raw Raw horizon object
   * @param config Optional config with fieldMapping and depth column names
   * @returns Mapped Horizon, or null if invalid
   */
  private mapFields(raw: Record<string, any>, config?: SimpleParserConfig): Horizon | null {
    const topCol = config?.depthTopColumn ?? 'top';
    const bottomCol = config?.depthBottomColumn ?? 'bottom';
    const mapping = config?.fieldMapping;

    // Parse depth fields
    const top = parseNumeric(raw[topCol]);
    const bottom = parseNumeric(raw[bottomCol]);

    if (top === undefined || bottom === undefined) {
      console.warn(`Horizon: skipped (invalid or missing depth fields)`);
      return null;
    }

    if (top >= bottom) {
      console.warn(`Horizon: skipped (top >= bottom: ${top} >= ${bottom})`);
      return null;
    }

    const mapped = mapFieldsAndPassthrough(raw, mapping);
    mapped.top = top;
    mapped.bottom = bottom;

    return mapped as Horizon;
  }
}

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

  const parser = new SimpleParser();
  const parsedHorizons = parser.parse(data.horizons);

  const validHorizons: Horizon[] = [];

  // Validate name and color for each parsed horizon
  for (let i = 0; i < parsedHorizons.length; i++) {
    const h = parsedHorizons[i];

    if (!h.name || typeof h.name !== 'string') {
      console.warn(`Horizon ${i}: skipped (missing or invalid name)`);
      continue;
    }

    if (h.color === undefined || h.color === null || typeof h.color !== 'string') {
      console.warn(`Horizon ${i}: skipped (missing or invalid color)`);
      continue;
    }

    validHorizons.push(h);
  }

  // Create and return SoilProfile
  return new SoilProfile(data.id, validHorizons);
}
