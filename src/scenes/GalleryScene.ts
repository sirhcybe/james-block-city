import Phaser from 'phaser';
import { addBakedImage, bakeBlock, getBaked } from '../art/blocks';
import { buildingTextureKey } from '../art/buildings';
import { characterFrameKey, FACINGS } from '../art/characters';
import { RS, WT } from '../art/renderScale';
import {
  GETAWAY_CAR,
  POLICE_CAR,
  POLICE_VAN,
  VEHICLE_DIRS,
  vehicleFrameKey,
  vehicleLightKey,
} from '../art/vehicles';
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
    const which = new URLSearchParams(location.search).get('gallery');
    if (which === 'vehicles') {
      this.vehicles();
      return;
    }
    if (which === 'all') {
      this.all();
      return;
    }

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
      for (const fr of [0, 1, 2] as const) {
        this.add
          .image(1100 + fr * 60, 60 + i * 90, characterFrameKey('player', f, fr))
          .setOrigin(0.5, 0)
          .setScale(1 / WT);
      }
    });
  }

  /**
   * `?gallery=all` (spec 009): every baked texture in a grid with its key, for checking the art by
   * eye. Scroll with the wheel, the arrow keys or by dragging. `&find=<text>` filters by key.
   */
  private all(): void {
    const find = new URLSearchParams(location.search).get('find') ?? '';
    const keys = this.textures
      .getTextureKeys()
      .filter((k) => !k.startsWith('ground:') && k.includes(find))
      .sort();
    const cell = 160;
    const cols = Math.floor(1280 / cell);
    keys.forEach((key, i) => {
      const x = (i % cols) * cell + cell / 2;
      const y = Math.floor(i / cols) * (cell + 18) + cell / 2 + 6;
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(1, (cell - 20) / src.width, (cell - 20) / src.height);
      this.add.image(x, y, key).setScale(k);
      this.add
        .text(x, y + cell / 2 - 2, key.slice(0, 26), { fontSize: '11px', color: '#2b2d42' })
        .setOrigin(0.5, 0);
    });
    const cam = this.cameras.main;
    const rows = Math.ceil(keys.length / cols);
    const max = Math.max(0, rows * (cell + 18) - 720);
    const scroll = (dy: number) => (cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, max));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => scroll(dy));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) scroll((p.prevPosition.y - p.y) / RS);
    });
    this.input.keyboard?.on('keydown-DOWN', () => scroll(240));
    this.input.keyboard?.on('keydown-UP', () => scroll(-240));
  }

  /** `?gallery=vehicles`: every vehicle in all 8 headings (lights on for the police ones). */
  private vehicles(): void {
    [POLICE_CAR, GETAWAY_CAR, POLICE_VAN].forEach((v, row) => {
      for (let d = 0; d < VEHICLE_DIRS; d++) {
        const x = 90 + d * 152;
        const y = 170 + row * 210;
        addBakedImage(this, getBaked(vehicleFrameKey(v.name, d, 0)), x, y);
        if (v.lightBar) addBakedImage(this, getBaked(vehicleLightKey(v.name, d, 1)), x, y);
      }
    });
  }
}
