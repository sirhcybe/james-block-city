import Phaser from 'phaser';
import { voice } from '../audio/voice';
import { bakeBuilding } from '../art/buildings';
import { bakeCharacter, LOOKS } from '../art/characters';
import { bakeGround } from '../art/ground';
import { bakeHud } from '../art/hud';
import { bakeMinigameArt } from '../art/minigame';
import { bakeProps } from '../art/props';
import { bakeUi } from '../art/ui';
import { GETAWAY_CAR, GETAWAY_EMPTY, POLICE_CAR, POLICE_VAN, bakeVehicle } from '../art/vehicles';
import { loadContent } from '../content';
import { loadWorld } from '../content/world';
import { GameState } from '../systems/GameState';
import { MAP_KEY, STATE_KEY } from './keys';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (private mode): play without saving
  }
}

/** Validates content, loads the save, and bakes every texture once; then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const map = loadWorld();
    const content = loadContent();
    this.registry.set(MAP_KEY, map);
    const state = new GameState(content, storage());
    this.registry.set(STATE_KEY, state);
    voice.setLines(content.voice);
    window.addEventListener('pagehide', () => state.save.flush());

    bakeGround(this, map);
    for (const b of map.buildings) bakeBuilding(this, b);
    for (const [name, look] of Object.entries(LOOKS)) bakeCharacter(this, name, look);
    for (const v of [POLICE_CAR, GETAWAY_CAR, GETAWAY_EMPTY, POLICE_VAN]) bakeVehicle(this, v);
    bakeProps(this);
    bakeUi(this);
    bakeHud(this);
    bakeMinigameArt(this);

    const params = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && params.has('gallery')) {
      this.scene.start('Gallery');
      return;
    }
    // Tests can skip the title with ?play.
    this.scene.start(params.has('play') ? 'City' : 'Title');
  }
}
