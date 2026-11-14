import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { CopyBuildModel, type CBEvent } from '../systems/builderMinigames';
import { MinigameScene } from './minigameKit';

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
    this.model = new CopyBuildModel(this.durationSec, this.plays);
    this.cells = [];
    this.targetCells = [];
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0xf3e3c0).setOrigin(0, 0);
    // A drawing board for the picture, a workbench for your squares, an arrow between them.
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.35).fillRect(0, 0, GAME_W, 88);
    g.fillStyle(0x2f6fde, 1).fillRoundedRect(90, 190, 320, 340, 20);
    g.lineStyle(6, PALETTE.outline, 1).strokeRoundedRect(90, 190, 320, 340, 20);
    g.fillStyle(0xe2c98f, 1).fillRoundedRect(560, 130, 520, 500, 24);
    g.lineStyle(6, PALETTE.outline, 1).strokeRoundedRect(560, 130, 520, 500, 24);
    const arrow = [
      { x: 440, y: 340 },
      { x: 500, y: 340 },
      { x: 500, y: 315 },
      { x: 540, y: 360 },
      { x: 500, y: 405 },
      { x: 500, y: 380 },
      { x: 440, y: 380 },
    ];
    g.fillStyle(0xffffff, 1).fillPoints(arrow, true);
    g.lineStyle(5, PALETTE.outline, 1).strokePoints(arrow, true);
    this.add.image(250, 160, iconKey('magnifier')).setScale(0.45 / RS);
    this.buildGrids();
    this.addTopBar('grid');
    this.draw();
    voice.say('cb-intro', { interrupt: true });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (k >= 1 && k <= this.model.size * this.model.size) this.tap(k - 1);
    });
  }

  /** (Re)build both grids for the model's picture size (pictures grow to 3×3 at level 3). */
  private buildGrids(): void {
    for (const c of [...this.targetCells, ...this.cells]) c.destroy();
    this.targetCells = [];
    this.cells = [];
    const n = this.model.size;
    this.builtSize = n;
    const small = n === 2 ? 110 : 84;
    const big = n === 2 ? 190 : 140;
    for (let i = 0; i < n * n; i++) {
      const x = 250 + ((i % n) - (n - 1) / 2) * small;
      const y = 360 + (Math.floor(i / n) - (n - 1) / 2) * small;
      this.targetCells.push(
        this.add.rectangle(x, y, small - 8, small - 8, FILL[0]!).setStrokeStyle(4, PALETTE.outline),
      );
    }
    // Your squares (right): tap to change colour.
    for (let i = 0; i < n * n; i++) {
      const x = 820 + ((i % n) - (n - 1) / 2) * big;
      const y = 380 + (Math.floor(i / n) - (n - 1) / 2) * big;
      const r = this.add
        .rectangle(x, y, big - 12, big - 12, FILL[0]!)
        .setStrokeStyle(6, PALETTE.outline)
        .setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => this.tap(i));
      this.cells.push(r);
    }
  }

  private builtSize = 0;

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
      this.good(820, 150);
      // The finished picture flashes, then the next one comes (maybe a bigger one).
      for (const c of this.cells)
        this.tweens.add({ targets: c, scale: 1.08, duration: 90, yoyo: true });
      if (this.model.size !== this.builtSize) this.buildGrids();
    }
    this.draw();
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) if (e.type === 'finished') this.finish();
    this.model.level = this.syncTopBar(this.model.elapsed, this.model.durationSec);
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
