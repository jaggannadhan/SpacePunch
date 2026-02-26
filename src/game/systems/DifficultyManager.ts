import Phaser from 'phaser';
import {
  DIFFICULTY_LABELS, DIFFICULTY_WEIGHTS, DIFFICULTY_PRESETS,
  DIFFICULTY_PROGRESS_STAGES, GOD_CHANCE, GOD_MIN_GAP,
  DifficultyLabel,
} from '../GameConfig';
import { settingsStore } from './SettingsStore';

export class DifficultyManager {
  currentLabel: DifficultyLabel = 'Lame';
  meteorIntensity = 2;
  trailSpeed = 2;

  private stagesSinceGod = GOD_MIN_GAP; // allow god from the start if rolled

  /** Called at start of each stage to pick difficulty */
  pickForStage(stageIndex: number): void {
    const s = settingsStore.get();

    if (!s.useStagePresets) {
      // Custom mode: use sliders directly
      this.meteorIntensity = s.meteorIntensity;
      this.trailSpeed = s.trailSpeed;
      this.currentLabel = 'Fun'; // placeholder label; UI will show "Custom"
      return;
    }

    const progress = Phaser.Math.Clamp(stageIndex / DIFFICULTY_PROGRESS_STAGES, 0, 1);

    // Build interpolated weights
    const weights: number[] = [];
    for (const label of DIFFICULTY_LABELS) {
      const [early, late] = DIFFICULTY_WEIGHTS[label];
      let w = Phaser.Math.Linear(early, late, progress);

      // God gating
      if (label === 'God') {
        if (this.stagesSinceGod < GOD_MIN_GAP) {
          w = 0;
        } else {
          w = Math.min(w, GOD_CHANCE + 0.01); // cap at ~3%
        }
      }
      weights.push(w);
    }

    // Normalize
    const total = weights.reduce((a, b) => a + b, 0);
    const norm = weights.map(w => w / total);

    // Weighted random pick
    let roll = Math.random();
    let picked = 0;
    for (let i = 0; i < norm.length; i++) {
      roll -= norm[i];
      if (roll <= 0) { picked = i; break; }
    }

    this.currentLabel = DIFFICULTY_LABELS[picked];

    // Update god tracker
    if (this.currentLabel === 'God') {
      this.stagesSinceGod = 0;
    } else {
      this.stagesSinceGod++;
    }

    // Apply preset with small jitter
    const [baseI, baseS] = DIFFICULTY_PRESETS[this.currentLabel];
    this.meteorIntensity = Phaser.Math.Clamp(baseI + Phaser.Math.Between(-1, 1), 1, 10);
    this.trailSpeed = Phaser.Math.Clamp(baseS + Phaser.Math.Between(-1, 1), 1, 10);
  }

  reset(): void {
    this.stagesSinceGod = GOD_MIN_GAP;
    this.currentLabel = 'Lame';
    this.meteorIntensity = 2;
    this.trailSpeed = 2;
  }
}
