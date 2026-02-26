import { Car } from '../entities/Car';
import { Meteor } from '../entities/Meteor';
import { NEAR_MISS_TIERS } from '../GameConfig';

export interface NearMissEvent {
  x: number;
  y: number;
  combo: number;
}

export class ScoreSystem {
  comboLevel = 0;

  /** Check near-miss for all meteors. Returns events for VFX. */
  update(car: Car, meteors: Meteor[]): NearMissEvent[] {
    const events: NearMissEvent[] = [];

    for (const m of meteors) {
      if (m.hasCollided) continue;

      const dx = car.x - m.x;
      const dy = car.y - m.y;
      const centerDist = Math.sqrt(dx * dx + dy * dy);
      const gap = centerDist - car.hitRadius - m.hitRadius;

      if (gap < 0) continue; // actual collision, skip

      // Check tiers from closest (highest reward) to farthest
      for (let i = NEAR_MISS_TIERS.length - 1; i >= 0; i--) {
        const tier = NEAR_MISS_TIERS[i];
        if (gap < tier.distance && tier.points > m.nearMissAwarded) {
          const diff = tier.points - m.nearMissAwarded;
          this.comboLevel = Math.min(100, this.comboLevel + diff);
          m.nearMissAwarded = tier.points;
          events.push({ x: m.x, y: m.y, combo: diff });
          break;
        }
      }
    }

    return events;
  }

  reset(): void {
    this.comboLevel = 0;
  }
}
