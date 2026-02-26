import Phaser from 'phaser';
import {
  POWERUP_RENDER_SIZE, POWERUP_HIT_RADIUS, POWERUP_SPEED,
  GAME_HEIGHT,
} from '../GameConfig';

export class Powerup {
  sprite: Phaser.GameObjects.Image;
  hitRadius = POWERUP_HIT_RADIUS;
  collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string) {
    this.sprite = scene.add.image(x, y, textureKey);

    // Normalize size
    const maxDim = Math.max(this.sprite.frame.width, this.sprite.frame.height);
    if (maxDim > 0) {
      this.sprite.setScale(POWERUP_RENDER_SIZE / maxDim);
    }
    this.sprite.setDepth(6);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  update(dt: number): void {
    this.sprite.y += POWERUP_SPEED * dt;
    // Gentle bob
    this.sprite.angle = Math.sin(this.sprite.y * 0.05) * 10;
  }

  isOffScreen(): boolean {
    return this.sprite.y > GAME_HEIGHT + POWERUP_RENDER_SIZE;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
