import Phaser from 'phaser';
import {
  LOOT_RENDER_SIZE, LOOT_HIT_RADIUS, LOOT_SPEED,
  GAME_HEIGHT,
} from '../GameConfig';

export type LootType = 'gold' | 'diamond' | 'ruby';

export class Loot {
  sprite: Phaser.GameObjects.Image;
  hitRadius = LOOT_HIT_RADIUS;
  collected = false;
  lootType: LootType;

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

  update(dt: number): void {
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
