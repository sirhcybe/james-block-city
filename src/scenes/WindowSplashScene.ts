import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { iconKey } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { WindowSplashModel, type WSEvent } from '../systems/fireMinigames';
import { drawBackdrop, MinigameScene } from './minigameKit';

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
  private soot: Phaser.GameObjects.Rectangle[] = [];

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
      this.durationSec,
      this.plays,
      this.def.difficultyStepPerReplay,
    );
    this.flames = [];
    this.soot = [];
  }

  private cell(i: number): { x: number; y: number } {
    return { x: X0 + (i % COLS) * W, y: Y0 + Math.floor(i / COLS) * H };
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const g = this.add.graphics();
    drawBackdrop(this);
    // The tower front.
    g.fillStyle(0xf4f6fa, 1).fillRect(X0 - 140, 100, W * COLS + 100, GAME_H);
    g.lineStyle(6, PALETTE.outline, 1).strokeRect(X0 - 140, 100, W * COLS + 100, GAME_H);
    for (let i = 0; i < 9; i++) {
      const c = this.cell(i);
      g.fillStyle(PALETTE.windowBlue, 1).fillRect(c.x - 70, c.y - 55, 140, 110);
      g.lineStyle(5, PALETTE.outline, 1).strokeRect(c.x - 70, c.y - 55, 140, 110);
      this.soot.push(this.add.rectangle(c.x, c.y, 136, 106, 0x2b2d42, 0));
      const img = this.add.image(c.x, c.y + 10, iconKey('flame')).setScale(0);
      this.flames.push(img);
      // Tap target: the whole window cell (gaps included), not the flame sprite. The sprite
      // starts at scale 0 and grows, and its hit box was in unscaled texture pixels, so taps on
      // a flame often missed (playtest 2026-11-11).
      this.add
        .zone(c.x, c.y, W, H)
        .setInteractive()
        .on('pointerdown', () => this.handle(this.model.tap(i)));
    }
    this.addTopBar('flame');
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
      this.good(img.x, img.y - 30);
      // A splash of drops where the flame was.
      for (let k = 0; k < 5; k++) {
        const d = this.add.circle(img.x, img.y, 7, 0x7ec8f2).setStrokeStyle(2, PALETTE.outline);
        this.tweens.add({
          targets: d,
          x: img.x + (k - 2) * 26,
          y: img.y + 46 + Math.abs(k - 2) * -14,
          alpha: 0,
          duration: 420,
          onComplete: () => d.destroy(),
        });
      }
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
      // It burned all the way down: the window goes sooty for a moment, and a heart goes.
      const soot = this.soot[(e as { window: number }).window];
      if (soot) {
        soot.setFillStyle(0x2b2d42, 0.55);
        this.tweens.add({ targets: soot, fillAlpha: 0, delay: 500, duration: 900 });
      }
      sfx.play('shrug', 1.1, 0.7);
      voice.say('ws-sooty', { minGapMs: 9000 });
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
  }
}
