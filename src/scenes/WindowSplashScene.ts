import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { WindowSplashModel, type WSEvent } from '../systems/fireMinigames';
import { BIG_TEXT, MinigameScene } from './minigameKit';

const COLS = 3;
const W = 190;
const H = 150;
const X0 = GAME_W / 2 - W;
const Y0 = 210;

/**
 * Window Splash (Fire minigame): grumpy flames pop up in a tower's windows; tap them to splash.
 * Flames you miss just fizzle on their own. ~100 s, pays 5/15/30, harder on replay.
 */
export class WindowSplashScene extends MinigameScene {
  private model!: WindowSplashModel;
  private flames: Phaser.GameObjects.Image[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Image;

  constructor() {
    super('WindowSplash');
  }

  protected defaultId(): string {
    return 'window-splash';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new WindowSplashModel(
      data.durationSec ?? this.def.durationSec,
      this.plays,
      this.def.difficultyStepPerReplay,
    );
    this.flames = [];
  }

  private cell(i: number): { x: number; y: number } {
    return { x: X0 + (i % COLS) * W, y: Y0 + Math.floor(i / COLS) * H };
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x9fd8f5, 1).fillRect(0, 0, GAME_W, GAME_H);
    // The tower front.
    g.fillStyle(0xf4f6fa, 1).fillRect(X0 - 140, 100, W * COLS + 100, GAME_H);
    g.lineStyle(6, PALETTE.outline, 1).strokeRect(X0 - 140, 100, W * COLS + 100, GAME_H);
    for (let i = 0; i < 9; i++) {
      const c = this.cell(i);
      g.fillStyle(PALETTE.windowBlue, 1).fillRect(c.x - 70, c.y - 55, 140, 110);
      g.lineStyle(5, PALETTE.outline, 1).strokeRect(c.x - 70, c.y - 55, 140, 110);
      const img = this.add
        .image(c.x, c.y + 10, iconKey('flame'))
        .setScale(0)
        .setInteractive(
          new Phaser.Geom.Rectangle(-10, -10, 140, 140),
          Phaser.Geom.Rectangle.Contains,
        );
      img.on('pointerdown', () => this.handle(this.model.tap(i)));
      this.flames.push(img);
    }
    this.add.image(60, 50, iconKey('flame')).setScale(0.45 / RS);
    this.scoreText = this.add.text(100, 50, '0', BIG_TEXT).setOrigin(0, 0.5);
    g.lineStyle(6, 0xffffff, 0.8).lineBetween(900, 60, 1220, 60);
    this.timer = this.add.image(900, 60, iconKey('hose')).setScale(0.35 / RS);
    voice.say('ws-intro', { interrupt: true });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 9) this.handle(this.model.tap(n - 1));
    });
  }

  private handle(e: WSEvent | null): void {
    if (!e) return;
    const img = this.flames[(e as { window?: number }).window ?? -1];
    if (!img) return;
    if (e.type === 'pop') {
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, scale: 0.85 / RS, duration: 180, ease: 'Back.easeOut' });
    } else if (e.type === 'splash') {
      sfx.play('splash');
      this.scoreText.setText(`${this.model.score}`);
      this.tweens.killTweensOf(img);
      this.tweens.add({
        targets: img,
        scale: 0,
        angle: 90,
        duration: 200,
        onComplete: () => img.setAngle(0),
      });
    } else if (e.type === 'fizzle') {
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, scale: 0, duration: 250 });
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    for (const e of this.model.update(dt)) {
      if (e.type === 'finished') this.finish();
      else this.handle(e);
    }
    const k = Math.min(1, this.model.elapsed / this.model.durationSec);
    this.timer.x = 900 + 320 * k;
  }
}
