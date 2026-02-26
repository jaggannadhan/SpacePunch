import Phaser from 'phaser';
import { Loot, LootType } from '../entities/Loot';
import { Meteor } from '../entities/Meteor';
import {
  GAME_WIDTH, LOOT_RENDER_SIZE,
  LOOT_SPAWN_MIN_MS, LOOT_SPAWN_MAX_MS,
  LOOT_WEIGHTS, LOOT_SAFE_DISTANCE,
  CAR_DIAMETER,
  ULTIMATE_MAGNET_SPEED, ULTIMATE_MAGNET_ACCEL,
  LOOT_HIT_RADIUS,
} from '../GameConfig';

export class LootManager {
  loots: Loot[] = [];
  private scene: Phaser.Scene;
  private spawnTimer: number;
  private textureKeys: Map<string, string>; // lootId → texture key

  constructor(scene: Phaser.Scene, textureKeys: Map<string, string>) {
    this.scene = scene;
    this.textureKeys = textureKeys;
    this.spawnTimer = this.nextInterval();
  }

  private nextInterval(): number {
    return Phaser.Math.FloatBetween(LOOT_SPAWN_MIN_MS, LOOT_SPAWN_MAX_MS) / 1000;
  }

  update(dt: number, meteors: Meteor[], carX: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn(meteors, carX);
      this.spawnTimer = this.nextInterval();
    }

    for (let i = this.loots.length - 1; i >= 0; i--) {
      const l = this.loots[i];
      l.update(dt);
      if (l.isOffScreen() || l.collected) {
        l.destroy();
        this.loots.splice(i, 1);
      }
    }
  }

  private spawn(meteors: Meteor[], carX: number): void {
    if (this.textureKeys.size === 0) return;

    const lootType = this.pickWeightedType();
    const texKey = this.textureKeys.get(lootType);
    if (!texKey) return;

    const r = LOOT_RENDER_SIZE / 2;
    let x = Phaser.Math.FloatBetween(r, GAME_WIDTH - r);

    // Avoid spawning on car position
    const safeFromCar = CAR_DIAMETER / 2 + r + 20;
    let attempts = 0;
    while (Math.abs(x - carX) < safeFromCar && attempts < 6) {
      x = Phaser.Math.FloatBetween(r, GAME_WIDTH - r);
      attempts++;
    }

    // Avoid spawning near big meteors
    const tooClose = meteors.some(m =>
      m.isBig && Math.abs(m.x - x) < LOOT_SAFE_DISTANCE && m.y < 100,
    );
    if (tooClose) {
      // Shift x to opposite side
      x = x < GAME_WIDTH / 2
        ? Phaser.Math.FloatBetween(GAME_WIDTH / 2, GAME_WIDTH - r)
        : Phaser.Math.FloatBetween(r, GAME_WIDTH / 2);
    }

    const loot = new Loot(this.scene, x, -r, texKey, lootType);
    this.loots.push(loot);
  }

  private pickWeightedType(): LootType {
    const roll = Math.random();
    let cumulative = 0;
    for (const entry of LOOT_WEIGHTS) {
      cumulative += entry.weight;
      if (roll < cumulative) return entry.id as LootType;
    }
    return 'gold'; // fallback
  }

  /**
   * During ultimate mode, pull all loot toward the car.
   * Returns list of loot items that reached the car (for auto-collection).
   */
  magnetUpdate(dt: number, carX: number, carY: number): Loot[] {
    const collected: Loot[] = [];
    const pickupDist = LOOT_HIT_RADIUS + 10;

    for (const l of this.loots) {
      if (l.collected) continue;

      const dx = carX - l.sprite.x;
      const dy = carY - l.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Acceleration increases as distance shrinks
      const accelBoost = Math.max(0, 1 - dist / 300);
      const speed = ULTIMATE_MAGNET_SPEED + ULTIMATE_MAGNET_ACCEL * accelBoost;
      const step = speed * dt;

      if (dist <= pickupDist) {
        // Close enough — mark for auto-collect
        l.collected = true;
        collected.push(l);
      } else {
        // Move toward car
        l.sprite.x += (dx / dist) * step;
        l.sprite.y += (dy / dist) * step;
        // Slight scale-down as it approaches
        const scale = 0.6 + 0.4 * Math.min(dist / 200, 1);
        l.sprite.setScale(scale * (LOOT_RENDER_SIZE / Math.max(l.sprite.frame.width, l.sprite.frame.height)));
      }
    }
    return collected;
  }

  clearAll(): void {
    for (const l of this.loots) l.destroy();
    this.loots = [];
    this.spawnTimer = this.nextInterval();
  }
}
