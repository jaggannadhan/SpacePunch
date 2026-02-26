import Phaser from 'phaser';
import {
  METEOR_HIT_RATIO,
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

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    diameter: number,
    vy: number,
    textureKey: string,
  ) {
    this.diameter = diameter;
    this.hitRadius = diameter * METEOR_HIT_RATIO;
    this.vy = vy;

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
  }

  isOffScreen(): boolean {
    return this.sprite.y > GAME_HEIGHT + this.diameter;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
