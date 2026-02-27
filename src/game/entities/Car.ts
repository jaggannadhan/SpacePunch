import Phaser from 'phaser';
import {
  CAR_DIAMETER, CAR_HIT_RADIUS, CAR_RENDER_SIZE, CAR_SPEED,
  GAME_WIDTH, GAME_HEIGHT,
  KNOCK_DISTANCE, KNOCK_DURATION_MS,
  IFRAME_SMALL_MS, IFRAME_BIG_MS,
  SHIELD_MAX_LEVEL, SHIELD_IMPACT_DIVISOR,
} from '../GameConfig';
import type { InputManager } from '../systems/InputManager';

const FALLBACK_TEXTURE = 'skin_default';

export class Car {
  sprite: Phaser.GameObjects.Image;
  scene: Phaser.Scene;

  hitRadius = CAR_HIT_RADIUS;
  speed = CAR_SPEED;

  damage = 0;
  shieldLevel = SHIELD_MAX_LEVEL; // 0 = broken, 10 = full
  invincible = false;
  inputDisabled = false;

  private iframeTween: Phaser.Tweens.Tween | null = null;
  private knockTween: Phaser.Tweens.Tween | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private inputManager: InputManager | null = null;

  constructor(scene: Phaser.Scene, textureKey: string) {
    this.scene = scene;

    // Create sprite with the chosen skin texture
    const key = scene.textures.exists(textureKey) ? textureKey : FALLBACK_TEXTURE;
    this.sprite = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 60, key);
    this.applySizeNormalization();
    this.sprite.setDepth(10);

    this.cursors = scene.input.keyboard!.createCursorKeys();
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  get shieldActive(): boolean { return this.shieldLevel > 0; }

  setInputManager(manager: InputManager): void {
    this.inputManager = manager;
  }

  /** Swap skin texture mid-game */
  setSkin(textureKey: string): void {
    const key = this.scene.textures.exists(textureKey) ? textureKey : FALLBACK_TEXTURE;
    this.sprite.setTexture(key);
    this.applySizeNormalization();
  }

  /** Scale sprite to consistent CAR_RENDER_SIZE, preserving aspect ratio */
  private applySizeNormalization(): void {
    const frame = this.sprite.frame;
    const maxDim = Math.max(frame.width, frame.height);
    if (maxDim > 0) {
      const scale = CAR_RENDER_SIZE / maxDim;
      this.sprite.setScale(scale);
    }
  }

  update(dt: number): void {
    if (this.inputDisabled || this.knockTween?.isPlaying()) return;

    let vx: number;
    let vy: number;

    if (this.inputManager) {
      ({ vx, vy } = this.inputManager.getDirection(this.x, this.y));
    } else {
      // Fallback: direct keyboard read (no InputManager)
      vx = 0;
      vy = 0;
      if (this.cursors.left.isDown) vx = -1;
      if (this.cursors.right.isDown) vx = 1;
      if (this.cursors.up.isDown) vy = -1;
      if (this.cursors.down.isDown) vy = 1;
      if (vx !== 0 && vy !== 0) {
        const inv = 1 / Math.SQRT2;
        vx *= inv;
        vy *= inv;
      }
    }

    const r = CAR_DIAMETER / 2;
    this.sprite.x = Phaser.Math.Clamp(
      this.sprite.x + vx * this.speed * dt,
      r, GAME_WIDTH - r,
    );
    this.sprite.y = Phaser.Math.Clamp(
      this.sprite.y + vy * this.speed * dt,
      r, GAME_HEIGHT - r,
    );
  }

  /** Start invincibility frames with flicker */
  startIFrames(durationMs: number): void {
    this.invincible = true;
    this.iframeTween?.destroy();

    this.iframeTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.3, to: 1 },
      duration: 80,
      yoyo: true,
      repeat: Math.floor(durationMs / 160),
      onComplete: () => {
        this.invincible = false;
        this.sprite.alpha = 1;
      },
    });
  }

  /** Apply shield damage from meteor impact. Returns remaining shield level. */
  applyShieldHit(meteorDiameter: number, meteorX: number, meteorY: number): number {
    const impact = Math.ceil(meteorDiameter / SHIELD_IMPACT_DIVISOR);
    this.shieldLevel = Math.max(0, this.shieldLevel - impact);
    this.applyKnockback(meteorX, meteorY);
    this.startIFrames(IFRAME_BIG_MS);
    this.scene.cameras.main.shake(150, 0.01);
    return this.shieldLevel;
  }

  /** Apply damage from a small meteor (no shield involved) */
  applySmallDamage(meteorDiameter: number): boolean {
    this.damage = Math.min(this.damage + meteorDiameter, 100);
    this.startIFrames(IFRAME_SMALL_MS);
    return this.damage >= 100;
  }

  /** Repair shield by amount, capped at max */
  repairShield(amount: number): void {
    this.shieldLevel = Math.min(SHIELD_MAX_LEVEL, this.shieldLevel + amount);
  }

  private applyKnockback(fromX: number, fromY: number): void {
    const dx = this.sprite.x - fromX;
    const dy = this.sprite.y - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    const r = CAR_DIAMETER / 2;
    const targetX = Phaser.Math.Clamp(this.sprite.x + nx * KNOCK_DISTANCE, r, GAME_WIDTH - r);
    const targetY = Phaser.Math.Clamp(this.sprite.y + ny * KNOCK_DISTANCE, r, GAME_HEIGHT - r);

    this.knockTween?.destroy();
    this.knockTween = this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      duration: KNOCK_DURATION_MS,
      ease: 'Power2',
    });
  }

  reset(): void {
    this.sprite.x = GAME_WIDTH / 2;
    this.sprite.y = GAME_HEIGHT - 60;
    this.sprite.alpha = 1;
    this.damage = 0;
    this.shieldLevel = SHIELD_MAX_LEVEL;
    this.invincible = false;
    this.inputDisabled = false;
    this.iframeTween?.destroy();
    this.knockTween?.destroy();
  }

  destroy(): void {
    this.iframeTween?.destroy();
    this.knockTween?.destroy();
    this.sprite.destroy();
  }
}
