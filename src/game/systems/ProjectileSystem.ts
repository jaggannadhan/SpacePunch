import Phaser from 'phaser';
import { Meteor } from '../entities/Meteor';
import {
  PROJECTILE_SPEED, PROJECTILE_RADIUS,
  MUZZLE_OFFSET_X, MUZZLE_OFFSET_Y,
  AMMO_FIRE_INTERVALS, AMMO_LV3_DAMAGE,
} from '../GameConfig';

interface Projectile {
  sprite: Phaser.GameObjects.Image;
}

export interface ProjectileHitEvent {
  meteor: Meteor;
  x: number;
  y: number;
  destroyed: boolean;
}

export class ProjectileSystem {
  ammoLevel = 0; // 0 = off, 1–3 = equipped levels
  private scene: Phaser.Scene;
  private projectiles: Projectile[] = [];
  private fireTimer = 0;

  get active(): boolean { return this.ammoLevel > 0; }

  private get fireIntervalMs(): number {
    return AMMO_FIRE_INTERVALS[this.ammoLevel] ?? 500;
  }

  private get hitDamage(): number {
    return this.ammoLevel >= 3 ? AMMO_LV3_DAMAGE : 1;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureTexture();
  }

  private ensureTexture(): void {
    if (this.scene.textures.exists('projectile')) return;
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0xffffff);
    gfx.fillRect(1, 0, 2, 3);
    gfx.fillStyle(0xffff44);
    gfx.fillRect(0, 3, 4, 5);
    gfx.generateTexture('projectile', 4, 8);
    gfx.destroy();
  }

  update(dt: number, carX: number, carY: number, meteors: Meteor[]): ProjectileHitEvent[] {
    if (!this.active) return [];
    const events: ProjectileHitEvent[] = [];

    // Auto-fire timer
    this.fireTimer -= dt * 1000;
    if (this.fireTimer <= 0) {
      this.fire(carX, carY);
      this.fireTimer = this.fireIntervalMs;
    }

    // Move + collide
    const dmg = this.hitDamage;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.sprite.y -= PROJECTILE_SPEED * dt;

      // Off-screen removal
      if (p.sprite.y < -20) {
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Collision with meteors
      let hit = false;
      for (const m of meteors) {
        if (m.hasCollided || m.hp <= 0) continue;
        const dx = p.sprite.x - m.x;
        const dy = p.sprite.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < m.hitRadius + PROJECTILE_RADIUS) {
          const destroyed = m.takeDamage(dmg);
          events.push({ meteor: m, x: m.x, y: m.y, destroyed });
          p.sprite.destroy();
          this.projectiles.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    return events;
  }

  private fire(carX: number, carY: number): void {
    const y = carY + MUZZLE_OFFSET_Y;
    this.spawnProjectile(carX - MUZZLE_OFFSET_X, y);
    this.spawnProjectile(carX + MUZZLE_OFFSET_X, y);
  }

  private spawnProjectile(x: number, y: number): void {
    const sprite = this.scene.add.image(x, y, 'projectile');
    sprite.setDepth(8);
    // Red tint at level 3
    if (this.ammoLevel >= 3) {
      sprite.setTint(0xff4444);
    }
    this.projectiles.push({ sprite });
  }

  clearAll(): void {
    for (const p of this.projectiles) p.sprite.destroy();
    this.projectiles = [];
    this.fireTimer = 0;
  }

  reset(): void {
    this.clearAll();
    this.ammoLevel = 0;
  }
}
