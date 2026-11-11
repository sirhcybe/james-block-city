import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { CopyBuildModel, type CBEvent } from '../systems/builderMinigames';
import { BIG_TEXT, MinigameScene } from './minigameKit';

/** Square colours: 0 = empty, then red, yellow, teal. */
const FILL = [0xeeeeee, PALETTE.fireRed, PALETTE.builderYellow, PALETTE.harborTeal];

/**
 * Copy the Build (Builder minigame): the little picture on the left; tap your squares on the right
 * to change their colour until they match. Then a new picture. ~110 s, pays 5/15/30. Pictures get
 * bigger (3×3) on replay.
 */
export class CopyBuildScene extends MinigameScene {
  private model!: CopyBuildModel;
  private targetCells: Phaser.GameObjects.Rectangle[] = [];
  private cells: Phaser.GameObjects.Rectangle[] = [];
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super('CopyBuild');
  }

  protected defaultId(): string {
    return 'copy-the-build';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new CopyBuildModel(data.durationSec ?? this.def.durationSec, this.plays);
    this.cells = [];
    this.targetCells = [];
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0xf3e3c0).setOrigin(0, 0);
    const n = this.model.size;
    const small = 70;
    const big = n === 2 ? 170 : 130;
    // The picture to copy (left), with a magnifier.
    this.add.image(250, 170, iconKey('magnifier')).setScale(0.5 / RS);
    for (let i = 0; i < n * n; i++) {
      const x = 250 + ((i % n) - (n - 1) / 2) * small;
      const y = 360 + (Math.floor(i / n) - (n - 1) / 2) * small;
      this.targetCells.push(
        this.add.rectangle(x, y, small - 6, small - 6, FILL[0]!).setStrokeStyle(4, PALETTE.outline),
      );
    }
    // Your squares (right): tap to change colour.
    for (let i = 0; i < n * n; i++) {
      const x = 820 + ((i % n) - (n - 1) / 2) * big;
      const y = 380 + (Math.floor(i / n) - (n - 1) / 2) * big;
      const r = this.add
        .rectangle(x, y, big - 10, big - 10, FILL[0]!)
        .setStrokeStyle(6, PALETTE.outline)
        .setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => this.tap(i));
      this.cells.push(r);
    }
    this.add.image(60, 50, iconKey('grid')).setScale(0.45 / RS);
    this.scoreText = this.add.text(100, 50, '0', BIG_TEXT).setOrigin(0, 0.5);
    this.draw();
    voice.say('cb-intro', { interrupt: true });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (k >= 1 && k <= n * n) this.tap(k - 1);
    });
  }

  private draw(): void {
    this.model.target.forEach((c, i) => this.targetCells[i]?.setFillStyle(FILL[c]!));
    this.model.grid.forEach((c, i) => this.cells[i]?.setFillStyle(FILL[c]!));
  }

  tap(i: number): void {
    const e: CBEvent | null = this.model.tap(i);
    sfx.play('pop', 1 + (this.model.grid[i] ?? 0) * 0.1);
    const cell = this.cells[i];
    if (cell) this.tweens.add({ targets: cell, scale: 0.9, duration: 60, yoyo: true });
    if (e?.type === 'matched') {
      sfx.play('tada', 1.2, 0.6);
      voice.say('cb-match', { interrupt: true });
      this.scoreText.setText(`${this.model.score}`);
    }
    this.draw();
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) if (e.type === 'finished') this.finish();
  }

  /** Test hook: solve the current picture. */
  debugSolve(): void {
    this.model.target.forEach((c, i) => {
      while (this.model.grid[i] !== c && !this.model.finished) {
        const before = this.model.score;
        this.tap(i);
        if (this.model.score > before) return;
      }
    });
  }
}
