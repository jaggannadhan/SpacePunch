import Phaser from 'phaser';
import { Meteor } from '../entities/Meteor';
import {
  SHOCKWAVE_INTERVAL_MS,
  SHOCKWAVE_MAX_RADIUS,
  SHOCKWAVE_EXPAND_MS,
  SHOCKWAVE_RING_COLOR,
} from '../GameConfig';

export interface ShockwaveHitEvent {
  meteor: Meteor;
  x: number;
  y: number;
  destroyed: boolean;
}

export class PlasmaShockwave {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private pulseTimer = 0;

  // Active pulse state
  private pulsing = false;
  private pulseElapsed = 0;
  private pulseX = 0;
  private pulseY = 0;
  private processedMeteors: Set<Meteor> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(8);
  }

  update(dt: number, carX: number, carY: number, meteors: Meteor[]): ShockwaveHitEvent[] {
    const events: ShockwaveHitEvent[] = [];

    // Auto-fire timer
    this.pulseTimer -= dt * 1000;
    if (this.pulseTimer <= 0) {
      this.startPulse(carX, carY);
      this.pulseTimer = SHOCKWAVE_INTERVAL_MS;
    }

    // Expand active pulse
    if (this.pulsing) {
      this.pulseElapsed += dt * 1000;
      const t = this.pulseElapsed / SHOCKWAVE_EXPAND_MS;

      if (t >= 1) {
        this.pulsing = false;
        this.gfx.clear();
        this.processedMeteors.clear();
      } else {
        const radius = t * SHOCKWAVE_MAX_RADIUS;

        // Collide with meteors the ring has reached
        for (const m of meteors) {
          if (m.hasCollided || m.hp <= 0) continue;
          if (this.processedMeteors.has(m)) continue;

          const dx = m.x - this.pulseX;
          const dy = m.y - this.pulseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius + m.hitRadius) {
            this.processedMeteors.add(m);

            if (m.isBig) {
              // Halve HP for big meteors
              const newHp = Math.floor(m.hp / 2);
              if (newHp <= 0) {
                m.hp = 0;
                events.push({ meteor: m, x: m.x, y: m.y, destroyed: true });
              } else {
                m.hp = newHp;
                events.push({ meteor: m, x: m.x, y: m.y, destroyed: false });
              }
            } else {
              // Instantly destroy small meteors
              m.hp = 0;
              events.push({ meteor: m, x: m.x, y: m.y, destroyed: true });
            }
          }
        }

        this.drawRing(radius, 1 - t);
      }
    }

    return events;
  }

  private startPulse(x: number, y: number): void {
    this.pulsing = true;
    this.pulseElapsed = 0;
    this.pulseX = x;
    this.pulseY = y;
    this.processedMeteors.clear();
  }

  private drawRing(radius: number, alpha: number): void {
    this.gfx.clear();

    // Outer diffuse glow
    this.gfx.lineStyle(6, SHOCKWAVE_RING_COLOR, alpha * 0.15);
    this.gfx.strokeCircle(this.pulseX, this.pulseY, radius);

    // Mid glow
    this.gfx.lineStyle(3, SHOCKWAVE_RING_COLOR, alpha * 0.4);
    this.gfx.strokeCircle(this.pulseX, this.pulseY, radius);

    // Bright core ring
    this.gfx.lineStyle(1.5, 0xaaddff, alpha * 0.8);
    this.gfx.strokeCircle(this.pulseX, this.pulseY, radius);
  }

  clearAll(): void {
    this.pulsing = false;
    this.pulseTimer = 0;
    this.pulseElapsed = 0;
    this.processedMeteors.clear();
    this.gfx.clear();
  }
}
