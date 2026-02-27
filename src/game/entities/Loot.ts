import Phaser from 'phaser';
import {
  LOOT_RENDER_SIZE, LOOT_HIT_RADIUS, LOOT_SPEED,
  GAME_HEIGHT,
  RUBY_DRIFT_VY, RUBY_WOBBLE_SPEED,
} from '../GameConfig';

export type LootType = 'gold' | 'diamond' | 'ruby';

export class Loot {
  sprite: Phaser.GameObjects.Image;
  hitRadius = LOOT_HIT_RADIUS;
  collected = false;
  lootType: LootType;

  // Drop mode (ruby drops from meteor kills)
  private dropMode = false;
  private lifetimeMs = 0;
  private wobblePhase = 0;
  private elapsed = 0;
  expired = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, lootType: LootType) {
    this.lootType = lootType;
    this.sprite = scene.add.image(x, y, textureKey);

    // Normalize size
    const maxDim = Math.max(this.sprite.frame.width, this.sprite.frame.height);
    if (maxDim > 0) {
      this.sprite.setScale(LOOT_RENDER_SIZE / maxDim);
    }
    this.sprite.setDepth(6);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /** Switch to drop mode: slow drift + wobble, with a lifetime before expiry. */
  setDropMode(lifetimeMs: number): void {
    this.dropMode = true;
    this.lifetimeMs = lifetimeMs;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.sprite.setDepth(7);
  }

  update(dt: number): void {
    if (this.dropMode) {
      this.elapsed += dt;
      this.lifetimeMs -= dt * 1000;
      if (this.lifetimeMs <= 0) {
        this.expired = true;
        return;
      }
      // Fade out in last 1.5s
      if (this.lifetimeMs < 1500) {
        this.sprite.setAlpha(this.lifetimeMs / 1500);
      }
      // Slow drift down + horizontal wobble
      this.sprite.y += RUBY_DRIFT_VY * dt;
      this.sprite.x += Math.sin(this.elapsed * 3 + this.wobblePhase) * RUBY_WOBBLE_SPEED * dt;
      this.sprite.angle = Math.sin(this.elapsed * 4) * 12;
      return;
    }

    this.sprite.y += LOOT_SPEED * dt;
    // Gentle rotation
    this.sprite.angle = Math.sin(this.sprite.y * 0.04) * 12;
  }

  isOffScreen(): boolean {
    return this.sprite.y > GAME_HEIGHT + LOOT_RENDER_SIZE;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
