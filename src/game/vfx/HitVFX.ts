import Phaser from 'phaser';
import { Car } from '../entities/Car';
import {
  HIT_STAR_SCALE_START, HIT_STAR_SCALE_POP, HIT_STAR_SCALE_SETTLE,
  HIT_STAR_FADE_MS, HIT_JIGGLE_PX, HIT_JIGGLE_MS,
  HIT_SHAKE_SMALL, HIT_SHAKE_BIG,
} from '../GameConfig';

export class HitVFX {
  /** Ensure the procedural starburst texture exists. Call once in create(). */
  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('hit_star')) return;
    const gfx = scene.add.graphics();
    // White center
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(16, 16, 6);
    // Orange rays: 6 thin triangles radiating outward
    gfx.fillStyle(0xffaa44, 0.7);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const tipX = 16 + Math.cos(angle) * 14;
      const tipY = 16 + Math.sin(angle) * 14;
      const perpX = Math.cos(angle + Math.PI / 2) * 2;
      const perpY = Math.sin(angle + Math.PI / 2) * 2;
      gfx.fillTriangle(
        16 + perpX, 16 + perpY,
        16 - perpX, 16 - perpY,
        tipX, tipY,
      );
    }
    gfx.generateTexture('hit_star', 32, 32);
    gfx.destroy();
  }

  /** Spawn impact star at position, scale-pop, then fade out. */
  static spawnImpactStar(scene: Phaser.Scene, x: number, y: number): void {
    const star = scene.add.image(x, y, 'hit_star');
    star.setDepth(12);
    star.setScale(HIT_STAR_SCALE_START);
    star.setAlpha(1);

    // Scale pop: start -> pop (80ms) -> settle (100ms)
    scene.tweens.add({
      targets: star,
      scale: HIT_STAR_SCALE_POP,
      duration: 80,
      ease: 'Back.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: star,
          scale: HIT_STAR_SCALE_SETTLE,
          duration: 100,
          ease: 'Sine.easeOut',
        });
      },
    });

    // Fade out, then destroy
    scene.tweens.add({
      targets: star,
      alpha: 0,
      duration: HIT_STAR_FADE_MS,
      delay: 80,
      ease: 'Power2',
      onComplete: () => star.destroy(),
    });
  }

  /** Jiggle the car sprite +/- pixels for a short duration. */
  static jiggleCar(scene: Phaser.Scene, car: Car): void {
    const origX = car.sprite.x;
    scene.tweens.add({
      targets: car.sprite,
      x: origX + HIT_JIGGLE_PX,
      duration: HIT_JIGGLE_MS / 4,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => { car.sprite.x = origX; },
    });
  }

  /** Camera shake appropriate for meteor size. */
  static shakeForHit(scene: Phaser.Scene, isBig: boolean): void {
    const [intensity, duration] = isBig ? HIT_SHAKE_BIG : HIT_SHAKE_SMALL;
    scene.cameras.main.shake(duration, intensity);
  }
}
