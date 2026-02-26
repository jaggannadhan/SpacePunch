import { STAGE_DURATION_MS } from '../GameConfig';

export class StageSystem {
  stage = 1;
  elapsedMs = 0;
  paused = false;

  /** Returns remaining seconds for current stage */
  get remainingSeconds(): number {
    return Math.max(0, Math.ceil((STAGE_DURATION_MS - this.elapsedMs) / 1000));
  }

  get isLastTenSeconds(): boolean {
    return this.remainingSeconds <= 10;
  }

  /** Update timer. Returns true when stage just incremented. */
  update(dtMs: number): boolean {
    if (this.paused) return false;
    this.elapsedMs += dtMs;
    if (this.elapsedMs >= STAGE_DURATION_MS) {
      this.elapsedMs -= STAGE_DURATION_MS;
      this.stage++;
      return true; // stage changed
    }
    return false;
  }

  /** Format remaining time as MM:SS */
  formatTime(): string {
    const total = this.remainingSeconds;
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  reset(): void {
    this.stage = 1;
    this.elapsedMs = 0;
    this.paused = false;
  }
}
