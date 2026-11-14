import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { LadderRescueModel, LR, type LREvent } from '../systems/fireMinigames';
import { drawBackdrop, MinigameScene } from './minigameKit';

const GROUND = 640;
const FLOOR_H = 66;
const TOWER_X = 760;
const LADDER_X = 560;

/**
 * Ladder Rescue (Fire minigame): a cat waits at a window. Hold anywhere (or Space) to raise the
 * ladder; let go when its top is at the cat. Close enough: the cat slides down. A miss just lowers
 * the ladder to try again, and after 3 misses "close enough" gets wider. ~100 s, pays 5/15/30.
 */
export class LadderRescueScene extends MinigameScene {
  private model!: LadderRescueModel;
  private ladder!: Phaser.GameObjects.Graphics;
  private cat!: Phaser.GameObjects.Image;

  constructor() {
    super('LadderRescue');
  }

  protected defaultId(): string {
    return 'ladder-rescue';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new LadderRescueModel(
      this.durationSec,
      this.plays,
      this.def.difficultyStepPerReplay,
    );
  }

  private floorY(f: number): number {
    return GROUND - f * FLOOR_H;
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const g = this.add.graphics();
    drawBackdrop(this);
    g.fillStyle(PALETTE.grass, 1).fillRect(0, GROUND, GAME_W, GAME_H - GROUND);
    // The tower with a window per floor.
    g.fillStyle(0xf4f6fa, 1).fillRect(TOWER_X - 40, this.floorY(LR.floors + 0.6), 300, GROUND);
    g.lineStyle(6, PALETTE.outline, 1).strokeRect(
      TOWER_X - 40,
      this.floorY(LR.floors + 0.6),
      300,
      GROUND,
    );
    for (let f = 1; f <= LR.floors; f++) {
      g.fillStyle(PALETTE.windowBlue, 1).fillRect(TOWER_X, this.floorY(f) - 22, 80, 44);
      g.lineStyle(4, PALETTE.outline, 1).strokeRect(TOWER_X, this.floorY(f) - 22, 80, 44);
    }
    // The fire truck at the bottom.
    g.fillStyle(PALETTE.fireRed, 1).fillRoundedRect(LADDER_X - 160, GROUND - 70, 260, 70, 14);
    g.lineStyle(5, PALETTE.outline, 1).strokeRoundedRect(LADDER_X - 160, GROUND - 70, 260, 70, 14);
    g.fillStyle(PALETTE.outline, 1)
      .fillCircle(LADDER_X - 100, GROUND, 22)
      .fillCircle(LADDER_X + 50, GROUND, 22);

    this.ladder = this.add.graphics();
    this.cat = this.add.image(TOWER_X + 40, this.floorY(1), iconKey('kitten')).setScale(0.55 / RS);
    this.addTopBar('kitten');

    voice.say('lr-intro', { interrupt: true });
    // Hold and let go at the cat, or tap to start and tap again to stop.
    this.input.on('pointerdown', () => this.handle(this.model.press()));
    this.input.on('pointerup', () => this.handle(this.model.release()));
    this.input.keyboard?.on('keydown-SPACE', (e: KeyboardEvent) => {
      if (!e.repeat) this.handle(this.model.press());
    });
    this.input.keyboard?.on('keyup-SPACE', () => this.handle(this.model.release()));
  }

  private handle(e: LREvent | null): void {
    if (!e) return;
    if (e.type === 'cat') {
      this.cat
        .setPosition(TOWER_X + 40, this.floorY(e.floor))
        .setAlpha(1)
        .setScale(0);
      this.tweens.add({ targets: this.cat, scale: 0.55 / RS, duration: 250, ease: 'Back.easeOut' });
      sfx.play('pop', 1.4);
    } else if (e.type === 'saved') {
      sfx.play('tada', 1.2, 0.6);
      voice.say('lr-saved', { interrupt: true });
      this.good(this.cat.x, this.cat.y - 40);
      this.tweens.add({
        targets: this.cat,
        x: LADDER_X,
        y: GROUND - 80,
        duration: 600,
        ease: 'Quad.easeIn',
      });
      this.tweens.add({ targets: this.cat, alpha: 0, delay: 650, duration: 200 });
    } else if (e.type === 'miss') {
      sfx.play('shrug');
      voice.say('lr-miss', { minGapMs: 2500 });
      this.oops();
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) {
      if (e.type === 'finished') this.finish();
      else this.handle(e);
    }
    this.model.level = this.syncTopBar(this.model.elapsed, this.model.durationSec);
    this.drawLadder();
  }

  /**
   * The ladder swings up from the truck: its foot is on the truck, its top rests against the
   * tower wall at the current height. Two rails with rungs, so it reads as a ladder and you can
   * see it climb (playtest 2026-11-11: a thin line that barely moved).
   */
  private drawLadder(): void {
    const x0 = LADDER_X;
    const y0 = GROUND - 70;
    const x1 = TOWER_X - 42;
    // Never lower than the truck deck, so even at rest it points up the wall.
    const y1 = Math.min(y0 - 20, this.floorY(this.model.height));
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const nx = -uy * 13;
    const ny = ux * 13;
    const g = this.ladder;
    g.clear();
    const rails = (w: number, color: number) => {
      g.lineStyle(w, color, 1);
      g.lineBetween(x0 + nx, y0 + ny, x1 + nx, y1 + ny);
      g.lineBetween(x0 - nx, y0 - ny, x1 - nx, y1 - ny);
    };
    rails(12, PALETTE.outline);
    for (let d = 14; d < len - 4; d += 26) {
      const cx = x0 + ux * d;
      const cy = y0 + uy * d;
      g.lineStyle(9, PALETTE.outline, 1).lineBetween(cx + nx, cy + ny, cx - nx, cy - ny);
      g.lineStyle(5, 0xe4e7ee, 1).lineBetween(cx + nx, cy + ny, cx - nx, cy - ny);
    }
    rails(7, 0xe4e7ee);
    // A turntable on the truck that the ladder pivots on.
    g.fillStyle(PALETTE.outline, 1).fillCircle(x0, y0, 16);
    g.fillStyle(0xe4e7ee, 1).fillCircle(x0, y0, 10);
  }

  /** Test hook: raise to the cat and let go. */
  debugRescue(): void {
    this.model.press();
    while (this.model.height < this.model.cat) this.model.update(0.01);
    this.handle(this.model.release());
  }
}
