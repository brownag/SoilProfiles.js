import { SoilProfile } from './SoilProfile';

export class SoilProfileCollection {
  public profiles: SoilProfile[];

  constructor(profiles: SoilProfile[] = []) {
    this.profiles = profiles;
  }

  public addProfile(profile: SoilProfile): void {
    this.profiles.push(profile);
  }

  public filterByProperty(callback: (profile: SoilProfile) => boolean): SoilProfileCollection {
    return new SoilProfileCollection(this.profiles.filter(callback));
  }

  public sortByPosition(axis: 'x' | 'y' | 'z' = 'x'): void {
    this.profiles.sort((a, b) => {
      const posA = a.position ? a.position[axis] : 0;
      const posB = b.position ? b.position[axis] : 0;
      return posA - posB;
    });
  }

  public getMaxDepth(): number {
    let max = 0;
    for (const profile of this.profiles) {
      const range = profile.getDepthRange();
      if (range.bottom > max) {
        max = range.bottom;
      }
    }
    return max;
  }
}
