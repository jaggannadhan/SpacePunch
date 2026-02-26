import { SS_DIAMOND_LV1, SS_DIAMOND_LV2, INFINITE_SHIELD_DURATION_MS } from '../GameConfig';

export class SuperSaiyanSystem {
  private charges = 0;
  private shieldActive = false;
  private remainingMs = 0;

  /** Whether the infinite shield is currently active (absorbs all collisions). */
  get active(): boolean { return this.shieldActive; }

  /** Whether shields are running or queued (cannot re-activate while true). */
  get running(): boolean { return this.shieldActive || this.charges > 0; }

  /** Remaining time on the current shield charge (ms). */
  get remainingTime(): number { return this.remainingMs; }

  /** Total charges remaining (including the one currently running). */
  get totalCharges(): number {
    return this.charges + (this.shieldActive ? 1 : 0);
  }

  /** Compute the unlocked level from diamond count (0, 1, or 2). */
  static unlockedLevel(diamonds: number): number {
    if (diamonds >= SS_DIAMOND_LV2) return 2;
    if (diamonds >= SS_DIAMOND_LV1) return 1;
    return 0;
  }

  /** Activate Super Saiyan. Sets charges based on unlocked level and starts the first shield. */
  activate(diamonds: number): void {
    if (this.running) return;
    const level = SuperSaiyanSystem.unlockedLevel(diamonds);
    if (level === 0) return;

    // Level 1 → 1 charge total, Level 2 → 2 charges total
    // Start first shield immediately, remaining go into charges queue
    this.charges = level - 1;
    this.startShield();
  }

  /** Called every frame. Returns true when a shield just expired. */
  update(deltaMs: number): boolean {
    if (!this.shieldActive) return false;

    this.remainingMs -= deltaMs;
    if (this.remainingMs <= 0) {
      this.shieldActive = false;
      this.remainingMs = 0;

      // Start next charge if available
      if (this.charges > 0) {
        this.charges--;
        this.startShield();
      }
      return true; // a shield just ended
    }
    return false;
  }

  private startShield(): void {
    this.shieldActive = true;
    this.remainingMs = INFINITE_SHIELD_DURATION_MS;
  }

  reset(): void {
    this.charges = 0;
    this.shieldActive = false;
    this.remainingMs = 0;
  }
}
