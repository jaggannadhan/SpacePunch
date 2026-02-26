import { ULTIMATE_DURATION_MS } from '../GameConfig';

export class UltimateModeSystem {
  active = false;
  private remainingMs = 0;

  /** Total duration for progress bar calculation */
  get durationMs(): number {
    return ULTIMATE_DURATION_MS;
  }

  /** How many ms remain (for progress bar: elapsed = duration - remaining) */
  get remaining(): number {
    return this.remainingMs;
  }

  /** Progress 0→1 (for the HUD bar fill) */
  get progress(): number {
    if (!this.active) return 0;
    return 1 - this.remainingMs / ULTIMATE_DURATION_MS;
  }

  /** Call after combo updates. Returns true if ultimate just started. */
  maybeTrigger(comboLevel: number): boolean {
    if (this.active) return false;
    if (comboLevel < 100) return false;
    this.active = true;
    this.remainingMs = ULTIMATE_DURATION_MS;
    return true;
  }

  /** Tick down. Returns true if ultimate just ended this frame. */
  update(dtMs: number): boolean {
    if (!this.active) return false;
    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.active = false;
      return true; // just ended
    }
    return false;
  }

  reset(): void {
    this.active = false;
    this.remainingMs = 0;
  }
}
