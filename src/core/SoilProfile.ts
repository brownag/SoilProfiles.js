import { Horizon, Position, DepthAnnotation, SoilProfileConfig } from './types';
import { repairDepths, DepthRepairOptions, validateDepthsStructured } from './depthRepair';

interface RepairOptions {
  pattern?: RegExp;
  adj?: number;
}

export interface SoilProfile {
  id: string;
  horizons: Horizon[];
  metadata?: Record<string, any>;
}

/**
 * Backward-compatible wrapper around repairDepths.
 * Uses default DepthRepairOptions for fillGaps and expandZeroThickness.
 */
export function repairHorizonDepths(
  horizons: Horizon[],
  options: RepairOptions = {}
): Horizon[] {
  const pattern = options.pattern ?? /^O/i;
  const adj = options.adj ?? 10;

  return repairDepths(horizons, {
    fillGaps: true,
    fixOverlaps: true,
    expandZeroThickness: true,
    pattern,
    adj
  });
}

/**
 * Backward-compatible wrapper around validateDepths.
 * Converts string[] error messages to {type, message}[] objects.
 */
export function validateHorizonDepths(
  horizons: Horizon[],
  profileId: string = 'unknown'
): { valid: boolean; errors: Array<{ type: string; message: string }> } {
  const errors = validateDepthsStructured(horizons, profileId);
  return { valid: errors.length === 0, errors };
}

export class SoilProfile {
  public id: string;
  public horizons: Horizon[];
  public position?: Position;
  public metadata?: Record<string, any>;
  public depthAnnotations: DepthAnnotation[];
  private validateDepths: boolean;
  private autoRepair: boolean;

  constructor(id: string, horizons: Horizon[] = [], position?: Position, metadata: Record<string, any> = {}, depthAnnotations: DepthAnnotation[] = [], config?: SoilProfileConfig) {
    this.id = id;
    this.validateDepths = config?.validateDepths ?? true;
    this.autoRepair = config?.autoRepair ?? true;
    this.horizons = this.autoRepair ? repairHorizonDepths(horizons) : horizons;
    this.position = position;
    this.metadata = metadata;
    this.depthAnnotations = depthAnnotations;
    this.sortHorizonsByDepth();
    if (this.validateDepths) {
      this.validateHorizonDepthsOrThrow();
    }
  }

  public addHorizon(horizon: Horizon): void {
    this.horizons.push(horizon);
    if (this.autoRepair) {
      this.horizons = repairHorizonDepths(this.horizons);
    }
    this.sortHorizonsByDepth();
    if (this.validateDepths) {
      this.validateHorizonDepthsOrThrow();
    }
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

  private collectDepthErrors(): Array<{ type: string; message: string }> {
    const errors: Array<{ type: string; message: string }> = [];

    // Check for NaN/undefined/missing depths
    for (const h of this.horizons) {
      if (h.top === null || h.top === undefined || isNaN(h.top)) {
        errors.push({ type: 'missingDepth', message: `Profile ${this.id}: Missing or invalid top depth in horizon ${h.name}` });
      }
      if (h.bottom === null || h.bottom === undefined || isNaN(h.bottom)) {
        errors.push({ type: 'missingDepth', message: `Profile ${this.id}: Missing or invalid bottom depth in horizon ${h.name}` });
      }
    }

    if (errors.length === 0) {
      // Check for inverted depths (top >= bottom)
      for (const h of this.horizons) {
        if (h.top >= h.bottom) {
          errors.push({ type: 'depthLogic', message: `Profile ${this.id}: Invalid horizon depth (top >= bottom) in ${h.name}` });
        }
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

    return errors;
  }

  private validateHorizonDepthsOrThrow(): void {
    const errors = this.collectDepthErrors();
    if (errors.length > 0) {
      throw new Error(errors[0].message);
    }
  }
}
