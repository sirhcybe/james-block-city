import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { CementPourModel, type CPEvent } from '../systems/builderMinigames';
import { drawBackdrop, MinigameScene } from './minigameKit';

const MOULD = { x: GAME_W / 2 - 120, y: 240, w: 240, h: 360 };

/**
 * Cement Pour (Builder minigame): hold anywhere (or Space) to pour cement into the mould; let go at
 * the red line. Very close = 3, close = 2, anything else = 1 (a splat is still a pour). ~90 s, pays
 * 5/15/30. On replay the line drifts.
 */
export class CementPourScene extends MinigameScene {
  private model!: CementPourModel;
  private fill!: Phaser.GameObjects.Graphics;

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
    // The mixer's chute above the mould.
    this.add.image(MOULD.x + MOULD.w / 2, 160, iconKey('mixer')).setScale(1 / RS);
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
    // Mould, cement, and the line to stop at.
    g.fillStyle(0xffffff, 1).fillRect(MOULD.x, MOULD.y, MOULD.w, MOULD.h);
    const lv = Math.min(1.15, this.model.level);
    const h = MOULD.h * Math.min(1, lv);
    g.fillStyle(0xa0a6b4, 1).fillRect(MOULD.x, MOULD.y + MOULD.h - h, MOULD.w, h);
    if (lv > 1) g.fillEllipse(MOULD.x + MOULD.w / 2, MOULD.y - 10, MOULD.w * 1.3, 40);
    g.lineStyle(6, PALETTE.outline, 1).strokeRect(MOULD.x, MOULD.y, MOULD.w, MOULD.h);
    const ly = MOULD.y + MOULD.h * (1 - this.model.line);
    g.lineStyle(8, PALETTE.fireRed, 1).lineBetween(MOULD.x - 30, ly, MOULD.x + MOULD.w + 30, ly);
  }
}
