import Phaser from 'phaser';
import {
  GYRO_DEADZONE_DEG, GYRO_MAX_TILT_DEG, GYRO_SMOOTHING, TOUCH_DEADZONE_PX,
} from '../GameConfig';

export type ControlMode = 'keyboard' | 'gyro' | 'touch';

/**
 * Unified input manager — handles keyboard, gyroscope, and touch-drag.
 * Provides a normalized direction vector { vx, vy } in the range [-1, 1].
 */
export class InputManager {
  mode: ControlMode = 'keyboard';
  readonly isMobile: boolean;

  // Keyboard
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  // Gyroscope (smoothed values)
  private smoothGamma = 0;
  private smoothBeta = 0;
  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private gyroReceived = false;

  // Touch-drag
  private touchActive = false;
  private touchX = 0;
  private touchY = 0;

  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.isMobile = InputManager.detectMobile();

    // Register Phaser pointer events for touch-drag (mobile only).
    // These always track position; getDirection() only uses them when mode === 'touch'.
    if (this.isMobile) {
      scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.touchActive = true;
        this.touchX = p.x;
        this.touchY = p.y;
      });
      scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (p.isDown) {
          this.touchActive = true;
          this.touchX = p.x;
          this.touchY = p.y;
        }
      });
      scene.input.on('pointerup', () => {
        this.touchActive = false;
      });
    }
  }

  // ── Detection helpers ──

  static detectMobile(): boolean {
    const ua = navigator.userAgent;
    if (/Mobi|Android|iPhone|iPad|iPod|tablet/i.test(ua)) return true;
    if (navigator.maxTouchPoints > 1) return true;
    return false;
  }

  /** Returns true if the platform requires an explicit user-gesture permission call (iOS). */
  static needsGyroPermission(): boolean {
    return typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function';
  }

  // ── Mode activation ──

  /** Request iOS DeviceOrientation permission. Must be called from a user gesture. */
  async requestGyroPermission(): Promise<boolean> {
    try {
      const result = await (DeviceOrientationEvent as any).requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  /** Start listening for deviceorientation events. Auto-falls back to touch if
   *  no events are received within 1 second (e.g. device has no gyroscope). */
  enableGyro(): void {
    this.mode = 'gyro';
    this.smoothGamma = 0;
    this.smoothBeta = 0;
    this.gyroReceived = false;

    this.orientationHandler = (e: DeviceOrientationEvent) => {
      this.gyroReceived = true;

      let gamma = e.gamma ?? 0; // left/right tilt
      let beta = e.beta ?? 0;   // forward/back tilt

      // Deadzone
      if (Math.abs(gamma) < GYRO_DEADZONE_DEG) gamma = 0;
      if (Math.abs(beta) < GYRO_DEADZONE_DEG) beta = 0;

      // Clamp
      gamma = Math.max(-GYRO_MAX_TILT_DEG, Math.min(GYRO_MAX_TILT_DEG, gamma));
      beta = Math.max(-GYRO_MAX_TILT_DEG, Math.min(GYRO_MAX_TILT_DEG, beta));

      // Low-pass filter (smoothing)
      this.smoothGamma = this.smoothGamma * GYRO_SMOOTHING + gamma * (1 - GYRO_SMOOTHING);
      this.smoothBeta = this.smoothBeta * GYRO_SMOOTHING + beta * (1 - GYRO_SMOOTHING);
    };

    window.addEventListener('deviceorientation', this.orientationHandler, { passive: true });

    // Auto-fallback: if no events received within 1s, assume no gyroscope
    setTimeout(() => {
      if (!this.gyroReceived && this.mode === 'gyro') {
        this.removeGyroListener();
        this.enableTouch();
      }
    }, 1000);
  }

  enableTouch(): void {
    this.mode = 'touch';
  }

  // ── Direction query ──

  /** Returns a normalised direction vector { vx, vy } in [-1, 1]. */
  getDirection(carX: number, carY: number): { vx: number; vy: number } {
    // Gyro mode
    if (this.mode === 'gyro') {
      return {
        vx: this.smoothGamma / GYRO_MAX_TILT_DEG,
        vy: this.smoothBeta / GYRO_MAX_TILT_DEG,
      };
    }

    // Touch-drag mode
    if (this.mode === 'touch' && this.touchActive) {
      const dx = this.touchX - carX;
      const dy = this.touchY - carY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TOUCH_DEADZONE_PX) return { vx: 0, vy: 0 };
      return { vx: dx / dist, vy: dy / dist };
    }

    // Keyboard (desktop fallback — always available)
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown) vx = -1;
    if (this.cursors.right.isDown) vx = 1;
    if (this.cursors.up.isDown) vy = -1;
    if (this.cursors.down.isDown) vy = 1;
    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }
    return { vx, vy };
  }

  // ── Cleanup ──

  resetTouch(): void {
    this.touchActive = false;
  }

  private removeGyroListener(): void {
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.orientationHandler = null;
    }
  }

  cleanup(): void {
    this.removeGyroListener();
    this.touchActive = false;
    this.smoothGamma = 0;
    this.smoothBeta = 0;
  }
}
