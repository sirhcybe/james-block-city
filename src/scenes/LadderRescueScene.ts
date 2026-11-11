import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { LadderRescueModel, LR, type LREvent } from '../systems/fireMinigames';
import { BIG_TEXT, MinigameScene } from './minigameKit';

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
  private scoreText!: Phaser.GameObjects.Text;

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
      data.durationSec ?? this.def.durationSec,
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
    g.fillStyle(0x9fd8f5, 1).fillRect(0, 0, GAME_W, GAME_H);
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
    this.add.image(60, 50, iconKey('kitten')).setScale(0.45 / RS);
    this.scoreText = this.add.text(100, 50, '0', BIG_TEXT).setOrigin(0, 0.5);

    voice.say('lr-intro', { interrupt: true });
    this.input.on('pointerdown', () => this.model.press());
    this.input.on('pointerup', () => this.handle(this.model.release()));
    this.input.keyboard?.on('keydown-SPACE', () => this.model.press());
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
      this.scoreText.setText(`${this.model.score}`);
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
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) {
      if (e.type === 'finished') this.finish();
      else this.handle(e);
    }
    // The ladder leans from the truck up to the tower wall at its current height.
    const top = this.floorY(this.model.height);
    const g = this.ladder;
    g.clear();
    g.lineStyle(10, PALETTE.outline, 1).lineBetween(LADDER_X, GROUND - 70, TOWER_X - 10, top);
    g.lineStyle(6, 0xe4e7ee, 1).lineBetween(LADDER_X, GROUND - 70, TOWER_X - 10, top);
  }

  /** Test hook: raise to the cat and let go. */
  debugRescue(): void {
    this.model.press();
    while (this.model.height < this.model.cat) this.model.update(0.01);
    this.handle(this.model.release());
  }
}
