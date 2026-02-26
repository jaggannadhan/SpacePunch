import { Car } from '../entities/Car';
import { Meteor } from '../entities/Meteor';
import { Powerup } from '../entities/Powerup';
import { Loot, LootType } from '../entities/Loot';

export interface CollisionResult {
  gameOver: boolean;
  shieldHit: boolean;
  shieldBroken: boolean;
  damageHit: boolean;
  meteorDiameter: number;
}

export interface PowerupCollisionResult {
  collected: boolean;
}

export interface LootCollisionResult {
  collected: boolean;
  lootType: LootType;
}

export class CollisionSystem {
  /**
   * Check car vs single meteor.
   * Shield absorbs hits: impact = ceil(d / 12), subtracted from shieldLevel.
   * When shield is 0, big meteor = game over, small = damage.
   */
  checkMeteor(car: Car, meteor: Meteor): CollisionResult | null {
    if (car.invincible || meteor.hasCollided) return null;

    const dx = car.x - meteor.x;
    const dy = car.y - meteor.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy);
    const touchDist = car.hitRadius + meteor.hitRadius;

    if (centerDist >= touchDist) return null;

    // Collision!
    meteor.hasCollided = true;

    // If shield is active, absorb the hit
    if (car.shieldActive) {
      const prevLevel = car.shieldLevel;
      car.applyShieldHit(meteor.diameter, meteor.x, meteor.y);
      const broken = prevLevel > 0 && car.shieldLevel === 0;
      return {
        gameOver: false,
        shieldHit: true,
        shieldBroken: broken,
        damageHit: false,
        meteorDiameter: meteor.diameter,
      };
    }

    // No shield
    if (meteor.isBig) {
      // Big meteor with no shield = instant death
      return {
        gameOver: true,
        shieldHit: false,
        shieldBroken: false,
        damageHit: false,
        meteorDiameter: meteor.diameter,
      };
    }

    // Small meteor: apply damage
    const dead = car.applySmallDamage(meteor.diameter);
    return {
      gameOver: dead,
      shieldHit: false,
      shieldBroken: false,
      damageHit: true,
      meteorDiameter: meteor.diameter,
    };
  }

  /**
   * Check car vs powerup. Powerups can be collected even during i-frames.
   */
  checkPowerup(car: Car, powerup: Powerup): PowerupCollisionResult | null {
    if (powerup.collected) return null;

    const dx = car.x - powerup.x;
    const dy = car.y - powerup.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy);
    const touchDist = car.hitRadius + powerup.hitRadius;

    if (centerDist >= touchDist) return null;

    powerup.collected = true;
    car.repairShield(1);
    return { collected: true };
  }

  /**
   * Check car vs loot. Loot can be collected even during i-frames.
   */
  checkLoot(car: Car, loot: Loot): LootCollisionResult | null {
    if (loot.collected) return null;

    const dx = car.x - loot.x;
    const dy = car.y - loot.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy);
    const touchDist = car.hitRadius + loot.hitRadius;

    if (centerDist >= touchDist) return null;

    loot.collected = true;
    return { collected: true, lootType: loot.lootType };
  }
}
