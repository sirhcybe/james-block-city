import Phaser from 'phaser';
import { addBakedImage, bakeBlock, getBaked } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { characterFrameKey, FACINGS } from '../art/characters';
import { RS, WT } from '../art/renderScale';
import { PALETTE, type PaletteKey } from '../config';
import type { MapDef } from '../content/schema';
import { MAP_KEY } from './keys';

/** Dev-only (`?gallery`): sample blocks, buildings and character frames for a visual check. */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0).setBackgroundColor(0xe8ecf3);

    const colors: PaletteKey[] = [
      'policeBlue',
      'fireRed',
      'builderYellow',
      'harborTeal',
      'buildingWhite',
      'grass',
      'coinGold',
      'water',
    ];
    const sizes = [
      { w: 1, d: 1, h: 1 },
      { w: 2, d: 1, h: 1 },
      { w: 1, d: 2, h: 2 },
      { w: 2, d: 2, h: 0.5 },
    ];
    colors.forEach((c, i) => {
      sizes.forEach((sz, j) => {
        const meta = bakeBlock(this, { ...sz, color: PALETTE[c] });
        addBakedImage(this, meta, 80 + i * 150, 70 + j * 110);
      });
    });

    const map = this.registry.get(MAP_KEY) as MapDef;
    const seen = new Set<string>();
    let x = 120;
    for (const b of map.buildings) {
      const key = buildingTextureKey(b);
      if (seen.has(key)) continue;
      seen.add(key);
      addBakedImage(this, getBaked(key), x, 520);
      x += 150;
    }

    FACINGS.forEach((f, i) => {
      for (const fr of [0, 1] as const) {
        this.add
          .image(1100 + fr * 60, 60 + i * 90, characterFrameKey('player', f, fr))
          .setOrigin(0.5, 0)
          .setScale(1 / WT);
      }
    });
  }
}
