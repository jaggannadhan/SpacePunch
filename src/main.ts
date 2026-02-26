import Phaser from 'phaser';
import { inject } from '@vercel/analytics';
import { GameScene } from './game/scenes/GameScene';
import { GAME_WIDTH, GAME_HEIGHT } from './game/GameConfig';
import './ui/styles.css';

inject();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0a1a',
  parent: 'game',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    keyboard: true,
  },
};

new Phaser.Game(config);
