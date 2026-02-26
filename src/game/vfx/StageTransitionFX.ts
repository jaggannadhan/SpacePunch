import Phaser from 'phaser';
import { Car } from '../entities/Car';
import {
  STAGE_TRANSITION_DURATION_MS,
  STAGE_HYPER_SCALE_UP,
  STAGE_HYPER_MOVE_UP,
  CAR_RENDER_SIZE,
} from '../GameConfig';

export class StageTransitionFX {
  private scene: Phaser.Scene;
  private car: Car;
  active = false;

  constructor(scene: Phaser.Scene, car: Car) {
    this.scene = scene;
    this.car = car;
    this.ensureTextures();
  }

  private ensureTextures(): void {
    if (this.scene.textures.exists('jet_trail')) return;
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0x44aaff, 0.9);
    gfx.fillCircle(3, 3, 3);
    gfx.generateTexture('jet_trail', 6, 6);
    gfx.destroy();
  }

  /** Play the full stage transition sequence. */
  play(onConfetti: () => void): void {
    if (this.active) return;
    this.active = true;
    this.car.inputDisabled = true;

    const sprite = this.car.sprite;
    const startY = sprite.y;
    const startScaleX = sprite.scaleX;
    const startScaleY = sprite.scaleY;

    // Camera shake at t=0
    this.scene.cameras.main.shake(200, 0.006);

    // DOM confetti at t=0
    onConfetti();

    // Hyperdrive: scale up + move up (200ms)
    this.scene.tweens.add({
      targets: sprite,
      scaleX: startScaleX * STAGE_HYPER_SCALE_UP,
      scaleY: startScaleY * STAGE_HYPER_SCALE_UP,
      y: startY - STAGE_HYPER_MOVE_UP,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Scale back down + return (300ms)
        this.scene.tweens.add({
          targets: sprite,
          scaleX: startScaleX,
          scaleY: startScaleY,
          y: startY,
          duration: 300,
          ease: 'Sine.easeInOut',
        });
      },
    });

    // Jet trail particles behind car for the duration
    const emitter = this.scene.add.particles(0, 0, 'jet_trail', {
      follow: sprite,
      followOffset: { x: 0, y: CAR_RENDER_SIZE / 2 + 4 },
      speed: { min: 20, max: 80 },
      angle: { min: 80, max: 100 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 400,
      frequency: 30,
      quantity: 2,
      tint: [0x44aaff, 0x88ccff, 0xffffff],
      emitting: true,
    });

    // End transition after duration
    this.scene.time.delayedCall(STAGE_TRANSITION_DURATION_MS, () => {
      emitter.stop();
      // Let existing particles finish, then destroy emitter
      this.scene.time.delayedCall(500, () => emitter.destroy());

      this.car.inputDisabled = false;
      this.active = false;
    });
  }
}
