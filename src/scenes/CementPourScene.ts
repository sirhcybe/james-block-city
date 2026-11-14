import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { CementPourModel, type CPEvent } from '../systems/builderMinigames';
import { drawBackdrop, MinigameScene } from './minigameKit';

const MOULD = { x: GAME_W / 2 - 120, y: 240, w: 240, h: 360 };
/** Bottom of the pipe the cement falls from. */
const PIPE_Y = 240;

/**
 * Cement Pour (Builder minigame): hold anywhere (or Space) to pour cement into the mould; let go at
 * the red line. Very close = 3, close = 2, anything else = 1 (a splat is still a pour). ~90 s, pays
 * 5/15/30. On replay the line drifts.
 */
export class CementPourScene extends MinigameScene {
  private model!: CementPourModel;
  private fill!: Phaser.GameObjects.Graphics;
  private lastLevel = 0;

  constructor() {
    super('CementPour');
  }

  protected defaultId(): string {
    return 'cement-pour';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new CementPourModel(this.durationSec, this.plays);
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    drawBackdrop(this, 'site');
    this.add.rectangle(0, 620, GAME_W, GAME_H - 620, 0xb98a5a).setOrigin(0, 0);
    this.add.rectangle(0, 620, GAME_W, 6, 0x9a6f43).setOrigin(0, 0);
    // The mixer's chute above the mould.
    // It stands on a plank across the mould; the cement drops through a short pipe.
    const deck = this.add.graphics();
    const cx = MOULD.x + MOULD.w / 2;
    deck.fillStyle(0xc98a4b, 1).fillRect(MOULD.x - 70, 206, MOULD.w + 140, 16);
    deck.fillStyle(0xa9713a, 1).fillRect(MOULD.x - 70, 216, MOULD.w + 140, 6);
    deck.lineStyle(5, PALETTE.outline, 1).strokeRect(MOULD.x - 70, 206, MOULD.w + 140, 16);
    deck.fillStyle(0x8a8fa0, 1).fillRect(cx - 14, 222, 28, PIPE_Y - 222);
    deck.lineStyle(5, PALETTE.outline, 1).strokeRect(cx - 14, 222, 28, PIPE_Y - 222);
    this.add.image(cx, 162, iconKey('mixer')).setScale(1 / RS);
    this.fill = this.add.graphics();
    this.addTopBar('bucket');
    voice.say('cp-intro', { interrupt: true });
    this.input.on('pointerdown', () => this.model.press());
    this.input.on('pointerup', () => this.handle(this.model.release()));
    this.input.keyboard?.on('keydown-SPACE', () => this.model.press());
    this.input.keyboard?.on('keyup-SPACE', () => this.handle(this.model.release()));
  }

  private handle(e: CPEvent | null): void {
    if (!e || e.type !== 'poured') return;
    this.good(MOULD.x + MOULD.w + 90, MOULD.y + MOULD.h * (1 - this.model.line), e.points);
    if (e.spilled) {
      sfx.play('splash');
      voice.say('cp-spill', { minGapMs: 6000 });
      this.oops();
    } else if (e.points === 3) {
      sfx.play('tada', 1.2, 0.6);
      voice.say('cp-great', { interrupt: true });
    } else if (e.points === 2) {
      sfx.play('pop', 1.2);
      voice.say('cp-ok', { minGapMs: 3000 });
    } else sfx.play(e.diff > 0 ? 'splash' : 'thunk');
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) if (e.type === 'finished') this.finish();
    this.model.stage = this.syncTopBar(this.model.elapsed, this.model.durationSec);
    const g = this.fill;
    g.clear();
    const { x, y, w, h: mh } = MOULD;
    // Cement is falling while the level is rising: a stream from the pipe to the surface.
    const rising = this.model.level > this.lastLevel + 1e-4;
    this.lastLevel = this.model.level;
    // The mould: a wooden form with two side boards and a base, open at the top.
    g.fillStyle(0xf4f6fa, 1).fillRect(x, y, w, mh);
    const lv = Math.min(1.15, this.model.level);
    const h = mh * Math.min(1, lv);
    const top = y + mh - h;
    if (h > 0) {
      // Cement: a lit surface, a shaded right side, a few pebbles.
      g.fillStyle(0xa0a6b4, 1).fillRect(x, top, w, h);
      g.fillStyle(0x8a8fa0, 1).fillRect(x + w - 30, top, 30, h);
      g.fillStyle(0xc0c5d0, 1).fillRect(x, top, w, Math.min(10, h));
      g.fillStyle(0x8a8fa0, 1);
      for (const [px, py] of [
        [40, 60],
        [120, 130],
        [70, 220],
        [170, 280],
        [30, 320],
      ] as const)
        if (py < h) g.fillCircle(x + px, y + mh - py, 5);
    }
    if (lv > 1) {
      // Spilled over the top.
      g.fillStyle(0xa0a6b4, 1).fillEllipse(x + w / 2, y - 8, w * 1.3, 40);
      g.lineStyle(5, PALETTE.outline, 1).strokeEllipse(x + w / 2, y - 8, w * 1.3, 40);
    }
    if (rising) {
      const sx = x + w / 2;
      const sway = Math.sin(this.model.elapsed * 30) * 2;
      g.fillStyle(0xa0a6b4, 1).fillRect(sx - 9 + sway, PIPE_Y, 18, Math.max(0, top - PIPE_Y));
      g.fillStyle(0xc0c5d0, 1).fillRect(sx - 9 + sway, PIPE_Y, 6, Math.max(0, top - PIPE_Y));
      g.fillStyle(0xc0c5d0, 1).fillEllipse(sx, top, 60, 12);
    }
    for (const bx of [x - 22, x + w]) {
      g.fillStyle(0xc98a4b, 1).fillRect(bx, y - 14, 22, mh + 14);
      g.fillStyle(0xa9713a, 1).fillRect(bx + 14, y - 14, 8, mh + 14);
      g.lineStyle(5, PALETTE.outline, 1).strokeRect(bx, y - 14, 22, mh + 14);
    }
    g.fillStyle(0xa9713a, 1).fillRect(x - 34, y + mh, w + 68, 20);
    g.lineStyle(5, PALETTE.outline, 1).strokeRect(x - 34, y + mh, w + 68, 20);
    // The line to stop at: an outlined red bar with a marker tab at each end.
    const ly = y + mh * (1 - this.model.line);
    g.lineStyle(12, PALETTE.outline, 1).lineBetween(x - 44, ly, x + w + 44, ly);
    g.lineStyle(6, PALETTE.fireRed, 1).lineBetween(x - 44, ly, x + w + 44, ly);
    for (const tx of [x - 44, x + w + 44]) {
      g.fillStyle(PALETTE.fireRed, 1).fillCircle(tx, ly, 11);
      g.lineStyle(4, PALETTE.outline, 1).strokeCircle(tx, ly, 11);
    }
  }
}
