# Space Punch

Pixelated top-down space-evade game. Dodge meteors, rack up near-miss points, and survive infinite stages.

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

- **Arrow Keys** — Move the car (up / down / left / right)
- **R** — Restart after game over

## How It Works

### Stages & Timer
Each stage lasts 60 seconds. The timer (top-left) resets each stage. In the last 10 seconds the timer blinks red. Stages are infinite.

### Scoring (Near-Miss Points)
Fly close to meteors without touching them:
- Gap < 12px → +1 point
- Gap < 8px  → +3 points
- Gap < 5px  → +5 points

Each meteor can only award points once (highest tier reached).

### Damage & Shield
- **Small meteors** (diameter < 40px): add damage equal to their diameter. Damage bar on the right side. Reaching 100 = game over.
- **Big meteors** (diameter ≥ 40px): first hit breaks your shield and knocks you back. Second big-meteor hit = game over.
- After any hit you get brief invincibility frames (car flickers).

### Difficulty
Each stage picks a difficulty via weighted random: Lame → Ok → Fun → Woah → Crazy → Pro → God.
Higher stages shift the weights toward harder difficulties. "God" appears ~1 in 50 stages.

### Custom Settings
Click the gear icon (bottom-left) to open settings:
- **Use Stage Presets** toggle: ON = automatic difficulty; OFF = custom mode.
- **Meteor Intensity** (1–10): controls spawn rate.
- **Trail Speed** (1–10): controls meteor fall speed.

When custom mode is active, sliders override stage presets.
