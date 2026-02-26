import Phaser from 'phaser';
import { Car } from '../entities/Car';
import { MeteorManager } from '../systems/MeteorManager';
import { PowerupManager } from '../systems/PowerupManager';
import { DifficultyManager } from '../systems/DifficultyManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { StageSystem } from '../systems/StageSystem';
import { settingsStore } from '../systems/SettingsStore';
import { GAME_WIDTH, GAME_HEIGHT } from '../GameConfig';
import { AudioManager } from '../systems/AudioManager';
import { StageTransitionFX } from '../vfx/StageTransitionFX';
import { HitVFX } from '../vfx/HitVFX';
import { NearMissVFX } from '../vfx/NearMissVFX';
import { HUD } from '../../ui/hud';
import { spawnConfetti } from '../../ui/confetti';
import skinsManifest from '../../assets/skins/skins.json';
import meteorsManifest from '../../assets/meteors/meteors.json';
import { LootManager } from '../systems/LootManager';
import { UltimateModeSystem } from '../systems/UltimateModeSystem';
import type { LootType } from '../entities/Loot';
import powerupsManifest from '../../assets/powerups/powerups.json';
import lootManifest from '../../assets/loot/loot.json';

export interface SkinEntry {
  id: string;
  name: string;
  file: string;
}

export interface MeteorEntry {
  id: string;
  name: string;
  file: string;
}

export interface PowerupEntry {
  id: string;
  name: string;
  file: string;
}

export interface LootEntry {
  id: string;
  name: string;
  file: string;
}

// Shield arc tuning
const SHIELD_ARC_RADIUS = 24;
const SHIELD_ARC_THICKNESS = 2;
const SHIELD_ARC_SPAN_DEG = 130; // total arc span in degrees
const SHIELD_ARC_OFFSET_Y = -12; // offset upward from car center
const SHIELD_PULSE_SPEED = 3; // oscillation speed (radians/s)

// Shield color bands by level
function shieldColor(level: number): { core: number; mid: number; haze: number } {
  if (level <= 3) {
    // Red band
    return { core: 0xff6666, mid: 0xff4444, haze: 0xff2222 };
  } else if (level <= 7) {
    // Orange band
    return { core: 0xffbb44, mid: 0xffaa22, haze: 0xff8800 };
  }
  // Blue band (8-10)
  return { core: 0x88eeff, mid: 0x44ddff, haze: 0x00ccff };
}

export class GameScene extends Phaser.Scene {
  car!: Car;
  private meteorManager!: MeteorManager;
  private powerupManager!: PowerupManager;
  private lootManager!: LootManager;
  private difficultyManager!: DifficultyManager;
  private collisionSystem!: CollisionSystem;
  private scoreSystem!: ScoreSystem;
  private stageSystem!: StageSystem;
  private ultimateSystem!: UltimateModeSystem;
  hud!: HUD;

  private gameOver = false;
  private freezeTimer = 0;
  private restarting = false;

  // Loot counters (reset per run)
  private goldCount = 0;
  private diamondCount = 0;
  private rubyCount = 0;

  private stars: Phaser.GameObjects.Arc[][] = [];
  private meteorTextureKeys: string[] = [];
  private powerupTextureKeys: string[] = [];

  // Shield arc graphics
  private shieldGfx: Phaser.GameObjects.Graphics | null = null;
  private shieldTime = 0; // for pulse animation
  private shieldFlareTimer = 0; // brief flare on hit

  // VFX systems
  private stageTransitionFX!: StageTransitionFX;
  private nearMissVFX!: NearMissVFX;

  // Audio
  private audio!: AudioManager;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load all skin textures
    for (const skin of skinsManifest as SkinEntry[]) {
      this.load.image(`skin_${skin.id}`, `assets/skins/${skin.file}`);
    }

    // Load all meteor textures
    for (const m of meteorsManifest as MeteorEntry[]) {
      const key = `meteor:${m.id}`;
      this.load.image(key, `assets/meteors/${m.file}`);
    }

    // Load all powerup textures
    for (const p of powerupsManifest as PowerupEntry[]) {
      const key = `powerup:${p.id}`;
      this.load.image(key, `assets/powerups/${p.file}`);
    }

