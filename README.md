```
 ____  ____   __    ___  ____    ____  _  _  _  _   ___  _   _
/ ___)(  _ \ / _\  / __)(  __)  (  _ \( )( )( \( ) / __)( )_( )
\___ \ )___//    \( (__  ) _)    ) __/ )()(  )  ( ( (__  ) _ (
(____/(__)  \_/\_/ \___)(____) (__)  \____/(_)\_) \___)(_) (_)
```

A pixelated top-down space-evade arcade game built with **Phaser 3**, **TypeScript**, and **Vite**. Dodge meteors, collect loot, rack up near-miss combos, and survive infinite stages.

## Quick Start

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

## Production Build

```bash
npm run build
npm run preview    # preview the production build
```

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Move the ship |
| R | Restart after game over |

## Gameplay

### Stages & Timer
Each stage lasts 60 seconds. The timer resets each stage and blinks red in the last 10 seconds. Stages are infinite.

### Scoring (Near-Miss Points)
Fly close to meteors without touching them:
- Gap < 5px — +5 points
- Gap < 8px — +3 points
- Gap < 10px — +1 point

Each meteor awards points once (highest tier reached). Floating "+N" text appears on near-misses.

### Combo & Ultimate Mode
Near-misses build a combo meter (0–100%). At 100%, **Ultimate Mode** triggers for 10 seconds — the stage timer pauses and all on-screen loot magnets toward your ship.

### Damage & Shield
- **Small meteors** (< 40px): add damage equal to their diameter. Reaching 100 damage = game over.
- **Big meteors** (≥ 40px): first hit breaks your shield and knocks you back. Second big hit with no shield = game over.
- Brief invincibility frames after any hit (car flickers).
- Shield displayed as a colored arc: red (1–3) → orange (4–7) → cyan (8–10).

### Loot
Two collectible types fall from the sky:
- **Gold** (78% drop rate) — spend 10 to upgrade ammunition
- **Diamonds** (22%) — spend 5 to activate Super Saiyan

**Rubies** don't fall — they only drop when you destroy a big meteor (diameter >= 45) with cannon fire (35% chance). Rubies pop in with a sparkle animation, drift with a gentle wobble, and fade out after 8 seconds if not collected. Collect 2 rubies to unlock Ultra Saiyan.

### Ammunition System
Upgrade your cannons with gold (10 per level, max 3):
| Level | Fire Rate | Damage |
|-------|-----------|--------|
| 1 | 500ms | 1 per hit |
| 2 | 100ms | 1 per hit |
| 3 | 100ms | 0.25 per hit (rapid red bolts) |

Projectiles destroy meteors based on their HP (`ceil(diameter / 12)`), triggering shatter VFX.

### Super Saiyan Mode
Activate with 5 diamonds for a timed infinite shield:
- **Level 1** (5+ diamonds): 1 charge × 20 seconds
- **Level 2** (10+ diamonds): 2 charges × 20 seconds (stacked)

While active, a cyan bubble shield absorbs all damage. Costs 5 diamonds per use, reusable whenever you have enough.

### Ultra Saiyan Mode
Unlocked with 2 rubies. Adds multi-directional cannon fire on top of existing ammunition:
- **Level 1** — Fires NW + NE diagonal shots at 0.1s interval
- **Level 2** — Fires in all 8 directions (N/S/E/W + diagonals) at 0.1s, red bolts dealing 0.25 damage each
- **Level 3** — Coming soon

Upgrading is free once unlocked — just click in the equip panel. Both ammunition and Ultra Saiyan fire independently.

### Difficulty
Each stage picks a difficulty via weighted random:

**Lame → Ok → Fun → Woah → Crazy → Pro → God**

Higher stages shift weights toward harder difficulties. "God" appears roughly 1 in 50 stages.

### Custom Settings
Click the gear icon to open settings:
- **Use Stage Presets** toggle — ON = automatic difficulty, OFF = custom mode
- **Meteor Intensity** (1–10) — controls spawn rate
- **Trail Speed** (1–10) — controls meteor fall speed
- **Ship Skins** — 8 selectable skins

## Architecture

```
src/
├── main.ts                           # Entry point + Phaser config
├── ui/
│   ├── hud.ts                        # DOM-based HUD overlay
│   ├── confetti.ts                   # Stage transition confetti
│   └── styles.css                    # All styling + animations
├── game/
│   ├── GameConfig.ts                 # Central constants
│   ├── entities/
│   │   ├── Car.ts                    # Player ship
│   │   ├── Meteor.ts                 # Falling meteors with HP
│   │   ├── Powerup.ts               # Shield repair pickups
│   │   └── Loot.ts                   # Gold / Diamond / Ruby
│   ├── scenes/
│   │   └── GameScene.ts             # Main game loop
│   ├── systems/
│   │   ├── AudioManager.ts          # Music + SFX
│   │   ├── CollisionSystem.ts       # Hit detection
│   │   ├── DifficultyManager.ts     # Stage-based scaling
│   │   ├── LootManager.ts           # Loot spawning + magnet
│   │   ├── MeteorManager.ts         # Meteor spawning
│   │   ├── PowerupManager.ts        # Powerup spawning
│   │   ├── ProjectileSystem.ts      # Ammunition + Ultra Saiyan firing
│   │   ├── ScoreSystem.ts           # Near-miss combos
│   │   ├── SettingsStore.ts         # LocalStorage persistence
│   │   ├── StageSystem.ts           # Timer + progression
│   │   ├── SuperSaiyanSystem.ts     # Infinite shield charges
│   │   └── UltimateModeSystem.ts    # Combo trigger
│   └── vfx/
│       ├── HitVFX.ts                # Impact stars + screen shake
│       ├── NearMissVFX.ts           # Floating score text
│       ├── ShatterVFX.ts            # Meteor destruction particles
│       └── StageTransitionFX.ts     # Hyperdrive + jet trails
└── assets/
    ├── skins/                        # 8 ship variants
    ├── meteors/                      # 5 meteor variants
    ├── powerups/                     # 3 tool variants
    ├── loot/                         # Gold, Diamond, Ruby
    └── music/                        # BGM + SFX
```

## Tech Stack

- **Phaser 3** — Game engine (canvas rendering, physics, tweens)
- **TypeScript** — Strict mode
- **Vite** — Dev server + bundler
- **Vercel Analytics** — Usage tracking
