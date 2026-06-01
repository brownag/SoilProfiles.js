import { Horizon, Position, DepthAnnotation } from './types';

export class SoilProfile {
  public id: string;
  public horizons: Horizon[];
  public position?: Position;
  public metadata: Record<string, any>;
  public depthAnnotations: DepthAnnotation[];

  constructor(id: string, horizons: Horizon[] = [], position?: Position, metadata: Record<string, any> = {}, depthAnnotations: DepthAnnotation[] = []) {
    this.id = id;
    this.horizons = horizons;
    this.position = position;
    this.metadata = metadata;
    this.depthAnnotations = depthAnnotations;
    this.sortHorizonsByDepth();
    this.validateDepths();
  }

  public addHorizon(horizon: Horizon): void {
    this.horizons.push(horizon);
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
    for (let i = 0; i < this.horizons.length - 1; i++) {
      if (this.horizons[i].bottom > this.horizons[i + 1].top) {
        throw new Error(`Profile ${this.id}: Horizon depths overlap between ${this.horizons[i].name} and ${this.horizons[i+1].name}`);
      }
    }
    for (const h of this.horizons) {
        if (h.top >= h.bottom) {
            throw new Error(`Profile ${this.id}: Invalid horizon depth (top >= bottom) in ${h.name}`);
        }
    }
  }
}
