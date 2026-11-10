import Phaser from 'phaser';
import { bakeBuilding } from '../art/buildings';
import { bakeCharacter, PLAYER_LOOK } from '../art/characters';
import { bakeGround } from '../art/ground';
import { bakeUi } from '../art/ui';
import plazaRaw from '../content/plaza.json';
import { parseMap, type MapDef } from '../content/schema';

export const MAP_KEY = 'map';

/** Validates content and bakes every texture once, then shows the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const map: MapDef = parseMap(plazaRaw);
    this.registry.set(MAP_KEY, map);

    bakeGround(this, map);
    for (const b of map.buildings) bakeBuilding(this, b);
    bakeCharacter(this, 'player', PLAYER_LOOK);
    bakeUi(this);

    const params = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && params.has('gallery')) {
      this.scene.start('Gallery');
      return;
    }
    // Tests can skip the title with ?play.
    this.scene.start(params.has('play') ? 'City' : 'Title');
  }
}
