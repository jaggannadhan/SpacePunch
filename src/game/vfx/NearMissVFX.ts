import Phaser from 'phaser';
import { NEAR_MISS_FLOAT_RISE, NEAR_MISS_FLOAT_DURATION, NEAR_MISS_MAX_ACTIVE } from '../GameConfig';

export class NearMissVFX {
  private scene: Phaser.Scene;
  private activeTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Spawn floating "+N" text near the meteor if under the throttle cap. */
  spawn(x: number, y: number, points: number): void {
    if (this.activeTexts.length >= NEAR_MISS_MAX_ACTIVE) return;

    // Color by tier
    let color = '#ffffff';
    if (points >= 5) color = '#00ffff';
    else if (points >= 3) color = '#ffff44';

    const text = this.scene.add.text(x, y - 10, `+${points}`, {
      fontFamily: 'Courier New',
      fontSize: '14px',
      color,
      stroke: '#000',
      strokeThickness: 2,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(15);

    this.activeTexts.push(text);

    this.scene.tweens.add({
      targets: text,
      y: y - 10 - NEAR_MISS_FLOAT_RISE,
      alpha: 0,
      duration: NEAR_MISS_FLOAT_DURATION,
      ease: 'Power2',
      onComplete: () => {
        text.destroy();
        const idx = this.activeTexts.indexOf(text);
        if (idx !== -1) this.activeTexts.splice(idx, 1);
      },
    });
  }

  reset(): void {
    for (const t of this.activeTexts) t.destroy();
    this.activeTexts = [];
  }
}
