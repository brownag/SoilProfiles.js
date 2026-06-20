import { Horizon, Position, DepthAnnotation } from './types';

interface RepairOptions {
  pattern?: RegExp;
  adj?: number;
}

export function repairHorizonDepths(
  horizons: Horizon[],
  options: RepairOptions = {}
): Horizon[] {
  const pattern = options.pattern ?? /^O/i;
  const adj = options.adj ?? 10;

  // 1. Drop horizons where both top AND bottom are missing
  let fixed = horizons.filter(h => !(isNaN(h.top) && isNaN(h.bottom)));
  if (fixed.length === 0) return fixed;

  // 2. Fix missing bottom depths:
  //    - Non-deepest horizons: borrow top of next horizon
  //    - Deepest horizon: top + adj
  for (let i = 0; i < fixed.length; i++) {
    if (isNaN(fixed[i].bottom)) {
      fixed[i] = {
        ...fixed[i],
        bottom: i < fixed.length - 1 ? fixed[i + 1].top : fixed[i].top + adj
      };
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

  // 4. Fix zero-thickness horizons (top === bottom) — expand bottom by 1
  fixed = fixed.map(h =>
    !isNaN(h.top) && !isNaN(h.bottom) && h.top === h.bottom
      ? { ...h, bottom: h.bottom + 1 }
      : h
  );

  // 5. Final sort by top depth
  fixed.sort((a, b) => a.top - b.top);

  return fixed;
}

/**
 * Validates horizon depths before creating a SoilProfile.
 * Checks for missing depths, inverted depths, overlaps, and gaps.
 *
 * @param horizons Array of horizons to validate
 * @param profileId Optional profile ID for error messages
 * @returns Object with valid flag and details array
 */
export function validateHorizonDepths(
  horizons: Horizon[],
  profileId: string = 'unknown'
): { valid: boolean; errors: Array<{ type: string; message: string }> } {
  const errors: Array<{ type: string; message: string }> = [];

  // Check for empty array
  if (!horizons || horizons.length === 0) {
    return { valid: true, errors };
  }

  // Check for NaN/undefined/missing depths
  for (const h of horizons) {
    if (h.top === null || h.top === undefined || isNaN(h.top)) {
      errors.push({ type: 'missingDepth', message: `Missing or invalid top depth in horizon ${h.name}` });
    }
    if (h.bottom === null || h.bottom === undefined || isNaN(h.bottom)) {
      errors.push({ type: 'missingDepth', message: `Missing or invalid bottom depth in horizon ${h.name}` });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check for inverted depths (top >= bottom)
  for (const h of horizons) {
    if (h.top >= h.bottom) {
      errors.push({ type: 'depthLogic', message: `Invalid horizon depth (top >= bottom) in ${h.name}` });
    }
  }

  // Check sorting
  const sorted = [...horizons].sort((a, b) => a.top - b.top);
  for (let i = 0; i < horizons.length; i++) {
    if (horizons[i].top !== sorted[i].top || horizons[i].bottom !== sorted[i].bottom) {
      errors.push({ type: 'depthLogic', message: `Horizons not in top-depth order` });
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
        message: `Overlap between ${curr.name} (ends at ${curr.bottom}cm) and ${next.name} (starts at ${next.top}cm)`
      });
    }

    if (curr.bottom < next.top) {
      const gap = next.top - curr.bottom;
      errors.push({
        type: 'overlapOrGap',
        message: `Gap of ${gap}cm between ${curr.name} and ${next.name}`
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export class SoilProfile {
  public id: string;
  public horizons: Horizon[];
  public position?: Position;
  public metadata: Record<string, any>;
  public depthAnnotations: DepthAnnotation[];

  constructor(id: string, horizons: Horizon[] = [], position?: Position, metadata: Record<string, any> = {}, depthAnnotations: DepthAnnotation[] = []) {
    this.id = id;
    this.horizons = repairHorizonDepths(horizons);
    this.position = position;
    this.metadata = metadata;
    this.depthAnnotations = depthAnnotations;
    this.sortHorizonsByDepth();
    this.validateDepths();
  }

  public addHorizon(horizon: Horizon): void {
    this.horizons.push(horizon);
    this.horizons = repairHorizonDepths(this.horizons);
    this.sortHorizonsByDepth();
    this.validateDepths();
  }

  public getDepthRange(): { top: number; bottom: number } {
    if (this.horizons.length === 0) return { top: 0, bottom: 0 };
    return {
      top: this.horizons[0].top,
      bottom: this.horizons[this.horizons.length - 1].bottom,
    };
  }

  public sortHorizonsByDepth(): void {
    this.horizons.sort((a, b) => a.top - b.top);
  }

  private validateDepths(): void {
    // Check for NaN/undefined/missing depths
    for (const h of this.horizons) {
      if (h.top === null || h.top === undefined || isNaN(h.top)) {
        throw new Error(`Profile ${this.id}: Missing or invalid top depth in horizon ${h.name}`);
      }
      if (h.bottom === null || h.bottom === undefined || isNaN(h.bottom)) {
        throw new Error(`Profile ${this.id}: Missing or invalid bottom depth in horizon ${h.name}`);
      }
    }

    // Check for inverted depths (top >= bottom)
    for (const h of this.horizons) {
      if (h.top >= h.bottom) {
        throw new Error(`Profile ${this.id}: Invalid horizon depth (top >= bottom) in ${h.name}`);
      }
    }

    // Warn (not throw) on overlaps and gaps — common in SSURGO data, still renderable
    for (let i = 0; i < this.horizons.length - 1; i++) {
      const curr = this.horizons[i];
      const next = this.horizons[i + 1];

      if (curr.bottom > next.top) {
        console.warn(`Profile ${this.id}: Horizon overlap between ${curr.name} (ends at ${curr.bottom}cm) and ${next.name} (starts at ${next.top}cm)`);
      }

      if (curr.bottom < next.top) {
        const gap = next.top - curr.bottom;
        console.warn(`Profile ${this.id}: Gap of ${gap}cm between horizons ${curr.name} (ends at ${curr.bottom}cm) and ${next.name} (starts at ${next.top}cm)`);
      }
    }
  }
}
