// ── Tunable Constants ──

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const STAGE_DURATION_MS = 60_000;

export const CAR_DIAMETER = 40;
export const CAR_HIT_RADIUS = 15; // generous hitbox (~30px circle)
export const CAR_RENDER_SIZE = 48; // display size for skin sprites (px)
export const CAR_SPEED = 280; // px/s

export const METEOR_DIAMETER_MIN = 10;
export const METEOR_DIAMETER_MAX = 60;
export const METEOR_HIT_RATIO = 0.425; // hitRadius = (diameter/2) * 0.85

export const DAMAGE_MAX = 100;

// Shield level system (0 = broken, 10 = full)
export const SHIELD_MAX_LEVEL = 10;
export const SHIELD_IMPACT_DIVISOR = 12; // impact = ceil(diameter / 12)

// Powerup (repair icon) settings
export const POWERUP_RENDER_SIZE = 24; // display size (px)
export const POWERUP_HIT_RADIUS = 14;
export const POWERUP_SPEED = 50; // px/s downward
export const POWERUP_SPAWN_INTERVAL_MS = 8000; // base spawn interval
export const POWERUP_SPAWN_JITTER_MS = 4000; // random jitter ±

// Near-miss tiers (sorted outer→inner for first-match)
export const NEAR_MISS_TIERS = [
  { distance: 20, points: 1 },
  { distance: 15, points: 3 },
  { distance: 10, points: 5 },
] as const;

// Invincibility frames
export const IFRAME_SMALL_MS = 350;
export const IFRAME_BIG_MS = 600;

// Knockback on shield break
export const KNOCK_DISTANCE = 45;
export const KNOCK_DURATION_MS = 130;

// Spawn safety
export const SAFE_SPAWN_PADDING = 40;

// God difficulty gating
export const GOD_CHANCE = 0.02;
export const GOD_MIN_GAP = 10; // stages between god occurrences

// Difficulty labels in order
export const DIFFICULTY_LABELS = [
  'Lame', 'Ok', 'Fun', 'Woah', 'Crazy', 'Pro', 'God',
] as const;

export type DifficultyLabel = (typeof DIFFICULTY_LABELS)[number];

// Difficulty presets: [meteorIntensity, trailSpeed] each 1–10
export const DIFFICULTY_PRESETS: Record<DifficultyLabel, [number, number]> = {
  Lame:  [2, 2],
  Ok:    [3, 3],
  Fun:   [4, 4],
  Woah:  [5, 5],
  Crazy: [6, 6],
  Pro:   [8, 8],
  God:   [10, 10],
};

// Weighted random distribution: [early, late] weights per label
export const DIFFICULTY_WEIGHTS: Record<DifficultyLabel, [number, number]> = {
  Lame:  [0.30, 0.05],
  Ok:    [0.25, 0.10],
  Fun:   [0.20, 0.15],
  Woah:  [0.12, 0.20],
  Crazy: [0.08, 0.25],
  Pro:   [0.05, 0.23],
  God:   [0.02, 0.02],
};

// Progress curve: how many stages to reach full late-game weights
export const DIFFICULTY_PROGRESS_STAGES = 80;

// Meteor drift (pseudo-bounce)
export const DRIFT_CHANGE_INTERVAL_MS = 800; // how often drift target changes
export const DRIFT_MAX_VX = 40; // max horizontal px/s
export const DRIFT_LERP_SPEED = 3; // lerp factor per second

// Meteor speed scaling: base speed at trailSpeed=1 and per-step increase
export const METEOR_BASE_SPEED = 60; // px/s at trailSpeed 1
export const METEOR_SPEED_PER_LEVEL = 30; // additional px/s per level

// Spawn rate scaling
export const SPAWN_BASE_INTERVAL_MS = 1200; // ms between spawns at intensity 1
export const SPAWN_MIN_INTERVAL_MS = 100;   // fastest spawn rate
export const SPAWN_INTERVAL_REDUCTION = 100; // ms less per intensity level

export const MAX_METEORS_BASE = 6;
export const MAX_METEORS_PER_LEVEL = 3;

// ── VFX Tuning ──

// Stage Transition
export const STAGE_TRANSITION_DURATION_MS = 1100;
export const STAGE_HYPER_SCALE_UP = 1.15;
export const STAGE_HYPER_MOVE_UP = 80;