    // Load all loot textures
    for (const l of lootManifest as LootEntry[]) {
      const key = `loot:${l.id}`;
      this.load.image(key, `assets/loot/${l.file}`);
    }

    // Load audio
    this.load.audio('music:game_on', 'assets/music/game_on.mp3');
    this.load.audio('music:game_over', 'assets/music/game_over.mp3');
    this.load.audio('sfx:crash', 'assets/music/crash.mp3');
  }

  create(): void {
    this.createStarfield();

    // Build list of meteor texture keys
    this.meteorTextureKeys = (meteorsManifest as MeteorEntry[]).map(m => `meteor:${m.id}`);

    // Build list of powerup texture keys
    this.powerupTextureKeys = (powerupsManifest as PowerupEntry[]).map(p => `powerup:${p.id}`);

    // Generate fallback textures
    this.generateFallbackTextures();

    // Car with saved skin
    const savedSkin = settingsStore.get().selectedSkinId;
    this.car = new Car(this, `skin_${savedSkin}`);

    // Meteor manager with available texture keys
    this.meteorManager = new MeteorManager(this, this.meteorTextureKeys);
    this.powerupManager = new PowerupManager(this, this.powerupTextureKeys);

    // Build loot texture key map: lootId → texture key
    const lootTexKeys = new Map<string, string>();
    for (const l of lootManifest as LootEntry[]) {
      lootTexKeys.set(l.id, `loot:${l.id}`);
    }
    this.lootManager = new LootManager(this, lootTexKeys);

    this.difficultyManager = new DifficultyManager();
    this.collisionSystem = new CollisionSystem();
    this.scoreSystem = new ScoreSystem();
    this.stageSystem = new StageSystem();
    this.ultimateSystem = new UltimateModeSystem();
    this.hud = new HUD(this);

    // VFX systems
    HitVFX.ensureTextures(this);
    this.stageTransitionFX = new StageTransitionFX(this, this.car);
    this.nearMissVFX = new NearMissVFX(this);

    // Audio
    this.audio = new AudioManager(this);
    this.audio.init();
    this.audio.applyMuteState(settingsStore.get().muted);
    this.audio.playGameOn();

    this.gameOver = false;
    this.freezeTimer = 0;
    this.restarting = false;
    this.shieldTime = 0;
    this.shieldFlareTimer = 0;
    this.goldCount = 0;
    this.diamondCount = 0;
    this.rubyCount = 0;

    this.difficultyManager.pickForStage(1);
    this.updateHUD();

    this.input.keyboard!.on('keydown-R', () => {
      if (this.gameOver && !this.restarting) this.restartGame();
    });

    // Create shield graphics object
    this.shieldGfx = this.add.graphics();
    this.shieldGfx.setDepth(9);
    this.drawShieldArc();
  }

  update(_time: number, delta: number): void {
    // Freeze frame runs even after gameOver flag is set, to trigger the overlay
    if (this.freezeTimer > 0) {
      this.freezeTimer -= delta;
      if (this.freezeTimer <= 0) this.showGameOver();
      return;
    }

    if (this.gameOver) return;

    const dt = delta / 1000;

    this.updateStarfield(dt);

    const stageChanged = this.stageSystem.update(delta);
    if (stageChanged) {
      this.difficultyManager.pickForStage(this.stageSystem.stage);
      this.meteorManager.clearAll();
      this.stageTransitionFX.play(() => {
        spawnConfetti(this.hud.timerElement, 12, 900);
      });
    }

    this.car.update(dt);

    const settings = settingsStore.get();
    const intensity = settings.useStagePresets
      ? this.difficultyManager.meteorIntensity
      : settings.meteorIntensity;
    const speed = settings.useStagePresets
      ? this.difficultyManager.trailSpeed
      : settings.trailSpeed;

    // Pause meteor spawning during stage transition
    if (!this.stageTransitionFX.active) {
      this.meteorManager.update(dt, intensity, speed, this.car.x);
    }
    this.powerupManager.update(dt);
    this.lootManager.update(dt, this.meteorManager.meteors, this.car.x);

    // Meteor collisions — skip penalties during ultimate
    if (!this.ultimateSystem.active) {
      for (const meteor of this.meteorManager.meteors) {
        const result = this.collisionSystem.checkMeteor(this.car, meteor);
        if (result) {
          if (result.shieldHit) {
            this.playShieldHitEffect();
            HitVFX.spawnImpactStar(this, this.car.x, this.car.y);
            HitVFX.jiggleCar(this, this.car);
          }
          if (result.shieldBroken) {
            this.playShieldBreakEffect();
          }
          if (result.damageHit) {
            HitVFX.spawnImpactStar(this, this.car.x, this.car.y);
            HitVFX.jiggleCar(this, this.car);
            HitVFX.shakeForHit(this, false);
          }
          if (result.gameOver) {
            this.triggerGameOver();
            return;
          }
        }
      }
    }

    // Powerup collisions
    for (const powerup of this.powerupManager.powerups) {
      const result = this.collisionSystem.checkPowerup(this.car, powerup);
      if (result?.collected) {
        this.playPowerupCollectEffect(powerup.x, powerup.y);
      }
    }

    // Loot collisions (normal pickup)
    for (const loot of this.lootManager.loots) {
      const result = this.collisionSystem.checkLoot(this.car, loot);
      if (result?.collected) {
        this.collectLoot(result.lootType, loot.x, loot.y);
      }
    }

    // Loot magnet during ultimate
    if (this.ultimateSystem.active) {
      const magnetCollected = this.lootManager.magnetUpdate(dt, this.car.x, this.car.y);
      for (const l of magnetCollected) {
        this.collectLoot(l.lootType, l.sprite.x, l.sprite.y);
      }
    }

    // Near-miss scoring + VFX
    const nearMissEvents = this.scoreSystem.update(this.car, this.meteorManager.meteors);
    for (const evt of nearMissEvents) {
      this.nearMissVFX.spawn(evt.x, evt.y, evt.combo);
      this.hud.flashComboDelta(evt.combo);
    }

    // Ultimate mode: trigger on combo=100, tick down, handle end
    if (this.ultimateSystem.maybeTrigger(this.scoreSystem.comboLevel)) {
      this.stageSystem.paused = true;
    }
    const ultimateEnded = this.ultimateSystem.update(delta);
    if (ultimateEnded) {
      this.stageSystem.paused = false;
      this.scoreSystem.comboLevel = 0;
    }

    // Update shield arc position + pulse
    this.shieldTime += dt;
    if (this.shieldFlareTimer > 0) this.shieldFlareTimer -= dt;
    this.drawShieldArc();

    this.updateHUD();
  }

  private updateHUD(): void {
    const s = settingsStore.get();
    const label = s.useStagePresets
      ? this.difficultyManager.currentLabel
      : 'Custom';

    this.hud.update({
      timer: this.stageSystem.formatTime(),
      stage: this.stageSystem.stage,
      comboLevel: this.scoreSystem.comboLevel,
      damage: this.car.damage,
      difficultyLabel: label,
      blinkTimer: this.stageSystem.isLastTenSeconds,
      shieldLevel: this.car.shieldLevel,
      gold: this.goldCount,
      diamond: this.diamondCount,
      ruby: this.rubyCount,
      ultimateActive: this.ultimateSystem.active,
      ultimateProgress: this.ultimateSystem.progress,
    });
  }

  private triggerGameOver(): void {
    if (!this.textures.exists('spark')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xff6600);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture('spark', 8, 8);
      gfx.destroy();
    }

    const explosion = this.add.particles(this.car.x, this.car.y, 'spark', {
      speed: { min: 80, max: 250 },
      scale: { start: 1.5, end: 0 },
      lifespan: 500,
      quantity: 30,
      emitting: false,
    });
    explosion.explode(30);

    this.car.sprite.setVisible(false);
    this.shieldGfx?.setVisible(false);
    this.cameras.main.shake(200, 0.02);
    this.audio.playCrash();

    this.freezeTimer = 200;
    this.gameOver = true;
  }

  private showGameOver(): void {
    this.audio.playGameOver();
    this.hud.showGameOver(this.scoreSystem.comboLevel, this.stageSystem.stage);
  }

  restartGame(): void {
    if (this.restarting) return;
    this.restarting = true;

    this.hud.hideGameOver();
    this.audio.playGameOn();
    this.car.reset();
    this.car.sprite.setVisible(true);
    this.meteorManager.clearAll();
    this.powerupManager.clearAll();
    this.lootManager.clearAll();
    this.difficultyManager.reset();
    this.scoreSystem.reset();
    this.stageSystem.reset();
    this.ultimateSystem.reset();
    this.difficultyManager.pickForStage(1);
    this.gameOver = false;
    this.freezeTimer = 0;
    this.shieldTime = 0;
    this.shieldFlareTimer = 0;
    this.goldCount = 0;
    this.diamondCount = 0;
    this.rubyCount = 0;

    // Reset VFX
    this.nearMissVFX.reset();
    this.car.inputDisabled = false;

    // Re-show shield arc
    this.shieldGfx?.setVisible(true);
    this.drawShieldArc();

    this.updateHUD();
    this.restarting = false;
  }

  // ── Fallback textures ──

  private generateFallbackTextures(): void {
    if (!this.textures.exists('skin_default')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0x00ccff);
      gfx.fillTriangle(24, 2, 2, 46, 46, 46);
      gfx.fillStyle(0x0099cc);
      gfx.fillTriangle(24, 14, 14, 40, 34, 40);
      gfx.generateTexture('skin_default', 48, 48);
      gfx.destroy();
    }

    if (!this.textures.exists('meteor_fallback')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0x8B7355);
      gfx.fillCircle(32, 32, 28);
      gfx.fillStyle(0x6B5B45);
      gfx.fillCircle(24, 24, 12);
      gfx.generateTexture('meteor_fallback', 64, 64);
      gfx.destroy();
    }
  }

  // ── Shield Arc ──

  private drawShieldArc(): void {
    if (!this.shieldGfx) return;
    this.shieldGfx.clear();

    if (!this.car.shieldActive) {
      this.shieldGfx.setVisible(false);
      return;
    }
    this.shieldGfx.setVisible(true);

    // Pulse: oscillate alpha between 0.5 and 0.9
    const pulse = 0.7 + 0.2 * Math.sin(this.shieldTime * SHIELD_PULSE_SPEED);
    this.shieldGfx.setAlpha(pulse);

    // Flare effect on hit: briefly increase thickness
    const flareScale = this.shieldFlareTimer > 0 ? 1.8 : 1.0;

    const cx = this.car.x;
    const cy = this.car.y + SHIELD_ARC_OFFSET_Y;
    const halfSpan = (SHIELD_ARC_SPAN_DEG / 2) * Phaser.Math.DEG_TO_RAD;

    // Arc faces upward: center angle = -PI/2 (up)
    const centerAngle = -Math.PI / 2;
    const startAngle = centerAngle - halfSpan;
    const endAngle = centerAngle + halfSpan;

    // Get colors based on shield level
    const colors = shieldColor(this.car.shieldLevel);

    // Outer diffuse haze
    this.shieldGfx.lineStyle(8 * flareScale, colors.haze, 0.08);
    this.shieldGfx.beginPath();
    this.shieldGfx.arc(cx, cy, SHIELD_ARC_RADIUS, startAngle, endAngle, false);
    this.shieldGfx.strokePath();

    // Mid diffusion glow
    this.shieldGfx.lineStyle(4 * flareScale, colors.mid, 0.18);
    this.shieldGfx.beginPath();
    this.shieldGfx.arc(cx, cy, SHIELD_ARC_RADIUS, startAngle, endAngle, false);
    this.shieldGfx.strokePath();

    // Thin bright core
    this.shieldGfx.lineStyle(SHIELD_ARC_THICKNESS * flareScale, colors.core, 0.9);
    this.shieldGfx.beginPath();
    this.shieldGfx.arc(cx, cy, SHIELD_ARC_RADIUS, startAngle, endAngle, false);
    this.shieldGfx.strokePath();
  }

  private playShieldHitEffect(): void {
    // Brief flare on the arc
    this.shieldFlareTimer = 0.08; // 80ms
  }

  private playShieldBreakEffect(): void {
    // Quick particle burst at shield position
    if (!this.textures.exists('shield_shard')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0x00ccff);
      gfx.fillRect(0, 0, 6, 3);
      gfx.generateTexture('shield_shard', 6, 3);
      gfx.destroy();
    }

    const shardX = this.car.x;
    const shardY = this.car.y + SHIELD_ARC_OFFSET_Y;
    const shards = this.add.particles(shardX, shardY, 'shield_shard', {
      speed: { min: 60, max: 180 },
      angle: { min: 200, max: 340 }, // scatter upward-ish
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 400,
      quantity: 16,
      emitting: false,
    });
    shards.explode(16);

    // Hide the arc
    this.shieldGfx?.setVisible(false);
    this.cameras.main.shake(150, 0.01);
  }

  private collectLoot(type: LootType, lx: number, ly: number): void {
    if (type === 'gold') this.goldCount++;
    else if (type === 'diamond') this.diamondCount++;
    else if (type === 'ruby') this.rubyCount++;

    // Color per type
    const colors: Record<LootType, { text: string; hex: number }> = {
      gold: { text: '#ffcc00', hex: 0xffcc00 },
      diamond: { text: '#88ddff', hex: 0x88ddff },
      ruby: { text: '#ff5566', hex: 0xff5566 },
    };
    const c = colors[type];
    const label = type.charAt(0).toUpperCase() + type.slice(1);

    // Floating "+1 Gold" text
    const text = this.add.text(lx, ly, `+1 ${label}`, {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: c.text,
      stroke: '#000',
      strokeThickness: 2,
    });
    text.setOrigin(0.5);
    text.setDepth(15);

    this.tweens.add({
      targets: text,
      y: ly - 30,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Small sparkle burst
    if (!this.textures.exists('loot_spark')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xffcc00);
      gfx.fillCircle(2, 2, 2);
      gfx.generateTexture('loot_spark', 4, 4);
      gfx.destroy();
    }

    const sparks = this.add.particles(lx, ly, 'loot_spark', {
      speed: { min: 20, max: 80 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: c.hex,
      lifespan: 250,
      quantity: 6,
      emitting: false,
    });
    sparks.explode(6);
  }

  private playPowerupCollectEffect(px: number, py: number): void {
    // Floating "+1 Shield" text
    const text = this.add.text(px, py, '+1 Shield', {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: '#44ff44',
      stroke: '#000',
      strokeThickness: 2,
    });
    text.setOrigin(0.5);
    text.setDepth(15);

    this.tweens.add({
      targets: text,
      y: py - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Small sparkle burst
    if (!this.textures.exists('powerup_spark')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0x44ff44);
      gfx.fillCircle(3, 3, 3);
      gfx.generateTexture('powerup_spark', 6, 6);
      gfx.destroy();
    }

    const sparks = this.add.particles(px, py, 'powerup_spark', {
      speed: { min: 30, max: 100 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 300,
      quantity: 8,
      emitting: false,
    });
    sparks.explode(8);
  }

  // ── Starfield ──

  private createStarfield(): void {
    const layers = [
      { count: 40, size: 1, speed: 20, alpha: 0.4 },
      { count: 25, size: 1.5, speed: 40, alpha: 0.6 },
      { count: 15, size: 2, speed: 70, alpha: 0.8 },
    ];
    this.stars = [];
    for (const layer of layers) {
      const arr: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < layer.count; i++) {
        const s = this.add.circle(
          Phaser.Math.Between(0, GAME_WIDTH),
          Phaser.Math.Between(0, GAME_HEIGHT),
          layer.size, 0xffffff, layer.alpha,
        );
        s.setDepth(0);
        (s as any)._starSpeed = layer.speed;
        arr.push(s);
      }
      this.stars.push(arr);
    }
  }

  private updateStarfield(dt: number): void {
    for (const layer of this.stars) {
      for (const s of layer) {
        s.y += (s as any)._starSpeed * dt;
        if (s.y > GAME_HEIGHT + 4) {
          s.y = -4;
          s.x = Phaser.Math.Between(0, GAME_WIDTH);
        }
      }
    }
  }
}
