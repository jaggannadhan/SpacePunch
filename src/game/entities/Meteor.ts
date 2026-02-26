import Phaser from 'phaser';
import {
  METEOR_HIT_RATIO, METEOR_HP_DIVISOR,
  DRIFT_MAX_VX, DRIFT_CHANGE_INTERVAL_MS, DRIFT_LERP_SPEED,
  GAME_HEIGHT,
} from '../GameConfig';

export class Meteor {
  sprite: Phaser.GameObjects.Image;
  diameter: number;
  hitRadius: number;

  vy: number; // downward speed (px/s)
  vx = 0;     // current horizontal drift
  private targetVx = 0;
  private driftTimer = 0;

  nearMissAwarded = 0; // highest tier points already awarded (0 = none)
  hasCollided = false;  // whether collision was already processed

  // HP system
  maxHp: number;
  hp: number;
  private scene: Phaser.Scene;
  private lifeBarGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    diameter: number,
    vy: number,
    textureKey: string,
  ) {
    this.scene = scene;
    this.diameter = diameter;
    this.hitRadius = diameter * METEOR_HIT_RATIO;
    this.vy = vy;
    this.maxHp = Math.max(1, Math.ceil(diameter / METEOR_HP_DIVISOR));
    this.hp = this.maxHp;

    // Create sprite and scale to match logical diameter
    this.sprite = scene.add.image(x, y, textureKey);
    const maxDim = Math.max(this.sprite.frame.width, this.sprite.frame.height);
    if (maxDim > 0) {
      this.sprite.setScale(diameter / maxDim);
    }
    this.sprite.setDepth(5);

    // Initial random drift
    this.targetVx = Phaser.Math.FloatBetween(-DRIFT_MAX_VX, DRIFT_MAX_VX);
    this.driftTimer = DRIFT_CHANGE_INTERVAL_MS;
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get isBig(): boolean { return this.diameter >= 40; }

  /** Reduce HP. Returns true if meteor is destroyed (hp <= 0). */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp <= 0;
  }

  update(dt: number): void {
    this.sprite.y += this.vy * dt;

    // Drift: smoothly lerp toward target
    this.vx = Phaser.Math.Linear(this.vx, this.targetVx, DRIFT_LERP_SPEED * dt);
    this.sprite.x += this.vx * dt;

    // Slow rotation for visual flair
    this.sprite.angle += 30 * dt;

    // Periodically pick new drift target
    this.driftTimer -= dt * 1000;
    if (this.driftTimer <= 0) {
      this.driftTimer = DRIFT_CHANGE_INTERVAL_MS + Phaser.Math.FloatBetween(-200, 200);
      this.targetVx = Phaser.Math.FloatBetween(-DRIFT_MAX_VX, DRIFT_MAX_VX);
    }

    // Draw life bar if damaged
    this.drawLifeBar();
  }

  isOffScreen(): boolean {
    return this.sprite.y > GAME_HEIGHT + this.diameter;
  }

  private drawLifeBar(): void {
    if (this.hp >= this.maxHp) return; // no bar until first hit
    if (!this.lifeBarGfx) {
      this.lifeBarGfx = this.scene.add.graphics();
      this.lifeBarGfx.setDepth(6);
    }
    this.lifeBarGfx.clear();
    const barW = Math.max(this.diameter * 0.8, 12);
    const barH = 3;
    const bx = this.sprite.x - barW / 2;
    const by = this.sprite.y - this.diameter / 2 - 6;

    // Background
    this.lifeBarGfx.fillStyle(0x333333, 0.7);
    this.lifeBarGfx.fillRect(bx, by, barW, barH);

    // Fill
    const pct = this.hp / this.maxHp;
    const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xcccc44 : 0xcc4444;
    this.lifeBarGfx.fillStyle(color, 0.9);
    this.lifeBarGfx.fillRect(bx, by, barW * pct, barH);
  }

  destroy(): void {
    this.lifeBarGfx?.destroy();
    this.sprite.destroy();
  }
}