// Hit VFX
export const HIT_STAR_SCALE_START = 0.6;
export const HIT_STAR_SCALE_POP = 1.2;
export const HIT_STAR_SCALE_SETTLE = 1.0;
export const HIT_STAR_FADE_MS = 500;
export const HIT_JIGGLE_PX = 2;
export const HIT_JIGGLE_MS = 80;
export const HIT_SHAKE_SMALL: [number, number] = [0.004, 120];
export const HIT_SHAKE_BIG: [number, number] = [0.008, 160];

// Near-Miss VFX
export const NEAR_MISS_FLOAT_RISE = 15;
export const NEAR_MISS_FLOAT_DURATION = 600;
export const NEAR_MISS_MAX_ACTIVE = 3;

// ── Ultimate Mode ──
export const ULTIMATE_DURATION_MS = 10_000;
export const ULTIMATE_MAGNET_SPEED = 350; // px/s base attraction speed
export const ULTIMATE_MAGNET_ACCEL = 600; // px/s² acceleration as loot approaches

// ── Projectile / Ammunition ──
export const PROJECTILE_SPEED = 550; // px/s upward
export const PROJECTILE_RADIUS = 3;
export const MUZZLE_OFFSET_X = 12; // px left/right of car center
export const MUZZLE_OFFSET_Y = -20; // px above car center
export const METEOR_HP_DIVISOR = 12; // maxHp = ceil(diameter / divisor)
export const AMMO_MAX_LEVEL = 3;
export const AMMO_UPGRADE_COST = 10; // gold spent per upgrade
export const AMMO_FIRE_INTERVALS: Record<number, number> = {
  1: 500, // 0.5s
  2: 100, // 0.1s
  3: 100, // 0.1s (weighted/red)
};
export const AMMO_LV3_DAMAGE = 0.25; // damage per hit at level 3

// ── Ultra Saiyan ──
export const ULTRA_RUBY_GATE = 2;            // rubies needed to enable
export const ULTRA_MAX_LEVEL = 3;            // conceptual max (lv3 = coming soon)
export const ULTRA_FIRE_INTERVAL_MS = 100;   // 0.1s fire rate
export const ULTRA_LV2_DAMAGE = 0.25;        // same as weighted ammo
export const ULTRA_MUZZLE_DIST = 14;         // spawn offset from car center
export const MAX_PROJECTILES = 250;          // performance cap

// ── Plasma Shockwave (Ultra Lv3) ──
export const SHOCKWAVE_INTERVAL_MS = 1000;      // 1s between pulses
export const SHOCKWAVE_MAX_RADIUS = 160;        // max expansion radius px
export const SHOCKWAVE_EXPAND_MS = 400;         // ring expansion duration
export const SHOCKWAVE_RING_COLOR = 0x44aaff;   // blue tint

// ── Super Saiyan ──
export const SS_DIAMOND_LV1 = 5;   // diamonds needed to unlock level 1
export const SS_DIAMOND_LV2 = 10;  // diamonds needed to unlock level 2
export const INFINITE_SHIELD_DURATION_MS = 20_000; // 20s per charge
export const SS_BUBBLE_RADIUS = 31; // bubble around car (CAR_RENDER_SIZE * 0.65)
export const SS_BUBBLE_RINGS = 12;  // concentric rings for inward diffusion
export const SS_BUBBLE_PULSE_SPEED = 4.5; // radians/s for shimmer

// ── Loot (collectibles) ──
export const LOOT_RENDER_SIZE = CAR_RENDER_SIZE * 0.5; // half the car
export const LOOT_HIT_RADIUS = 12;
export const LOOT_SPEED = 45; // px/s downward (slightly slower than meteors)
export const LOOT_SPAWN_MIN_MS = 2500;
export const LOOT_SPAWN_MAX_MS = 5000;
export const LOOT_SAFE_DISTANCE = 60; // min px from big meteor at spawn
// Weighted spawn distribution (falling loot only — ruby excluded, drops from big meteors)
export const LOOT_WEIGHTS: { id: string; weight: number }[] = [
  { id: 'gold', weight: 0.78 },
  { id: 'diamond', weight: 0.22 },
];

// Ruby drops (only from big meteor kills by cannon fire)
export const BIG_METEOR_RUBY_THRESHOLD = 45; // min meteor diameter to drop ruby
export const RUBY_DROP_CHANCE = 0.35;         // 35% chance per qualifying kill
export const RUBY_LIFETIME_MS = 8000;         // 8s before fade-out
export const RUBY_DRIFT_VY = 15;              // slow downward drift px/s
export const RUBY_WOBBLE_SPEED = 25;          // horizontal wobble amplitude px/s
