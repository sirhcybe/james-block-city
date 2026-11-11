import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { EV } from './keys';

/** One grumpy little flame in a room, put out with two sprays. */
interface RoomFlame {
  x: number;
  y: number;
  hp: number;
  img: Phaser.GameObjects.Image;
}

/** Flames per room (spec 004: one interior, the kitchen). */
const ROOMS: Record<string, { x: number; y: number }[]> = {
  kitchen: [
    { x: 420, y: 400 }, // the toaster
    { x: 820, y: 230 }, // the curtain
    { x: 1010, y: 420 }, // the frying pan
  ],
};

/**
 * Inside a building (spec 004 "interiors"): a side-on kitchen with three grumpy little flames.
 * Tap a flame (or press Space/Action) to spray it; two sprays each. When they're all out, the
 * toast pops out and you go back outside. Can't be failed.
 */
export class InteriorScene extends Phaser.Scene {
  private room = 'kitchen';
  private flames: RoomFlame[] = [];
  private done = false;

  constructor() {
    super('Interior');
  }

  init(data: { room?: string }): void {
    this.room = data.room ?? 'kitchen';
    this.flames = [];
    this.done = false;
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const g = this.add.graphics();
    // Wall, floor, a counter, a window with curtains, the stove.
    g.fillStyle(0xfff3d6, 1).fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(0xd9b48f, 1).fillRect(0, 520, GAME_W, GAME_H - 520);
    g.lineStyle(6, PALETTE.outline, 1).lineBetween(0, 520, GAME_W, 520);
    g.fillStyle(0xffffff, 1).fillRect(260, 420, 340, 100);
    g.strokeRect(260, 420, 340, 100);
    g.fillStyle(0x7ec8f2, 1).fillRect(720, 110, 200, 160);
    g.strokeRect(720, 110, 200, 160);
    g.fillStyle(PALETTE.fireRed, 1).fillRect(700, 100, 50, 190);
    g.fillRect(890, 100, 50, 190);
    g.strokeRect(700, 100, 50, 190);
    g.strokeRect(890, 100, 50, 190);
    g.fillStyle(0x3a3d4a, 1).fillRect(930, 440, 180, 80);
    g.strokeRect(930, 440, 180, 80);
    this.add.image(420, 450, iconKey('toaster')).setScale(0.9 / RS);
    // The door you came in by (bottom-left).
    g.fillStyle(PALETTE.trunk, 1).fillRect(60, 300, 120, 220);
    g.strokeRect(60, 300, 120, 220);

    for (const p of ROOMS[this.room] ?? []) {
      const img = this.add
        .image(p.x, p.y, iconKey('flame'))
        .setScale(0.9 / RS)
        .setInteractive({ useHandCursor: true });
      const f: RoomFlame = { ...p, hp: 2, img };
      img.on('pointerdown', () => this.spray(f));
      this.tweens.add({ targets: img, scaleY: 1 / RS, duration: 260, yoyo: true, repeat: -1 });
      this.flames.push(f);
    }
    this.input.keyboard?.on('keydown-SPACE', () => this.sprayNext());
    voice.say('kitchen-hello', { interrupt: true });
  }

  /** Spray the next flame still burning (keyboard / test hook). */
  sprayNext(): void {
    const f = this.flames.find((x) => x.hp > 0);
    if (f) this.spray(f);
  }

  private spray(f: RoomFlame): void {
    if (this.done || f.hp <= 0) return;
    f.hp--;
    sfx.play('splash');
    // A splash of water from the bottom-left (where you stand) to the flame.
    for (let i = 0; i < 8; i++) {
      const d = this.add.circle(160, 560, 8, 0x7ec8f2).setStrokeStyle(2, PALETTE.outline);
      this.tweens.add({
        targets: d,
        x: f.x + (Math.random() - 0.5) * 30,
        y: f.y + (Math.random() - 0.5) * 30,
        delay: i * 30,
        duration: 300,
        onComplete: () => d.destroy(),
      });
    }
    this.tweens.killTweensOf(f.img);
    if (f.hp > 0) {
      f.img.setScale(0.6 / RS);
      return;
    }
    sfx.play('pop', 0.7);
    voice.say('pfft', { interrupt: true });
    this.tweens.add({ targets: f.img, scale: 0, alpha: 0, duration: 300 });
    if (this.flames.every((x) => x.hp <= 0)) this.finish();
  }

  private finish(): void {
    this.done = true;
    sfx.play('tada');
    voice.say('kitchen-done', { interrupt: true });
    // Toast pops out of the toaster!
    const toast = this.add.image(420, 420, iconKey('toaster')).setScale(0.5 / RS);
    this.tweens.add({ targets: toast, y: 300, duration: 400, ease: 'Quad.easeOut', yoyo: true });
    const back = this.add
      .image(GAME_W / 2, 600, HUD.check)
      .setScale(1 / RS)
      .setInteractive(
        new Phaser.Geom.Circle(79 * RS, 79 * RS, 75 * RS),
        Phaser.Geom.Circle.Contains,
      );
    this.tweens.add({ targets: back, scale: 1.08 / RS, duration: 500, yoyo: true, repeat: -1 });
    const leave = () => this.leave();
    back.once('pointerup', leave);
    this.input.keyboard?.once('keydown-ENTER', leave);
    this.time.delayedCall(1200, () => this.input.keyboard?.once('keydown-SPACE', leave));
    this.time.delayedCall(6000, leave);
  }

  private left = false;

  private leave(): void {
    if (this.left) return;
    this.left = true;
    this.scene.stop();
    this.scene.resume('City');
    this.scene.wake('Hud');
    this.game.events.emit(EV.interiorDone, { room: this.room });
  }

  /** Test hook: put every flame out. */
  debugAllOut(): void {
    for (const f of this.flames) while (f.hp > 0) this.spray(f);
  }

  /** Test hook: leave now (after finishing). */
  debugLeave(): void {
    if (this.done) this.leave();
  }
}
