import { Horizon } from '../core/types';
import { SoilProfile } from '../core/SoilProfile';
import { parseNumeric, assignOptionalNumericFields } from './utils';

export interface DelimitedOptions {
  delimiter?: string;
  hasHeader?: boolean;
}

/**
 * Map of common NASIS field names to Horizon properties
 */
const NASIS_ALIASES: Record<string, string> = {
  hzname: 'name',
  hzdept_r: 'top',
  hzdepb_r: 'bottom',
  claytotal_r: 'clay',
  sandtotal_r: 'sand',
  silttotal_r: 'silt',
  ph1to1h2o_r: 'ph',
  om_r: 'om',
  ksat_r: 'ksat',
  moist_hue: 'munsellHue',
  moist_value: 'munsellValue',
  moist_chroma: 'munsellChroma',
};

/**
 * Resolve field name: check alias map first, then use as-is
 */
function resolveFieldName(columnName: string): string {
  return NASIS_ALIASES[columnName] || columnName;
}

/**
 * Parse delimiter-separated horizon data and return Horizon array
 *
 * @param data Raw delimited string
 * @param options Delimiter and header configuration
 * @returns Array of valid Horizon objects
 *
 * Invalid rows (missing/invalid depths or top >= bottom) are skipped with console.warn()
 */
export function parseDelimitedHorizons(data: string, options: DelimitedOptions = {}): Horizon[] {
  const delimiter = options.delimiter ?? ',';
  const hasHeader = options.hasHeader ?? true;

  const lines = data.trim().split('\n');
  if (lines.length === 0) return [];

  let headerRow: string[] = [];
  let startIndex = 0;

  // Extract header if hasHeader=true
  if (hasHeader && lines.length > 0) {
    headerRow = lines[0]
      .split(delimiter)
      .map(cell => cell.trim());
    startIndex = 1;
  }

  const horizons: Horizon[] = [];

  // Process data rows
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const cells = line.split(delimiter).map(cell => cell.trim());

    // Build row object
    const row: Record<string, any> = {};

    if (hasHeader) {
      // Map cells to header columns
      for (let j = 0; j < headerRow.length && j < cells.length; j++) {
        const colName = resolveFieldName(headerRow[j]);
        row[colName] = cells[j];
      }
    } else {
      // Treat as unnamed columns
      for (let j = 0; j < cells.length; j++) {
        row[`col_${j}`] = cells[j];
      }
    }

    // Parse top and bottom depths
    const top = parseNumeric(row.top);
    const bottom = parseNumeric(row.bottom);

    // Validate depths
    if (top === undefined || bottom === undefined) {
      const name = row.name ?? 'unnamed';
      console.warn(
        `Delimited parser: Skipping row (missing depth): name=${name}, top=${top}, bottom=${bottom}`
      );
      continue;
    }

    if (top >= bottom) {
      const name = row.name ?? 'unnamed';
      console.warn(
        `Delimited parser: Skipping row (invalid depth): name=${name}, top=${top}, bottom=${bottom}`
      );
      continue;
    }

    // Validate color
    if (row.color === undefined || row.color === null || row.color === '') {
      const name = row.name ?? 'unnamed';
      console.warn(
        `Delimited parser: Skipping row (missing or invalid color): name=${name}`
      );
      continue;
    }

    // Build Horizon object
    const horizon: Horizon = {
      name: String(row.name ?? 'Unknown'),
      top,
      bottom,
      color: String(row.color),
    };

    // Add optional string field
    if (row.texture !== undefined && row.texture !== null) {
      horizon.texture = String(row.texture);
    }

    // Add optional numeric fields
    assignOptionalNumericFields(
      horizon,
      row,
      ['clay', 'sand', 'silt', 'ph', 'om', 'ksat', 'munsellValue', 'munsellChroma'],
      parseNumeric
    );

    // Add optional string fields
    if (row.munsellHue !== undefined && row.munsellHue !== null) {
      horizon.munsellHue = String(row.munsellHue);
    }

    // Capture unknown fields in extra
    const knownFields = new Set([
      'name', 'top', 'bottom', 'color', 'texture',
      'clay', 'sand', 'silt', 'ph', 'om', 'ksat',
      'munsellHue', 'munsellValue', 'munsellChroma'
    ]);
    for (const key in row) {
      if (!knownFields.has(key)) {
        if (!horizon.extra) horizon.extra = {};
        horizon.extra[key] = row[key];
      }
    }

    horizons.push(horizon);
  }

  return horizons;
}

/**
 * Parse delimiter-separated data and create a SoilProfile
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
