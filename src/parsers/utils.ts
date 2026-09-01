import { Horizon } from '../core/types';

/**
 * Parse numeric value, return undefined if NaN or invalid.
 * Handles undefined, null, empty strings, and non-finite numbers.
 * @param value Raw input value (any type)
 * @returns Parsed number, or undefined if invalid
 */
export function parseNumeric(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
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
