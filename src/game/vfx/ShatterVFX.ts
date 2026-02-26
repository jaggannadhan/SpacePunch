import Phaser from 'phaser';

export class ShatterVFX {
  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('meteor_shard')) return;
    const gfx = scene.add.graphics();
    gfx.fillStyle(0x8B7355);
    gfx.fillRect(0, 0, 6, 6);
    gfx.fillStyle(0xaa9070);
    gfx.fillRect(1, 1, 3, 3);
    gfx.generateTexture('meteor_shard', 6, 6);
    gfx.destroy();
  }

  static spawn(scene: Phaser.Scene, x: number, y: number, diameter: number): void {
    const count = Math.min(Math.ceil(diameter / 4), 20);
    const particles = scene.add.particles(x, y, 'meteor_shard', {
      speed: { min: 50, max: 180 },
      scale: { start: 0.6 + diameter / 120, end: 0 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      lifespan: 450,
      quantity: count,
      emitting: false,
    });
    particles.explode(count);
  }
}
