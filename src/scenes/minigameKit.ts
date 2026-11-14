import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import type { IconName } from '../art/icons';
import { iconKey, MENU } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W, PALETTE } from '../config';
import type { GameState } from '../systems/GameState';
import { Hearts, heartsFor, levelFor, starMeter, Streak } from '../systems/round';
import { EV, STATE_KEY, type MinigameResult } from './keys';

export const BIG_TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '44px',
  fontStyle: 'bold',
  color: '#ffffff',
  stroke: '#2B2D42',
  strokeThickness: 8,
  resolution: RS,
};

/** Where the top bar's parts sit (logical px). */
const BAR = {
  icon: { x: 54, y: 46 },
  score: { x: 96, y: 46 },
  meter: { x: 300, y: 46, w: 360, h: 26 },
  time: { x: 760, y: 46, w: 220, h: 18 },
  hearts: { x: 44, y: 112, gap: 44 },
};

export type Backdrop = 'sky' | 'site';

/**
 * A friendly backdrop for a minigame: sky bands, a sun, drifting clouds and rolling hills.
 * Scenes draw their own stage on top.
 */
export function drawBackdrop(scene: Phaser.Scene, kind: Backdrop = 'sky'): void {
  const g = scene.add.graphics().setDepth(-20);
  const bands = [0x8fd3ff, 0x9fdcff, 0xb3e4ff, 0xc9edff];
  bands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, (GAME_H * i) / 4, GAME_W, GAME_H / 4 + 1));
  // Sun.
  g.fillStyle(0xfff3a0, 0.5).fillCircle(1150, 120, 78);
  g.fillStyle(0xffe066, 1).fillCircle(1150, 120, 52);
  // Hills.
  const far = kind === 'site' ? 0xd9b97a : 0x9be07c;
  const near = kind === 'site' ? 0xc9a060 : 0x7bd35a;
  g.fillStyle(far, 1)
    .fillEllipse(300, GAME_H + 40, 900, 420)
    .fillEllipse(1050, GAME_H + 60, 800, 380);
  g.fillStyle(near, 1).fillEllipse(680, GAME_H + 130, 1700, 420);
  // Clouds that drift across and come round again.
  for (let i = 0; i < 4; i++) {
    const c = scene.add.graphics().setDepth(-19);
    c.fillStyle(0xffffff, 0.95);
    c.fillEllipse(0, 0, 150, 46).fillEllipse(-36, -18, 80, 46).fillEllipse(30, -24, 96, 56);
    const y = 130 + i * 58 + (i % 2) * 20;
    c.setPosition(-200 + i * 380, y).setScale(0.7 + (i % 3) * 0.2);
    scene.tweens.add({
      targets: c,
      x: GAME_W + 220,
      duration: (60 + i * 14) * 1000 * ((GAME_W + 220 - c.x) / (GAME_W + 420)),
      onComplete: () => {
        c.x = -220;
        scene.tweens.add({
          targets: c,
          x: GAME_W + 220,
          duration: (60 + i * 14) * 1000,
          repeat: -1,
        });
      },
    });
  }
}

/**
 * Shared bones of every minigame scene (spec 003+, top bar and hearts from spec 008): launched
 * over the paused city with `{ id, plays }`. Every game shows the same top bar: its picture and
 * score, a star meter that fills toward the 2- and 3-star marks, a time bar, and hearts where the
 * game has them. Inside a round the game levels up every few points. A mistake costs a heart;
 * with none left the round stops with a friendly "Oops!" and a retry button (no coins, nothing
 * lost, more hearts next time). A finished round pays by score tier through GameState, shows
 * stars + coins + a big check button, then returns to the city.
 */
export abstract class MinigameScene extends Phaser.Scene {
  protected id = '';
  protected plays = 0;
  protected state!: GameState;
  protected done = false;
  private closed = false;
  /** Oops screens in a row on this visit (each gives the next try more hearts). */
  protected fails = 0;
  protected hearts = new Hearts(0);
  protected streak = new Streak();
  /** Level inside the round (1 = start); models read it to speed up. */
  protected level = 1;
  private durationOverride: number | undefined;

