import { Horizon } from '../core/types';

/**
 * Parse numeric value, return undefined if NaN or invalid.
 * Handles undefined, null, empty strings, and non-finite numbers.
 * @param value Raw input value (any type)
 * @returns Parsed number, or undefined if invalid
 */
export function parseNumeric(value: any): number | undefined {
  if (value === undefined || value === null || value === '' || typeof value === 'boolean') return undefined;
  if (typeof value === 'object') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Assign optional numeric fields to a horizon object.
 * Iterates over field names, parses each value using the provided parse function,
 * and assigns to the horizon if the parsed value is defined.
 *
 * @param horizon Horizon object to assign fields to
 * @param source Source object containing field values
 * @param fields List of field names to process
 * @param parseFunc Function to parse values (e.g., parseNumeric)
 */
export function assignOptionalNumericFields(
  horizon: Horizon,
  source: Record<string, any>,
  fields: string[],
  parseFunc: (value: any) => number | undefined
): void {
  for (const field of fields) {
    const parsed = parseFunc(source[field]);
    if (parsed !== undefined) {
      (horizon as any)[field] = parsed;
    }
  }
}

/**
 * Map raw record fields to target field names and pass through unmapped fields.
 * Coerces numeric strings using parseNumeric() where applicable.
 *
 * @param raw Raw input record
 * @param mapping Optional dictionary of sourceFieldName -> targetFieldName
 * @returns Mapped record with unmapped fields preserved
 */
export function mapFieldsAndPassthrough(
  raw: Record<string, any>,
  mapping?: Record<string, string>
): Record<string, any> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const result: Record<string, any> = {};

  if (mapping) {
    for (const [sourceKey, targetKey] of Object.entries(mapping)) {
      if (raw[sourceKey] !== undefined) {
        result[targetKey] = parseNumeric(raw[sourceKey]) ?? raw[sourceKey];
      }
    }
  }

  for (const [key, value] of Object.entries(raw)) {
    // If mapping exists and this key was mapped, skip (already mapped to targetKey)
    if (mapping && Object.prototype.hasOwnProperty.call(mapping, key)) {
      continue;
    }
    // If the key is not yet set on result, set it with parsed numeric coercion
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = parseNumeric(value) ?? value;
    }
  }

  return result;
}

