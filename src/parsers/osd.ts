import { SoilProfile } from '../core/SoilProfile';
import { Horizon, SoilProfileConfig } from '../core/types';
import { mapFieldsAndPassthrough, parseNumeric } from './utils';

/**
 * OSDParser config extends SoilProfileConfig with optional field mapping
 */
export interface OSDParserConfig extends SoilProfileConfig {
  fieldMapping?: Record<string, string>;
}

/**
 * OSD JSON parser with optional field mapping
 */
export class OSDParser {
  constructor(private config?: OSDParserConfig) {}

  /**
   * Parse raw horizons array into Horizon objects
   * @param rawHorizons Array of raw horizon objects
   * @param config Optional config (overrides constructor config)
   * @returns Array of Horizon objects
   */
  parse(rawHorizons: any[], config?: OSDParserConfig): Horizon[] {
    const cfg = config ?? this.config;
    return rawHorizons
      .map(raw => this.mapHorizon(raw, cfg))
      .filter((h): h is Horizon => h !== undefined);
  }

  /**
   * Map a single raw horizon to Horizon object
   * @param raw Raw horizon data
   * @param config Optional config or field mapping
   * @returns Horizon object or undefined if invalid
   */
  private mapHorizon(raw: Record<string, any>, config?: OSDParserConfig): Horizon | undefined {
    if (!raw || typeof raw !== 'object') {
      return undefined;
    }

    const cfg = config ?? this.config;
    const depthTopCol = cfg?.depthTopColumn ?? 'top';
    const depthBottomCol = cfg?.depthBottomColumn ?? 'bottom';
    const mapping = cfg?.fieldMapping;

    const top = parseNumeric(raw[depthTopCol]);
    const bottom = parseNumeric(raw[depthBottomCol]);

    if (top === undefined || bottom === undefined || top >= bottom) {
      return undefined;
    }

    const mapped = mapFieldsAndPassthrough(raw, mapping) as Horizon;

    // Explicitly set depths
    mapped.top = top;
    mapped.bottom = bottom;

    // Texture fallback: if texture is undefined and texture_class is present, map texture = texture_class
    if (mapped.texture === undefined && (mapped as any).texture_class !== undefined) {
      mapped.texture = (mapped as any).texture_class;
    }

    return mapped;
  }
}

/**
 * Parse OSD JSON document (from SoilKnowledgeBase) into a SoilProfile
 *
 * @param doc OSD document with SERIES name and HORIZONS array
 * @returns SoilProfile instance
 *
 * Invalid horizons (missing/invalid depths) are skipped with console.warn()
 * Munsell conversion is NOT automatic; user can call munsellToHex() separately if needed
 */
export function parseOSDJson(doc: any): SoilProfile {
  const seriesName = doc?.SERIES ?? 'Unknown';
  const rawHorizons = doc?.HORIZONS ?? [];

  if (!Array.isArray(rawHorizons)) {
    console.warn(`OSD parser: HORIZONS is not an array for series "${seriesName}"`);
    return new SoilProfile(seriesName, []);
  }

  const parser = new OSDParser();
  const horizons: Horizon[] = [];

  for (const raw of rawHorizons) {
    const horizon = parser.parse([raw])?.[0];
    if (horizon) {
      horizons.push(horizon);
    } else {
      const name = raw?.name ?? 'unnamed';
      const top = parseNumeric(raw?.top) ?? NaN;
      const bottom = parseNumeric(raw?.bottom) ?? NaN;
      console.warn(
        `OSD parser: Skipping horizon "${name}" (invalid depth: top=${top}, bottom=${bottom})`
      );
    }
  }

  if (horizons.length === 0) {
    console.warn(`OSD parser: No valid horizons for series "${seriesName}"`);
  }

  return new SoilProfile(seriesName, horizons);
}