  private quitBtn: Phaser.GameObjects.Image | null = null;
  private scoreLabel: Phaser.GameObjects.Text | null = null;
  private shownScore = 0;
  private meterFill: Phaser.GameObjects.Rectangle | null = null;
  private meterStars: Phaser.GameObjects.Image[] = [];
  private shownStars = 1;
  private timeFill: Phaser.GameObjects.Rectangle | null = null;
  private heartImgs: Phaser.GameObjects.Image[] = [];

  init(data: { id?: string; plays?: number; fails?: number; durationSec?: number }): void {
    this.id = data.id ?? this.defaultId();
    this.plays = data.plays ?? 0;
    this.fails = data.fails ?? 0;
    this.durationOverride = data.durationSec;
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.done = false;
    this.closed = false;
    this.level = 1;
    this.streak = new Streak();
    this.hearts = new Hearts(heartsFor(this.def.hearts, this.fails));
    this.scoreLabel = null;
    this.meterFill = null;
    this.timeFill = null;
    this.meterStars = [];
    this.heartImgs = [];
    this.shownScore = 0;
    this.shownStars = 1;
    // Every minigame gets the back arrow once its own create() has drawn the board.
    this.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.quitBtn = addQuitButton(this, () => this.quit());
    });
  }

  /** Leave without finishing: no coins, no fuss, straight back to the city. */
  quit(): void {
    if (this.closed) return;
    if (this.done && !this.failed) return;
    this.closed = true;
    leaveMinigame(this);
  }

  protected abstract defaultId(): string;
  /** The current score (for paying and for the test hook). */
  protected abstract get score(): number;
  protected abstract set score(v: number);

  protected get def() {
    return this.state.content.minigames.find((m) => m.id === this.id)!;
  }

  // ---------------------------------------------------------------------------------------------
  // Top bar
  // ---------------------------------------------------------------------------------------------

  /** Draw the shared top bar. Call once from create(), after the scene's own background. */
  protected addTopBar(icon: IconName): void {
    const D = 30;
    const g = this.add.graphics().setDepth(D);
    // A soft plate behind the score so it reads on any background.
    g.fillStyle(0x2b2d42, 0.28).fillRoundedRect(14, 12, 216, 68, 34);
    this.add
      .image(BAR.icon.x, BAR.icon.y, iconKey(icon))
      .setScale(0.48 / RS)
      .setDepth(D + 1);
    this.scoreLabel = this.add
      .text(BAR.score.x, BAR.score.y, '0', BIG_TEXT)
      .setOrigin(0, 0.5)
      .setDepth(D + 1);

    // Star meter: fills toward the 3-star score; the stars light up as it passes them.
    const m = BAR.meter;
    const marks = starMeter(0, this.def.tiers);
    g.fillStyle(0x2b2d42, 1).fillRoundedRect(m.x - 5, m.y - m.h / 2 - 5, m.w + 10, m.h + 10, 18);
    g.fillStyle(0xffffff, 0.92).fillRoundedRect(m.x, m.y - m.h / 2, m.w, m.h, 13);
    this.meterFill = this.add
      .rectangle(m.x, m.y, 1, m.h, PALETTE.coinGold)
      .setOrigin(0, 0.5)
      .setDepth(D + 1);
    this.meterStars = [0, marks.mark2, 1].map((k, i) =>
      this.add
        .image(m.x + m.w * k, m.y, i === 0 ? HUD.star : HUD.starEmpty)
        .setScale(0.44 / RS)
        .setDepth(D + 2),
    );

    // Time bar with a little clock: it empties as the round runs out.
    const t = BAR.time;
    g.fillStyle(0x2b2d42, 1).fillRoundedRect(t.x - 5, t.y - t.h / 2 - 5, t.w + 10, t.h + 10, 14);
    g.fillStyle(0xffffff, 0.92).fillRoundedRect(t.x, t.y - t.h / 2, t.w, t.h, 9);
    this.timeFill = this.add
      .rectangle(t.x, t.y, t.w, t.h, PALETTE.harborTeal)
      .setOrigin(0, 0.5)
      .setDepth(D + 1);
    const cx = t.x - 30;
    g.fillStyle(0xffffff, 1).fillCircle(cx, t.y, 17);
    g.lineStyle(4, PALETTE.outline, 1).strokeCircle(cx, t.y, 17);
    g.lineBetween(cx, t.y, cx, t.y - 10);
    g.lineBetween(cx, t.y, cx + 8, t.y + 3);

    // Hearts (only in games that have them).
    for (let i = 0; i < this.hearts.max; i++) {
      this.heartImgs.push(
        this.add
          .image(BAR.hearts.x + i * BAR.hearts.gap, BAR.hearts.y, iconKey('heart'))
          .setScale(0.3 / RS)
          .setDepth(D + 1),
      );
    }
  }

  /**
   * Keep the top bar up to date. Call every frame with how far through the round we are.
   * Returns the level, for the scene to hand to its model.
   */
  protected syncTopBar(elapsed: number, durationSec: number): number {
    const score = this.score;
    if (score !== this.shownScore && this.scoreLabel) {
      const up = score > this.shownScore;
      this.shownScore = score;
      this.scoreLabel.setText(`${score}`);
      if (up) this.tweens.add({ targets: this.scoreLabel, scale: 1.35, duration: 90, yoyo: true });
      const meter = starMeter(score, this.def.tiers);
      if (this.meterFill)
        this.tweens.add({
          targets: this.meterFill,
          width: Math.max(1, BAR.meter.w * meter.fill),
          duration: 220,
          ease: 'Quad.easeOut',
        });
      if (meter.stars > this.shownStars) {
        for (let i = this.shownStars; i < meter.stars; i++) {
          const st = this.meterStars[i];
          if (!st) continue;
          st.setTexture(HUD.star);
          this.tweens.add({ targets: st, scale: 0.8 / RS, angle: 360, duration: 380, yoyo: true });
        }
        this.shownStars = meter.stars;
        sfx.play('sparkle', 1.2);
      }
      const level = levelFor(score, this.def.levelEvery);
      if (level > this.level) {
        this.level = level;
        this.levelUp();
      }
    }
    if (this.timeFill) {
      const left = Math.max(0, 1 - elapsed / Math.max(1, durationSec));
      this.timeFill.width = Math.max(1, BAR.time.w * left);
      this.timeFill.setFillStyle(left < 0.2 ? PALETTE.fireRed : PALETTE.harborTeal);
    }
    return this.level;
  }

  /** The round's length (a test can shorten it). */
  protected get durationSec(): number {
    return this.durationOverride ?? this.def.durationSec;
  }

  private levelUp(): void {
    sfx.play('tada', 1.4, 0.5);
    voice.say('level-up', { minGapMs: 20000 });
    const banner = this.add
      .container(GAME_W / 2, 150)
      .setDepth(36)
      .setScale(0);
    const g = this.add.graphics();
    g.fillStyle(PALETTE.coinGold, 1).fillRoundedRect(-150, -44, 300, 88, 44);
    g.lineStyle(6, PALETTE.outline, 1).strokeRoundedRect(-150, -44, 300, 88, 44);
    banner.add(g);
    // Picture only: an up arrow and the level as stars-in-a-row dots.
    const arrow = this.add.graphics();
    arrow.fillStyle(0xffffff, 1);
    arrow.fillPoints(
      [
        { x: -110, y: 8 },
        { x: -84, y: -26 },
        { x: -58, y: 8 },
        { x: -72, y: 8 },
        { x: -72, y: 28 },
        { x: -96, y: 28 },
        { x: -96, y: 8 },
      ],
      true,
    );
    arrow.lineStyle(4, PALETTE.outline, 1);
    arrow.strokePoints(
      [
        { x: -110, y: 8 },
        { x: -84, y: -26 },
        { x: -58, y: 8 },
        { x: -72, y: 8 },
        { x: -72, y: 28 },
        { x: -96, y: 28 },
        { x: -96, y: 8 },
      ],
      true,
    );
    banner.add(arrow);
    banner.add(
      this.add.text(30, 0, `${this.level}`, { ...BIG_TEXT, fontSize: '56px' }).setOrigin(0.5),
    );
    this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 110,
      delay: 1100,
      duration: 350,
      onComplete: () => banner.destroy(),
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Good / oops
  // ---------------------------------------------------------------------------------------------

  /** Something went right at (x, y): a "+n" floats up, and the streak grows (hearts come back). */
  protected good(x: number, y: number, n = 1): void {
    const t = this.add
      .text(x, y, `+${n}`, { ...BIG_TEXT, fontSize: '40px', color: '#FFD23F' })
      .setOrigin(0.5)
      .setDepth(34);
    this.tweens.add({
      targets: t,
      y: y - 70,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
    if (this.streak.hit() && this.hearts.gain()) {
      const img = this.heartImgs[this.hearts.left - 1];
      if (img) {
        img.setAlpha(1).clearTint();
        this.tweens.add({ targets: img, scale: 0.5 / RS, duration: 160, yoyo: true });
      }
      sfx.play('sparkle', 0.9);
      voice.say('heart-back', { minGapMs: 15000 });
    }
  }

  /** A mistake: lose a heart (a little shake). With none left the round stops with "Oops!". */
  protected oops(): void {
    if (this.done) return;
    this.streak.miss();
    if (!this.hearts.enabled) return;
    const last = this.hearts.lose();
    const img = this.heartImgs[this.hearts.left];
    if (img) {
      this.tweens.add({ targets: img, scale: 0.46 / RS, duration: 90, yoyo: true });
      img.setTint(0x555a6b).setAlpha(0.55);
    }
    this.cameras.main.shake(140, 0.004);
    if (last) this.time.delayedCall(450, () => this.fail());
  }

  private failed = false;

  /** Out of hearts: a friendly "Oops!" with a go-again button. No coins, and nothing lost. */
  fail(): void {
    if (this.done) return;
    this.done = true;
    this.failed = true;
    this.quitBtn?.destroy();
    sfx.play('shrug');
    voice.say('minigame-oops', { interrupt: true });
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.4).setOrigin(0, 0).setDepth(40);
    // Three grey hearts, then the next try's hearts pop in over them.
    const next = heartsFor(this.def.hearts, this.fails + 1);
    for (let i = 0; i < next; i++) {
      const h = this.add
        .image(GAME_W / 2 + (i - (next - 1) / 2) * 76, 230, iconKey('heart'))
        .setScale(0)
        .setDepth(41);
      this.tweens.add({
        targets: h,
        scale: 0.55 / RS,
        delay: 250 + i * 110,
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
    const button = (x: number, key: string, scale: number, cb: () => void) => {
      const b = this.add
        .image(x, 440, key)
        .setScale(scale / RS)
        .setDepth(42);
      b.setInteractive({ useHandCursor: true });
      b.once('pointerup', cb);
      return b;
    };
    const plate = this.add.graphics().setDepth(41);
    plate.fillStyle(0x000000, 0.25).fillCircle(GAME_W / 2 + 84, 446, 92);
    plate.fillStyle(PALETTE.grass, 1).fillCircle(GAME_W / 2 + 80, 440, 92);
    plate.lineStyle(7, PALETTE.outline, 1).strokeCircle(GAME_W / 2 + 80, 440, 92);
    const again = button(GAME_W / 2 + 80, iconKey('retry'), 1.15, () => this.retry());
    this.tweens.add({ targets: again, angle: -18, duration: 500, yoyo: true, repeat: -1 });
    button(GAME_W / 2 - 150, MENU.back, 0.95, () => {
      sfx.play('pop');
      this.quit();
    });
    this.input.keyboard?.once('keydown-SPACE', () => this.retry());
    this.input.keyboard?.once('keydown-ENTER', () => this.retry());
  }

  /** Have another go, with more hearts. */
  retry(): void {
    if (this.closed || !this.failed) return;
    this.failed = false;
    sfx.play('pop', 1.2);
    this.scene.restart({
      id: this.id,
      plays: this.plays,
      fails: this.fails + 1,
      durationSec: this.durationOverride,
    });
  }

  /** End of the round: pay by tier, show it, then go back to the city. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    this.quitBtn?.destroy();
    const coins = this.state.finishMinigame(this.id, this.score);
    voice.say('minigame-done', { interrupt: true });
    sfx.play('tada');
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.35).setOrigin(0, 0).setDepth(40);
    const stars = coins >= 30 ? 3 : coins >= 15 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      const s = this.add
        .image(
          GAME_W / 2 + (i - 1) * 130,
          210 - (i === 1 ? 20 : 0),
          i < stars ? HUD.star : HUD.starEmpty,
        )
        .setScale(0)
        .setDepth(41);
      this.tweens.add({
        targets: s,
        scale: 1.1 / RS,
        delay: 200 * i,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }
    const coin = this.add
      .image(GAME_W / 2 - 60, 360, HUD.coin)
      .setScale(1.6 / RS)
      .setDepth(41);
    const txt = this.add
      .text(GAME_W / 2 - 10, 360, `+${coins}`, {
        ...BIG_TEXT,
        fontSize: '64px',
        color: '#FFD23F',
        strokeThickness: 10,
      })
      .setOrigin(0, 0.5)
      .setDepth(41);
    this.tweens.add({
      targets: [coin, txt],
      scale: { from: 0.6, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
    const back = this.add
      .image(GAME_W / 2, 540, HUD.check)
      .setScale(1 / RS)
      .setDepth(42)
      .setInteractive(
        new Phaser.Geom.Circle(79 * RS, 79 * RS, 75 * RS),
        Phaser.Geom.Circle.Contains,
      );
    this.tweens.add({ targets: back, scale: 1.08 / RS, duration: 500, yoyo: true, repeat: -1 });
    const close = () => this.close({ id: this.id, score: this.score, coins });
    back.once('pointerup', close);
    this.input.keyboard?.once('keydown-SPACE', close);
    this.input.keyboard?.once('keydown-ENTER', close);
    this.time.delayedCall(8000, close);
  }

  private close(result: MinigameResult): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.stop();
    this.scene.resume('City');
    this.scene.wake('Hud');
    this.game.events.emit(EV.minigameComplete, result);
  }

  /** Test hook: end now with a given score. */
  debugFinish(score: number): void {
    this.score = score;
    this.finish();
  }

  /** Test hooks: lose a heart; what the top bar shows. */
  debugOops(): void {
    this.oops();
  }

  debugRound() {
    return {
      id: this.id,
      score: this.score,
      hearts: this.hearts.left,
      maxHearts: this.hearts.max,
      level: this.level,
      failed: this.failed,
      fails: this.fails,
      bar: !!this.scoreLabel && !!this.meterFill && !!this.timeFill,
    };
  }
}

/**
 * The "go back" arrow (bottom-left, like the menus) that leaves a minigame part-way through
 * (playtest 2026-11-11: once started there was no way out). Esc does the same. Presses on it
 * never reach the game underneath (tap-anywhere games like Block Stack).
 */
export function addQuitButton(scene: Phaser.Scene, quit: () => void): Phaser.GameObjects.Image {
  const stop = (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) =>
    ev.stopPropagation();
  const btn = scene.add
    .image(QUIT_POS.x, QUIT_POS.y, MENU.back)
    .setScale(QUIT_SCALE / RS)
    .setDepth(35)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerdown', stop);
  btn.on('pointerup', (p: unknown, x: unknown, y: unknown, ev: Phaser.Types.Input.EventData) => {
    stop(p, x, y, ev);
    sfx.play('pop');
    quit();
  });
  scene.input.keyboard?.once('keydown-ESC', quit);
  return btn;
}

/** Where the quit arrow sits and how big (≥ 64 CSS px on a landscape phone). */
export const QUIT_POS = { x: 74, y: GAME_H - 74 };
const QUIT_SCALE = 0.75;

/** Back to the city without a result (a quit minigame, nothing to pay). */
export function leaveMinigame(scene: Phaser.Scene): void {
  scene.scene.stop();
  scene.scene.resume('City');
  scene.scene.wake('Hud');
  scene.game.events.emit(EV.menuClosed, {});
}

/** Close a picture menu (board, shop, job center) and tell the city what happened. */
export function closeMenu(scene: Phaser.Scene, result: Record<string, string> = {}): void {
  scene.scene.stop();
  scene.scene.resume('City');
  scene.scene.wake('Hud');
  scene.game.events.emit(EV.menuClosed, result);
}
