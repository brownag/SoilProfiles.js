import { Horizon } from './types';

export interface DepthRepairOptions {
  fillGaps?: boolean;           // Fill gaps with inferred depths (default: true)
  fixOverlaps?: boolean;        // Truncate overlapping horizons (default: true)
  expandZeroThickness?: boolean; // Expand zero-thickness to 1cm (default: true)
  pattern?: RegExp;             // Pattern for O horizon detection (default: /^O/i)
  adj?: number;                 // Adjustment for missing depths (default: 10)
}

export type DepthValidationErrorType = 'missingDepth' | 'depthLogic' | 'overlapOrGap' | 'unknown';

export interface DepthValidationError {
  type: DepthValidationErrorType;
  message: string;
  profileId?: string;
  horizonName?: string;
}

/**
 * Repairs horizon depths by:
 * 1. Dropping horizons with both top and bottom missing
 * 2. (if fillGaps) Filling missing bottom depths
 * 3. Handling inverted O horizons
 * 4. (if expandZeroThickness) Expanding zero-thickness horizons
 * 5. Sorting by top depth
 */
export function repairDepths(
  horizons: Horizon[],
  options: DepthRepairOptions = {}
): Horizon[] {
  const {
    fillGaps = true,
    expandZeroThickness = true,
    pattern = /^O/i,
    adj = 10
  } = options;

  // 1. Drop horizons where both top AND bottom are missing
  let fixed = horizons.filter(h => !(isNaN(h.top) && isNaN(h.bottom)));
  if (fixed.length === 0) return fixed;

  // 2. Fix missing bottom depths (if fillGaps enabled)
  if (fillGaps) {
    for (let i = 0; i < fixed.length; i++) {
      if (isNaN(fixed[i].bottom)) {
        fixed[i] = {
          ...fixed[i],
          bottom: i < fixed.length - 1 ? fixed[i + 1].top : fixed[i].top + adj
        };
      }
    }
  }

  // 3. Detect old-style O horizons: name matches pattern AND bottom < top
  const hasInvertedO = fixed.some(
    h => pattern.test(h.name) && !isNaN(h.top) && !isNaN(h.bottom) && h.bottom < h.top
  );

  if (hasInvertedO) {
    // Negate depths of inverted O horizons (e.g., top=1,bottom=0 → top=-1,bottom=0)
    fixed = fixed.map(h =>
      pattern.test(h.name) && h.bottom < h.top
        ? { ...h, top: -h.top, bottom: -h.bottom }
        : h
    );

    // Re-sort: negated O horizons now sort before depth-0 mineral horizons
    fixed.sort((a, b) => a.top - b.top);

    // Compute thicknesses (always positive after negation)
    const thicknesses = fixed.map(h => Math.abs(h.bottom - h.top));

    // Cumsum from min(abs(top)) to produce continuous non-negative depths
    const minAbsTop = Math.min(...fixed.map(h => Math.abs(h.top)));
    let cursor = minAbsTop;
    fixed = fixed.map((h, i) => {
      const newTop = cursor;
      const newBottom = cursor + thicknesses[i];
      cursor = newBottom;
      return { ...h, top: newTop, bottom: newBottom };
    });
  }

  // 4. Fix zero-thickness horizons (if expandZeroThickness enabled)
  if (expandZeroThickness) {
    fixed = fixed.map(h =>
      !isNaN(h.top) && !isNaN(h.bottom) && h.top === h.bottom
        ? { ...h, bottom: h.bottom + 1 }
        : h
    );
  }

  // 5. Final sort by top depth
  fixed.sort((a, b) => a.top - b.top);

  return fixed;
}

/**
 * Validates horizon depths before creating a SoilProfile.
 * Checks for missing depths, inverted depths, overlaps, and gaps.
 * Returns array of structured DepthValidationError objects.
 *
 * @param horizons Array of horizons to validate
 * @param profileId Optional profile ID for error messages
 * @returns Array of DepthValidationError objects (empty if valid)
 */
export function validateDepthsStructured(
  horizons: Horizon[],
  profileId: string = 'unknown'
): DepthValidationError[] {
  const errors: DepthValidationError[] = [];

  // Check for empty array
  if (!horizons || horizons.length === 0) {
    return errors;
  }

  // Check for NaN/undefined/missing depths
  for (const h of horizons) {
    if (h.top === null || h.top === undefined || isNaN(h.top)) {
      errors.push({
        type: 'missingDepth',
        message: `${profileId}: Missing or invalid top depth in horizon ${h.name}`,
        profileId,
        horizonName: h.name
      });
    }
    if (h.bottom === null || h.bottom === undefined || isNaN(h.bottom)) {
      errors.push({
        type: 'missingDepth',
        message: `${profileId}: Missing or invalid bottom depth in horizon ${h.name}`,
        profileId,
        horizonName: h.name
      });
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  // Check for inverted depths (top >= bottom)
  for (const h of horizons) {
    if (h.top >= h.bottom) {
      errors.push({
        type: 'depthLogic',
        message: `${profileId}: Invalid horizon depth (top >= bottom) in ${h.name}`,
        profileId,
        horizonName: h.name
      });
    }
  }

  // Check sorting
  const sorted = [...horizons].sort((a, b) => a.top - b.top);
  for (let i = 0; i < horizons.length; i++) {
    if (horizons[i].top !== sorted[i].top || horizons[i].bottom !== sorted[i].bottom) {
      errors.push({
        type: 'depthLogic',
        message: `${profileId}: Horizons not in top-depth order`,
        profileId
      });
      break;
    }
  }

  // Check for overlaps and gaps between adjacent horizons
  for (let i = 0; i < horizons.length - 1; i++) {
    const curr = horizons[i];
    const next = horizons[i + 1];

    if (curr.bottom > next.top) {
      errors.push({
        type: 'overlapOrGap',
        message: `${profileId}: Overlap between ${curr.name} (ends at ${curr.bottom}cm) and ${next.name} (starts at ${next.top}cm)`,
        profileId,
        horizonName: curr.name
      });
    }

    if (curr.bottom < next.top) {
      const gap = next.top - curr.bottom;
      errors.push({
        type: 'overlapOrGap',
        message: `${profileId}: Gap of ${gap}cm between ${curr.name} and ${next.name}`,
        profileId,
        horizonName: curr.name
      });
    }
  }

  return errors;
}

/**
 * Validates horizon depths before creating a SoilProfile.
 * Checks for missing depths, inverted depths, overlaps, and gaps.
 * Returns array of error message strings.
 *
 * @param horizons Array of horizons to validate
 * @param profileId Optional profile ID for error messages
 * @returns Array of error message strings (empty if valid)
 */
export function validateDepths(
  horizons: Horizon[],
  profileId: string = 'unknown'
): string[] {
  return validateDepthsStructured(horizons, profileId).map(e => e.message);
}
