import Phaser from 'phaser';
import { Powerup } from '../entities/Powerup';
import {
  GAME_WIDTH, POWERUP_RENDER_SIZE,
  POWERUP_SPAWN_INTERVAL_MS, POWERUP_SPAWN_JITTER_MS,
} from '../GameConfig';

export class PowerupManager {
  powerups: Powerup[] = [];
  private scene: Phaser.Scene;
  private spawnTimer: number;
  private textureKeys: string[] = [];

  constructor(scene: Phaser.Scene, textureKeys: string[]) {
    this.scene = scene;
    this.textureKeys = textureKeys;
    this.spawnTimer = this.nextInterval();
  }

  private nextInterval(): number {
    const jitter = Phaser.Math.FloatBetween(-POWERUP_SPAWN_JITTER_MS, POWERUP_SPAWN_JITTER_MS);
    return (POWERUP_SPAWN_INTERVAL_MS + jitter) / 1000; // convert to seconds
  }

  update(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer = this.nextInterval();
    }

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.update(dt);
      if (p.isOffScreen() || p.collected) {
        p.destroy();
        this.powerups.splice(i, 1);
      }
    }
  }

  private spawn(): void {
    if (this.textureKeys.length === 0) return;

    const r = POWERUP_RENDER_SIZE / 2;
    const x = Phaser.Math.FloatBetween(r, GAME_WIDTH - r);
    const texKey = this.textureKeys[Phaser.Math.Between(0, this.textureKeys.length - 1)];
    const powerup = new Powerup(this.scene, x, -r, texKey);
    this.powerups.push(powerup);
  }

  clearAll(): void {
    for (const p of this.powerups) p.destroy();
    this.powerups = [];
    this.spawnTimer = this.nextInterval();
  }
}
