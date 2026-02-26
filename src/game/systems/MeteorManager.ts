import Phaser from 'phaser';
import { Meteor } from '../entities/Meteor';
import {
  METEOR_DIAMETER_MIN, METEOR_DIAMETER_MAX,
  METEOR_BASE_SPEED, METEOR_SPEED_PER_LEVEL,
  SPAWN_BASE_INTERVAL_MS, SPAWN_MIN_INTERVAL_MS, SPAWN_INTERVAL_REDUCTION,
  MAX_METEORS_BASE, MAX_METEORS_PER_LEVEL,
  GAME_WIDTH, SAFE_SPAWN_PADDING, CAR_DIAMETER,
} from '../GameConfig';

export class MeteorManager {
  meteors: Meteor[] = [];
  private scene: Phaser.Scene;
  private spawnTimer = 0;
  private textureKeys: string[] = [];

  constructor(scene: Phaser.Scene, textureKeys: string[]) {
    this.scene = scene;
    this.textureKeys = textureKeys;
  }

  update(dt: number, intensity: number, trailSpeed: number, carX: number): void {
    const spawnInterval = Math.max(
      SPAWN_MIN_INTERVAL_MS,
      SPAWN_BASE_INTERVAL_MS - (intensity - 1) * SPAWN_INTERVAL_REDUCTION,
    );
    const maxMeteors = MAX_METEORS_BASE + (intensity - 1) * MAX_METEORS_PER_LEVEL;

    this.spawnTimer -= dt * 1000;
    if (this.spawnTimer <= 0 && this.meteors.length < maxMeteors) {
      this.spawn(trailSpeed, carX);
      this.spawnTimer = spawnInterval;
    }

    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.update(dt);
      if (m.isOffScreen()) {
        m.destroy();
        this.meteors.splice(i, 1);
      }
    }
  }

  private spawn(trailSpeed: number, carX: number): void {
    const diameter = Phaser.Math.Between(METEOR_DIAMETER_MIN, METEOR_DIAMETER_MAX);
    const r = diameter / 2;

    let x: number;
    let attempts = 0;
    const safeZone = CAR_DIAMETER / 2 + r + SAFE_SPAWN_PADDING;
    do {
      x = Phaser.Math.FloatBetween(r, GAME_WIDTH - r);
      attempts++;
    } while (Math.abs(x - carX) < safeZone && attempts < 8);

    const tooClose = this.meteors.some(m =>
      m.isBig && Math.abs(m.x - x) < m.diameter / 2 + r + 20
    );
    if (tooClose && this.meteors.length > 3) return;

    const vy = METEOR_BASE_SPEED + (trailSpeed - 1) * METEOR_SPEED_PER_LEVEL;
    const speedJitter = Phaser.Math.FloatBetween(0.85, 1.15);

    // Pick a random texture from available meteor textures
    const texKey = this.textureKeys.length > 0
      ? this.textureKeys[Phaser.Math.Between(0, this.textureKeys.length - 1)]
      : 'meteor_fallback';

    const meteor = new Meteor(this.scene, x, -r, diameter, vy * speedJitter, texKey);
    this.meteors.push(meteor);
  }

  clearAll(): void {
    for (const m of this.meteors) m.destroy();
    this.meteors = [];
    this.spawnTimer = 0;
  }
}
