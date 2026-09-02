import { Horizon, SoilProfileConfig } from '../core/types';
import { SoilProfile } from '../core/SoilProfile';
import { mapFieldsAndPassthrough, parseNumeric } from './utils';

export interface DelimitedOptions {
  delimiter?: string;
  hasHeader?: boolean;
}

export interface DelimitedParserConfig extends SoilProfileConfig {
  fieldMapping?: Record<string, string>; // { rawColumnName: targetFieldName }
  delimiter?: string; // default: ','
}

/**
 * DelimitedParser: class-based parser for delimiter-separated horizon data
 * Supports optional fieldMapping config for flexible column-to-field mapping
 */
export class DelimitedParser {
  config: DelimitedParserConfig;

  constructor(config?: DelimitedParserConfig) {
    this.config = { delimiter: ',', ...config };
  }

  /**
   * Parse delimiter-separated horizon data and return Horizon array
   * @param csv Raw delimited string
   * @param dataConfig Optional runtime config override
   * @returns Array of valid Horizon objects
   */
  parse(csv: string, dataConfig?: DelimitedParserConfig): Horizon[] {
    const effectiveConfig = dataConfig ? { ...this.config, ...dataConfig } : this.config;
    const rawRows = this.parseCSV(csv, effectiveConfig);
    const horizons: Horizon[] = [];

    for (const raw of rawRows) {
      const mapped = this.mapFields(raw, effectiveConfig.fieldMapping, effectiveConfig);

      // Extract depth values using configured column names
      const depthTopCol = effectiveConfig.depthTopColumn ?? 'top';
      const depthBottomCol = effectiveConfig.depthBottomColumn ?? 'bottom';
      const top = parseNumeric(raw[depthTopCol]);
      const bottom = parseNumeric(raw[depthBottomCol]);

      // Validate depths
      if (top === undefined || bottom === undefined) {
        const name = mapped.name ?? 'unnamed';
        console.warn(
          `Delimited parser: Skipping row (missing depth): name=${name}, top=${top}, bottom=${bottom}`
        );
        continue;
      }

      if (top >= bottom) {
        const name = mapped.name ?? 'unnamed';
        console.warn(
          `Delimited parser: Skipping row (invalid depth): name=${name}, top=${top}, bottom=${bottom}`
        );
        continue;
      }

      // Validate color
      if (mapped.color === undefined || mapped.color === null || mapped.color === '') {
        const name = mapped.name ?? 'unnamed';
        console.warn(
          `Delimited parser: Skipping row (missing or invalid color): name=${name}`
        );
        continue;
      }

      // Set depths on mapped horizon
      mapped.top = top;
      mapped.bottom = bottom;

      horizons.push(mapped);
    }

    return horizons;
  }

  /**
   * Parse CSV into array of raw row objects (before field mapping)
   */
  private parseCSV(csv: string, config: DelimitedParserConfig): Record<string, any>[] {
    const delimiter = config.delimiter ?? ',';
    const hasHeader = true; // Always expect header for now

    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];

    let headerRow: string[] = [];
    let startIndex = 0;

    // Extract header
    if (hasHeader && lines.length > 0) {
      headerRow = lines[0]
        .split(delimiter)
        .map(cell => cell.trim());
      startIndex = 1;
    }

    const rows: Record<string, any>[] = [];

    // Process data rows
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = line.split(delimiter).map(cell => cell.trim());
      const row: Record<string, any> = {};

      // Map cells to header columns
      for (let j = 0; j < headerRow.length && j < cells.length; j++) {
        row[headerRow[j]] = cells[j];
      }

      rows.push(row);
    }

    return rows;
  }

  /**
   * Map raw row fields to Horizon using optional fieldMapping
   * All unmapped fields pass through as-is to Horizon
   */
  private mapFields(
    raw: Record<string, any>,
    mapping?: Record<string, string>,
    config?: DelimitedParserConfig
  ): Horizon {
    return mapFieldsAndPassthrough(raw, mapping) as Horizon;
  }
}

/**
 * Parse delimiter-separated horizon data and return Horizon array (function wrapper)
 *
 * @param data Raw delimited string
 * @param options Delimiter and header configuration
 * @returns Array of valid Horizon objects
 *
 * Invalid rows (missing/invalid depths or top >= bottom) are skipped with console.warn()
 */
export function parseDelimitedHorizons(data: string, options: DelimitedOptions = {}): Horizon[] {
  const parser = new DelimitedParser({
    delimiter: options.delimiter ?? ',',
  });
  return parser.parse(data);
}

/**
 * Parse delimiter-separated data and create a SoilProfile (function wrapper)
 *
 * @param data Raw delimited string
 * @param profileId Soil profile identifier
 * @param options Delimiter and header configuration
 * @returns SoilProfile instance
 */
export function parseDelimitedProfile(
  data: string,
  profileId: string,
  options: DelimitedOptions = {}
): SoilProfile {
  const horizons = parseDelimitedHorizons(data, options);
  return new SoilProfile(profileId, horizons);
}
