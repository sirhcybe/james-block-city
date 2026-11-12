import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import type { IconName } from '../art/icons';
import { iconKey, MENU } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { ApartmentLayout, ROOM } from '../systems/apartment';
import type { GameState } from '../systems/GameState';
import { HATS } from '../systems/jobs';
import { STATE_KEY } from './keys';
import { closeMenu } from './minigameKit';

const CELL_W = 150;
const CELL_H = 92;
const FLOOR = { x: GAME_W / 2 - (ROOM.cols * CELL_W) / 2 + 60, y: 250 };
const TRAY_Y = 650;

/**
 * Your apartment (spec 006). A room with a 6×4 floor: drag furniture you own from the tray onto a
 * square, drag it around, or drag it back to the tray. One thing per square. The hat stand on the
 * left wears a hat you own (tap again to take it off). Everything is saved. Pictures only.
 */
export class ApartmentScene extends Phaser.Scene {
  private state!: GameState;
  private layout!: ApartmentLayout;
  private items: Phaser.GameObjects.Image[] = [];
  private hats: Phaser.GameObjects.GameObject[] = [];
  private changed = false;

  constructor() {
    super('Apartment');
  }

  private furniture(): string[] {
    return this.state.content.shop.filter((i) => i.tab === 'home').map((i) => i.id);
  }

  private icon(item: string): IconName {
    return (this.state.content.shop.find((i) => i.id === item)?.icon ?? 'star') as IconName;
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.changed = false;
    this.left = false;
    this.layout = new ApartmentLayout(this.state.progress.apartment, this.state.progress.owned);

    const g = this.add.graphics();
    g.fillStyle(0xc98b5a, 1).fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0xfde8d0, 1).fillRect(0, 0, GAME_W, FLOOR.y);
    // Wallpaper stripes and a window.
    for (let x = 0; x < GAME_W; x += 60) g.fillStyle(0xf9dcc0, 1).fillRect(x, 0, 30, FLOOR.y);
    g.fillStyle(PALETTE.windowBlue, 1).fillRect(GAME_W / 2 + 140, 50, 220, 140);
    g.lineStyle(6, PALETTE.outline, 1).strokeRect(GAME_W / 2 + 140, 50, 220, 140);
    g.lineBetween(GAME_W / 2 + 250, 50, GAME_W / 2 + 250, 190);
    // Floor squares (wood).
    for (let gy = 0; gy < ROOM.rows; gy++)
      for (let gx = 0; gx < ROOM.cols; gx++) {
        g.fillStyle((gx + gy) % 2 ? 0xd9a066 : 0xe2b07a, 1);
        g.fillRect(FLOOR.x + gx * CELL_W, FLOOR.y + gy * CELL_H, CELL_W, CELL_H);
      }
    g.lineStyle(6, PALETTE.outline, 1).strokeRect(
      FLOOR.x,
      FLOOR.y,
      ROOM.cols * CELL_W,
      ROOM.rows * CELL_H,
    );
    // Tray along the bottom.
    g.fillStyle(0xffffff, 0.8).fillRoundedRect(200, TRAY_Y - 60, GAME_W - 260, 120, 20);
    g.lineStyle(5, PALETTE.outline, 1).strokeRoundedRect(200, TRAY_Y - 60, GAME_W - 260, 120, 20);
    // Hat stand (left).
    g.lineStyle(10, PALETTE.trunk, 1).lineBetween(110, 140, 110, 560);
    g.lineBetween(70, 560, 150, 560);

    const back = this.add
      .image(90, GAME_H - 70, MENU.back)
      .setScale(0.8 / RS)
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.leave());
    this.input.keyboard?.once('keydown-ESC', () => this.leave());

    this.input.on(
      'drag',
      (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image, x: number, y: number) => {
        obj.setPosition(x, y).setDepth(10);
      },
    );
    this.input.on('dragend', (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const item = obj.name;
      const wx = p.x / RS;
      const wy = p.y / RS;
      const gx = Math.floor((wx - FLOOR.x) / CELL_W);
      const gy = Math.floor((wy - FLOOR.y) / CELL_H);
      if (this.layout.inRoom(gx, gy)) this.placeItem(item, gx, gy);
      else if (wy > TRAY_Y - 80) this.removeItem(item);
      this.draw();
    });

    this.draw();
    voice.say('home-hello', { interrupt: true });
  }

  private cellCentre(gx: number, gy: number): { x: number; y: number } {
    return { x: FLOOR.x + (gx + 0.5) * CELL_W, y: FLOOR.y + (gy + 0.5) * CELL_H };
  }

  /** Redraw the furniture, the tray and the hat stand from the model. */
  private draw(): void {
    for (const i of this.items) i.destroy();
    for (const h of this.hats) h.destroy();
    this.items = [];
    this.hats = [];
    for (const p of this.layout.placed) {
      const c = this.cellCentre(p.gx, p.gy);
      this.items.push(this.furnitureImage(p.item, c.x, c.y - 10, 0.85));
    }
    const tray = this.layout.tray(this.furniture());
    tray.forEach((item, i) => {
      this.items.push(this.furnitureImage(item, 290 + i * 120, TRAY_Y, 0.7));
    });
    const hats = Object.keys(HATS).filter((h) => this.state.owns(h));
    hats.forEach((h, i) => {
      const y = 190 + i * 120;
      const img = this.add
        .image(110, y, iconKey(this.icon(h)))
        .setScale(0.6 / RS)
        .setInteractive({ useHandCursor: true });
      img.on('pointerup', () => this.toggleHat(h));
      this.hats.push(img);
      if (this.state.progress.hat === h)
        this.hats.push(this.add.image(150, y - 30, HUD.check).setScale(0.25 / RS));
    });
  }

  private furnitureImage(
    item: string,
    x: number,
    y: number,
    scale: number,
  ): Phaser.GameObjects.Image {
    const img = this.add
      .image(x, y, iconKey(this.icon(item)))
      .setScale(scale / RS)
      .setName(item)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(img);
    return img;
  }

  /** Put an item on a square (test hook and drag). */
  placeItem(item: string, gx: number, gy: number): boolean {
    const ok = this.layout.place(item, gx, gy);
    sfx.play(ok ? 'thunk' : 'shrug');
    if (ok) this.save();
    this.draw();
    return ok;
  }

  removeItem(item: string): void {
    this.layout.remove(item);
    sfx.play('pop');
    this.save();
    this.draw();
  }

  toggleHat(h: string): void {
    const off = this.state.progress.hat === h;
    this.state.wear(off ? null : h);
    this.changed = true;
    sfx.play('sparkle');
    voice.say(off ? 'hat-off' : 'hat-on', { interrupt: true });
    this.draw();
  }

  private save(): void {
    this.state.saveApartment(this.layout.toSave());
  }

  private left = false;

  leave(): void {
    if (this.left) return;
    this.left = true;
    closeMenu(this, this.changed ? { changed: '1' } : {});
  }
}
