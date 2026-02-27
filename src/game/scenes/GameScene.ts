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
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ShatterVFX } from '../vfx/ShatterVFX';
import { PlasmaShockwave } from '../vfx/PlasmaShockwave';
import { SuperSaiyanSystem } from '../systems/SuperSaiyanSystem';
import { InputManager } from '../systems/InputManager';
import { Loot, type LootType } from '../entities/Loot';
import {
  AMMO_MAX_LEVEL, AMMO_UPGRADE_COST,
  SS_DIAMOND_LV1,
  SS_BUBBLE_RADIUS, SS_BUBBLE_RINGS, SS_BUBBLE_PULSE_SPEED,
  BIG_METEOR_RUBY_THRESHOLD, RUBY_DROP_CHANCE, RUBY_LIFETIME_MS,
  LOOT_RENDER_SIZE, ULTRA_RUBY_GATE,
} from '../GameConfig';
import {
  NEAR_MISS_WEIGHT, METEOR_BLAST_SMALL, METEOR_BLAST_BIG,
  GOLD_PICKUP, DIAMOND_PICKUP, RUBY_PICKUP, SHIELD_PICKUP,
} from '../systems/ScoreWeights';
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
  private projectileSystem!: ProjectileSystem;
  private plasmaShockwave!: PlasmaShockwave;
  private superSaiyanSystem!: SuperSaiyanSystem;
  private inputManager!: InputManager;
  hud!: HUD;

  private gameOver = false;
  private freezeTimer = 0;
  private restarting = false;
  private isGameStarted = false;

  // Loot counters (reset per run)
  private goldCount = 0;
  private diamondCount = 0;
  private rubyCount = 0;
  private totalScore = 0;

  private stars: Phaser.GameObjects.Arc[][] = [];
  private meteorTextureKeys: string[] = [];
  private powerupTextureKeys: string[] = [];

  // Shield arc graphics
  private shieldGfx: Phaser.GameObjects.Graphics | null = null;
  private shieldTime = 0; // for pulse animation
  private shieldFlareTimer = 0; // brief flare on hit

  // SS bubble shield graphics
  private bubbleGfx: Phaser.GameObjects.Graphics | null = null;
  private bubbleVisible = false;

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

    // Input manager (handles keyboard / gyro / touch)
    this.inputManager = new InputManager(this);

    // Car with saved skin
    const savedSkin = settingsStore.get().selectedSkinId;
    this.car = new Car(this, `skin_${savedSkin}`);
    this.car.setInputManager(this.inputManager);

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
    ShatterVFX.ensureTextures(this);
    this.stageTransitionFX = new StageTransitionFX(this, this.car);
    this.nearMissVFX = new NearMissVFX(this);

    // Projectile system
    this.projectileSystem = new ProjectileSystem(this);

    // Plasma shockwave (Ultra Lv3)
    this.plasmaShockwave = new PlasmaShockwave(this);

    // Super Saiyan system
    this.superSaiyanSystem = new SuperSaiyanSystem();

    // Audio
    this.audio = new AudioManager(this);
    this.audio.init();
    this.audio.applyMuteState(settingsStore.get().muted);

    this.gameOver = false;
    this.freezeTimer = 0;
    this.restarting = false;
    this.isGameStarted = false;
    this.shieldTime = 0;
    this.shieldFlareTimer = 0;
    this.goldCount = 0;
    this.diamondCount = 0;
    this.rubyCount = 0;
    this.totalScore = 0;

    this.difficultyManager.pickForStage(1);

    // Hide car + shield until game starts
    this.car.sprite.setVisible(false);
    this.car.inputDisabled = true;

    this.input.keyboard!.on('keydown-R', () => {
      if (this.gameOver && !this.restarting) this.restartGame();
    });

    // Create shield graphics object
    this.shieldGfx = this.add.graphics();
    this.shieldGfx.setDepth(9);
    this.shieldGfx.setVisible(false);

    // Create bubble shield graphics (SS)
    this.bubbleGfx = this.add.graphics();
    this.bubbleGfx.setDepth(9);
    this.bubbleGfx.setVisible(false);
    this.bubbleVisible = false;

    // Cleanup gyro listener on scene shutdown
    this.events.once('shutdown', () => this.inputManager.cleanup());

    // Show start overlay (game doesn't start until player clicks)
    this.hud.showStartOverlay();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // Starfield always animates (even before game starts)
    this.updateStarfield(dt);

    // Before game starts, nothing else runs
    if (!this.isGameStarted) return;

    // Freeze frame runs even after gameOver flag is set, to trigger the overlay
    if (this.freezeTimer > 0) {
      this.freezeTimer -= delta;
      if (this.freezeTimer <= 0) this.showGameOver();
      return;
    }

    if (this.gameOver) return;

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

    // Meteor collisions — skip penalties during ultimate or SS shield
    if (!this.ultimateSystem.active) {
      for (const meteor of this.meteorManager.meteors) {
        if (this.superSaiyanSystem.active) {
          // Infinite shield absorbs all: just mark collision, play minor VFX
          if (!meteor.hasCollided && !this.car.invincible) {
            const dx = this.car.x - meteor.x;
            const dy = this.car.y - meteor.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.car.hitRadius + meteor.hitRadius) {
              meteor.hasCollided = true;
              HitVFX.spawnImpactStar(this, this.car.x, this.car.y);
              HitVFX.jiggleCar(this, this.car);
            }
          }
          continue;
        }

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
        this.totalScore += SHIELD_PICKUP;
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

    // Projectile system: fire + collide with meteors
    const projHits = this.projectileSystem.update(
      dt, this.car.x, this.car.y, this.meteorManager.meteors,
    );
    for (const hit of projHits) {
      if (hit.destroyed) {
        this.totalScore += hit.meteor.isBig ? METEOR_BLAST_BIG : METEOR_BLAST_SMALL;
        ShatterVFX.spawn(this, hit.x, hit.y, hit.meteor.diameter);
        // Ruby drop from big meteor kills
        if (hit.meteor.diameter >= BIG_METEOR_RUBY_THRESHOLD && Math.random() < RUBY_DROP_CHANCE) {
          this.spawnRubyDrop(hit.x, hit.y);
        }
        hit.meteor.destroy();
        const idx = this.meteorManager.meteors.indexOf(hit.meteor);
        if (idx !== -1) this.meteorManager.meteors.splice(idx, 1);
      }
    }

    // Plasma shockwave (Ultra Lv3): expanding ring that destroys/halves meteors
    if (this.projectileSystem.ultraLevel >= 3) {
      const swHits = this.plasmaShockwave.update(
        dt, this.car.x, this.car.y, this.meteorManager.meteors,
      );
      for (const hit of swHits) {
        if (hit.destroyed) {
          this.totalScore += hit.meteor.isBig ? METEOR_BLAST_BIG : METEOR_BLAST_SMALL;
          ShatterVFX.spawn(this, hit.x, hit.y, hit.meteor.diameter);
          if (hit.meteor.diameter >= BIG_METEOR_RUBY_THRESHOLD && Math.random() < RUBY_DROP_CHANCE) {
            this.spawnRubyDrop(hit.x, hit.y);
          }
          hit.meteor.destroy();
          const idx = this.meteorManager.meteors.indexOf(hit.meteor);
          if (idx !== -1) this.meteorManager.meteors.splice(idx, 1);
        }
      }
    }

    // Near-miss scoring + VFX
    const nearMissEvents = this.scoreSystem.update(this.car, this.meteorManager.meteors);
    for (const evt of nearMissEvents) {
      this.totalScore += evt.combo * NEAR_MISS_WEIGHT;
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

    // Super Saiyan shield countdown
    const ssWasActive = this.superSaiyanSystem.active;
    this.superSaiyanSystem.update(delta);
    const ssNowActive = this.superSaiyanSystem.active;

    // SS bubble pop-in on activation
    if (!ssWasActive && ssNowActive && this.bubbleGfx) {
      this.bubbleGfx.setScale(0.8);
      this.tweens.add({
        targets: this.bubbleGfx,
        scaleX: 1, scaleY: 1,
        duration: 150,
        ease: 'Back.easeOut',
      });
    }

    // SS bubble fade-out when shield ends entirely
    if (ssWasActive && !ssNowActive && this.bubbleGfx) {
      this.bubbleVisible = false;
      this.tweens.add({
        targets: this.bubbleGfx,
        alpha: 0,
        duration: 200,
        onComplete: () => { this.bubbleGfx?.setVisible(false); },
      });
    }

    // Update shield arc position + pulse
    this.shieldTime += dt;
    if (this.shieldFlareTimer > 0) this.shieldFlareTimer -= dt;

    // Swap: bubble when SS active, normal arc otherwise
    if (ssNowActive) {
      this.shieldGfx?.setVisible(false);
      this.drawBubbleShield();
    } else {
      this.drawShieldArc();
    }

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
      ammoLevel: this.projectileSystem.ammoLevel,
      availableAmmoLevel: Math.min(
        Math.floor(this.goldCount / AMMO_UPGRADE_COST),
        AMMO_MAX_LEVEL - this.projectileSystem.ammoLevel,
      ),
      ssUnlockedLevel: SuperSaiyanSystem.unlockedLevel(this.diamondCount),
      ssRunning: this.superSaiyanSystem.running,
      ssShieldActive: this.superSaiyanSystem.active,
      ssRemainingMs: this.superSaiyanSystem.remainingTime,
      ssTotalCharges: this.superSaiyanSystem.totalCharges,
      ultraLevel: this.projectileSystem.ultraLevel,
      ultraEnabled: this.rubyCount >= ULTRA_RUBY_GATE,
      totalScore: this.totalScore,
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
    this.bubbleGfx?.setVisible(false);
    this.bubbleVisible = false;
    this.cameras.main.shake(200, 0.02);
    this.audio.playCrash();

    this.freezeTimer = 200;
    this.gameOver = true;
  }

  private showGameOver(): void {
    this.audio.playGameOver();
    this.hud.showGameOver(this.stageSystem.stage, this.totalScore);
  }

  /** Called by HUD when "Enter sector 1X1" is clicked. */
  onStartClicked(): void {
    if (this.inputManager.isMobile && InputManager.needsGyroPermission()) {
      // iOS: needs explicit permission — show gyro prompt
      this.hud.showGyroPrompt();
    } else if (this.inputManager.isMobile) {
      // Android / other mobile: enable gyro (auto-falls back to touch)
      this.inputManager.enableGyro();
      this.startRun();
    } else {
      // Desktop: keyboard controls
      this.startRun();
    }
  }

  /** Called by HUD gyro-permission buttons. */
  async onGyroChoice(enableGyro: boolean): Promise<void> {
    this.hud.hideGyroPrompt();
    if (enableGyro) {
      const granted = await this.inputManager.requestGyroPermission();
      if (granted) {
        this.inputManager.enableGyro();
      } else {
        this.inputManager.enableTouch();
      }
    } else {
      this.inputManager.enableTouch();
    }
    this.startRun();
  }

  /** Begin gameplay — called after input mode is resolved. */
  startRun(): void {
    this.isGameStarted = true;
    this.car.sprite.setVisible(true);
    this.car.inputDisabled = false;
    this.shieldGfx?.setVisible(true);
    this.drawShieldArc();
    this.audio.playGameOn();
    this.updateHUD();
  }

  upgradeAmmunition(): void {
    if (this.goldCount < AMMO_UPGRADE_COST) return;
    if (this.projectileSystem.ammoLevel >= AMMO_MAX_LEVEL) return;
    this.goldCount -= AMMO_UPGRADE_COST;
    this.projectileSystem.ammoLevel++;
    this.updateHUD();
  }

  activateSuperSaiyan(): void {
    if (this.superSaiyanSystem.running) return;
    if (this.diamondCount < SS_DIAMOND_LV1) return;
    this.diamondCount -= SS_DIAMOND_LV1; // costs 5 diamonds
    this.superSaiyanSystem.activate(this.diamondCount + SS_DIAMOND_LV1); // pass pre-deduction count for level calc
    this.updateHUD();
  }

  upgradeUltraSaiyan(): void {
    if (this.projectileSystem.ultraLevel >= 3) return; // max level
    if (this.rubyCount < ULTRA_RUBY_GATE) return;      // need 2 rubies
    this.rubyCount -= ULTRA_RUBY_GATE;                  // spend rubies
    this.projectileSystem.ultraLevel++;
    this.updateHUD();
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
    this.projectileSystem.reset();
    this.plasmaShockwave.clearAll();
    this.superSaiyanSystem.reset();
    this.difficultyManager.pickForStage(1);
    this.isGameStarted = true;
    this.gameOver = false;
    this.freezeTimer = 0;
    this.shieldTime = 0;
    this.shieldFlareTimer = 0;
    this.goldCount = 0;
    this.diamondCount = 0;
    this.rubyCount = 0;
    this.totalScore = 0;

    // Reset VFX + input
    this.nearMissVFX.reset();
    this.car.inputDisabled = false;
    this.inputManager.resetTouch();

    // Re-show shield arc, hide bubble
    this.shieldGfx?.setVisible(true);
    this.bubbleGfx?.setVisible(false);
    this.bubbleVisible = false;
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

  private drawBubbleShield(): void {
    if (!this.bubbleGfx) return;
    this.bubbleGfx.clear();

    if (!this.superSaiyanSystem.active) {
      this.bubbleGfx.setVisible(false);
      this.bubbleVisible = false;
      return;
    }

    this.bubbleGfx.setVisible(true);
    this.bubbleVisible = true;

    const cx = this.car.x;
    const cy = this.car.y;

    // Shimmer: oscillate alpha between 0.55 and 0.8
    const shimmer = 0.675 + 0.125 * Math.sin(this.shieldTime * SS_BUBBLE_PULSE_SPEED);
    this.bubbleGfx.setAlpha(shimmer);

    // Draw concentric rings from outer to inner with decreasing alpha
    // This creates an "inward diffusion" glow effect
    const outerR = SS_BUBBLE_RADIUS;
    const innerR = SS_BUBBLE_RADIUS * 0.45; // fade zone
    const n = SS_BUBBLE_RINGS;

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1); // 0 = outermost, 1 = innermost
      const r = outerR - t * (outerR - innerR);
      const alpha = 0.35 * (1 - t); // 0.35 at edge → 0 at center
      this.bubbleGfx.lineStyle(2, 0x44eeff, alpha);
      this.bubbleGfx.strokeCircle(cx, cy, r);
    }

    // Bright outer edge ring
    this.bubbleGfx.lineStyle(1.5, 0x88ffff, 0.6);
    this.bubbleGfx.strokeCircle(cx, cy, outerR);

    // Secondary glow just inside the edge
    this.bubbleGfx.lineStyle(2.5, 0x22ccff, 0.2);
    this.bubbleGfx.strokeCircle(cx, cy, outerR - 2);
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
    if (type === 'gold') { this.goldCount++; this.totalScore += GOLD_PICKUP; }
    else if (type === 'diamond') { this.diamondCount++; this.totalScore += DIAMOND_PICKUP; }
    else if (type === 'ruby') { this.rubyCount++; this.totalScore += RUBY_PICKUP; }

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

  private spawnRubyDrop(x: number, y: number): void {
    const ruby = new Loot(this, x, y, 'loot:ruby', 'ruby');
    ruby.setDropMode(RUBY_LIFETIME_MS);
    this.lootManager.loots.push(ruby);

    // Pop animation: scale 0.2 → 1.15 (120ms) → settle 1.0 (150ms)
    const maxDim = Math.max(ruby.sprite.frame.width, ruby.sprite.frame.height);
    const baseScale = maxDim > 0 ? LOOT_RENDER_SIZE / maxDim : 1;
    ruby.sprite.setScale(baseScale * 0.2);
    ruby.sprite.setAlpha(0.6);

    this.tweens.add({
      targets: ruby.sprite,
      scaleX: baseScale * 1.15,
      scaleY: baseScale * 1.15,
      alpha: 1,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: ruby.sprite,
          scaleX: baseScale,
          scaleY: baseScale,
          duration: 150,
          ease: 'Sine.easeOut',
        });
      },
    });

    // Sparkle burst
    if (!this.textures.exists('ruby_spark')) {
      const gfx = this.add.graphics();
      gfx.fillStyle(0xff5566);
      gfx.fillCircle(2, 2, 2);
      gfx.generateTexture('ruby_spark', 4, 4);
      gfx.destroy();
    }

    const sparks = this.add.particles(x, y, 'ruby_spark', {
      speed: { min: 30, max: 120 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff5566, 0xff8899, 0xffaacc],
      lifespan: 400,
      quantity: 8,
      emitting: false,
    });
    sparks.explode(8);
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
