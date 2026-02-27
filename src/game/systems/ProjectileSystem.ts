import Phaser from 'phaser';
import { Meteor } from '../entities/Meteor';
import {
  PROJECTILE_SPEED, PROJECTILE_RADIUS,
  MUZZLE_OFFSET_X, MUZZLE_OFFSET_Y,
  AMMO_FIRE_INTERVALS, AMMO_LV3_DAMAGE,
  ULTRA_FIRE_INTERVAL_MS, ULTRA_LV2_DAMAGE, ULTRA_MUZZLE_DIST,
  GAME_WIDTH, GAME_HEIGHT,
  MAX_PROJECTILES,
} from '../GameConfig';

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  damage: number;
}

export interface ProjectileHitEvent {
  meteor: Meteor;
  x: number;
  y: number;
  destroyed: boolean;
}

// Normalized direction vectors
const S2 = Math.SQRT2 / 2; // ~0.707
const DIR_NW: [number, number] = [-S2, -S2];
const DIR_NE: [number, number] = [S2, -S2];
const DIR_N:  [number, number] = [0, -1];
const DIR_S:  [number, number] = [0, 1];
const DIR_E:  [number, number] = [1, 0];
const DIR_W:  [number, number] = [-1, 0];
const DIR_SE: [number, number] = [S2, S2];
const DIR_SW: [number, number] = [-S2, S2];

const ULTRA_LV1_DIRS: [number, number][] = [DIR_NW, DIR_NE];
const ULTRA_LV2_DIRS: [number, number][] = [DIR_N, DIR_S, DIR_E, DIR_W, DIR_NE, DIR_NW, DIR_SE, DIR_SW];

export class ProjectileSystem {
  ammoLevel = 0;  // 0 = off, 1–3 = equipped levels
  ultraLevel = 0; // 0 = off, 1–2 active (3 = coming soon stub)

  private scene: Phaser.Scene;
  private projectiles: Projectile[] = [];
  private ammoFireTimer = 0;
  private ultraFireTimer = 0;

  get active(): boolean { return this.ammoLevel > 0 || this.ultraLevel > 0; }

  private get ammoFireIntervalMs(): number {
    return AMMO_FIRE_INTERVALS[this.ammoLevel] ?? 500;
  }

  private get ammoHitDamage(): number {
    return this.ammoLevel >= 3 ? AMMO_LV3_DAMAGE : 1;
  }

  private get ultraHitDamage(): number {
    return this.ultraLevel >= 2 ? ULTRA_LV2_DAMAGE : 1;
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

    // Ammo auto-fire timer
    if (this.ammoLevel > 0) {
      this.ammoFireTimer -= dt * 1000;
      if (this.ammoFireTimer <= 0) {
        this.fireAmmo(carX, carY);
        this.ammoFireTimer = this.ammoFireIntervalMs;
      }
    }

    // Ultra auto-fire timer
    if (this.ultraLevel > 0) {
      this.ultraFireTimer -= dt * 1000;
      if (this.ultraFireTimer <= 0) {
        this.fireUltra(carX, carY);
        this.ultraFireTimer = ULTRA_FIRE_INTERVAL_MS;
      }
    }

    // Move + collide
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;

      // Off-screen removal (all edges)
      if (p.sprite.y < -20 || p.sprite.y > GAME_HEIGHT + 20 ||
          p.sprite.x < -20 || p.sprite.x > GAME_WIDTH + 20) {
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
          const destroyed = m.takeDamage(p.damage);
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

  private fireAmmo(carX: number, carY: number): void {
    const y = carY + MUZZLE_OFFSET_Y;
    const dmg = this.ammoHitDamage;
    const red = this.ammoLevel >= 3;
    this.spawnProjectile(carX - MUZZLE_OFFSET_X, y, 0, -PROJECTILE_SPEED, dmg, red);
    this.spawnProjectile(carX + MUZZLE_OFFSET_X, y, 0, -PROJECTILE_SPEED, dmg, red);
  }

  private fireUltra(carX: number, carY: number): void {
    const dirs = this.ultraLevel >= 2 ? ULTRA_LV2_DIRS : ULTRA_LV1_DIRS;
    const dmg = this.ultraHitDamage;
    const red = this.ultraLevel >= 2;

    for (const [dx, dy] of dirs) {
      this.spawnProjectile(
        carX + dx * ULTRA_MUZZLE_DIST,
        carY + dy * ULTRA_MUZZLE_DIST,
        dx * PROJECTILE_SPEED,
        dy * PROJECTILE_SPEED,
        dmg, red,
      );
    }
  }

  private spawnProjectile(
    x: number, y: number,
    vx: number, vy: number,
    damage: number, red: boolean,
  ): void {
    if (this.projectiles.length >= MAX_PROJECTILES) return;

    const sprite = this.scene.add.image(x, y, 'projectile');
    sprite.setDepth(8);
    if (red) sprite.setTint(0xff4444);
    // Rotate sprite to face direction of travel
    sprite.setRotation(Math.atan2(vy, vx) + Math.PI / 2);
    this.projectiles.push({ sprite, vx, vy, damage });
  }

  clearAll(): void {
    for (const p of this.projectiles) p.sprite.destroy();
    this.projectiles = [];
    this.ammoFireTimer = 0;
    this.ultraFireTimer = 0;
  }

  reset(): void {
    this.clearAll();
    this.ammoLevel = 0;
    this.ultraLevel = 0;
  }
}
