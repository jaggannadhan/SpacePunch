import Phaser from 'phaser';

const MUSIC_VOLUME = 0.5;
const SFX_VOLUME = 0.7;
const DUCK_VOLUME = 0.2;
const DUCK_DURATION = 300;

export class AudioManager {
  private scene: Phaser.Scene;
  private gameOnMusic: Phaser.Sound.BaseSound | null = null;
  private gameOverMusic: Phaser.Sound.BaseSound | null = null;
  private crashSfx: Phaser.Sound.BaseSound | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Apply stored mute state to Phaser's global sound manager. */
  applyMuteState(muted: boolean): void {
    this.scene.sound.mute = muted;
  }

  init(): void {
    this.gameOnMusic = this.scene.sound.add('music:game_on', {
      loop: true,
      volume: MUSIC_VOLUME,
    });
    this.gameOverMusic = this.scene.sound.add('music:game_over', {
      loop: true,
      volume: MUSIC_VOLUME,
    });
    this.crashSfx = this.scene.sound.add('sfx:crash', {
      loop: false,
      volume: SFX_VOLUME,
    });
  }

  playGameOn(): void {
    this.stopAll();
    this.gameOnMusic?.play({ volume: MUSIC_VOLUME });
  }

  playCrash(): void {
    // Duck game_on music briefly so crash is heard clearly
    if (this.gameOnMusic?.isPlaying) {
      (this.gameOnMusic as Phaser.Sound.WebAudioSound).setVolume(DUCK_VOLUME);
      this.scene.time.delayedCall(DUCK_DURATION, () => {
        // Don't restore if we've already stopped it for game over
        if (this.gameOnMusic?.isPlaying) {
          (this.gameOnMusic as Phaser.Sound.WebAudioSound).setVolume(MUSIC_VOLUME);
        }
      });
    }
    this.crashSfx?.play();
  }

  playGameOver(): void {
    // Stop game_on, let crash finish naturally
    this.gameOnMusic?.stop();
    this.gameOverMusic?.play({ volume: MUSIC_VOLUME });
  }

  stopAll(): void {
    this.gameOnMusic?.stop();
    this.gameOverMusic?.stop();
    // Don't stop crash SFX — let it finish
  }
}
