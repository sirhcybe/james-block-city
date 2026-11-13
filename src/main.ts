import Phaser from 'phaser';
import { RS } from './art/renderScale';
import { GAME_H, GAME_W, PALETTE } from './config';
import { installDebugHook } from './debug';
import { registerServiceWorker } from './pwa';
import { BootScene } from './scenes/BootScene';
import { BuildItScene } from './scenes/BuildItScene';
import { CityScene } from './scenes/CityScene';
import { GalleryScene } from './scenes/GalleryScene';
import { ApartmentScene } from './scenes/ApartmentScene';
import { BlockStackScene } from './scenes/BlockStackScene';
import { CementPourScene } from './scenes/CementPourScene';
import { CopyBuildScene } from './scenes/CopyBuildScene';
import { GrownUpScene } from './scenes/GrownUpScene';
import { HudScene } from './scenes/HudScene';
import { InteriorScene } from './scenes/InteriorScene';
import { JobCenterScene } from './scenes/JobCenterScene';
import { LadderRescueScene } from './scenes/LadderRescueScene';
import { WindowSplashScene } from './scenes/WindowSplashScene';
import { MissionBoardScene } from './scenes/MissionBoardScene';
import { ShopScene } from './scenes/ShopScene';
import { WhoTookItScene } from './scenes/WhoTookItScene';
import { TitleScene } from './scenes/TitleScene';
import { TrafficHelperScene } from './scenes/TrafficHelperScene';

const scenes: Phaser.Types.Scenes.SceneType[] = [
  BootScene,
  TitleScene,
  CityScene,
  HudScene,
  TrafficHelperScene,
  WhoTookItScene,
  MissionBoardScene,
  ShopScene,
  JobCenterScene,
  InteriorScene,
  WindowSplashScene,
  LadderRescueScene,
  BlockStackScene,
  CopyBuildScene,
  CementPourScene,
  BuildItScene,
  ApartmentScene,
  GrownUpScene,
];
if (import.meta.env.DEV) scenes.push(GalleryScene);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(GAME_W * RS),
  height: Math.round(GAME_H * RS),
  backgroundColor: PALETTE.water,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 3 },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  fps: { target: 60 },
  scene: scenes,
});

if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_HOOK === '1') installDebugHook(game);
if (import.meta.env.DEV && new URLSearchParams(location.search).has('drive'))
  void import('./driveTuning').then((m) => m.installDriveTuning());

registerServiceWorker();
