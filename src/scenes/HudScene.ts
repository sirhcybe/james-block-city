import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ACTION_SIZE, COIN_SIZE, HUD, SIREN_SIZE, UNIFORM_SIZE } from '../art/hud';
import { RS } from '../art/renderScale';
import { UI } from '../art/ui';
import { GAME_H, GAME_W } from '../config';
import type { InputMapper } from '../input/InputMapper';
import type { GameState } from '../systems/GameState';
import { arrowPlace } from '../systems/guide';
import {
  EV,
  HUD_HIT_KEY,
  HUD_INFO_KEY,
  INPUT_KEY,
  OPEN_JOBS_KEY,
  STATE_KEY,
  type HudInfo,
} from './keys';

const ACTION_POS = { x: GAME_W - 110, y: GAME_H - 110 };
const SIREN_POS = { x: GAME_W - 110, y: GAME_H - 270 };
const UNIFORM_POS = { x: GAME_W - 80, y: 70 };
/** The objective arrow keeps clear of the coin counter and the buttons. */
const ARROW_MARGIN = { left: 70, right: 230, top: 120, bottom: 70 };

/**
 * Screen-space overlay: coin counter (icon + number), carried donuts, the big Action button,
 * the Siren button (while driving), the touch joystick, the idle hint arrow and the mission stars.
 * No words anywhere.
 */
export class HudScene extends Phaser.Scene {
  private base!: Phaser.GameObjects.Image;
  private knob!: Phaser.GameObjects.Image;
  private coinIcon!: Phaser.GameObjects.Image;
  private coinText!: Phaser.GameObjects.Text;
  private donutIcon!: Phaser.GameObjects.Image;
  private donutText!: Phaser.GameObjects.Text;
  private action!: Phaser.GameObjects.Image;
  private siren!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Image;
  private badges: Phaser.GameObjects.Image[] = [];
  private uniform!: Phaser.GameObjects.Image;
  private state!: GameState;
  private shownCoins = 0;
  private lastAction: HudInfo['action'] | null = null;
  private tracker!: Phaser.GameObjects.Graphics;
  private trackerSig = '';

  constructor() {
    super('Hud');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const state = this.registry.get(STATE_KEY) as GameState;
    this.state = state;

    // Coins (top-left): icon + number. Numbers are fine for a 6-year-old.
    this.coinIcon = this.add.image(54, 50, HUD.coin).setScale(1 / RS);
    this.shownCoins = state.economy.coins;
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#2B2D42',
      strokeThickness: 8,
      resolution: RS,
    };
    this.coinText = this.add
      .text(54 + COIN_SIZE / 2 + 10, 50, `${this.shownCoins}`, textStyle)
      .setOrigin(0, 0.5);
    this.donutIcon = this.add
      .image(54, 186, HUD.donut)
      .setScale(1 / RS)
      .setVisible(false);
    this.donutText = this.add
      .text(54 + 34, 186, '0', { ...textStyle, fontSize: '36px' })
      .setOrigin(0, 0.5)
      .setVisible(false);

    // Mission tracker (top middle): one dot per step, small dots for a step's parts.
    this.tracker = this.add.graphics();
    this.trackerSig = '';

    // Badges earned (under the coins).
    this.badges = [];
    for (const b of state.save.data.badges) this.addBadge(b, false);

    // Big Action button (bottom-right) and Siren above it. Both ≥ 64 CSS px.
    this.action = this.add
      .image(ACTION_POS.x, ACTION_POS.y, HUD.actionIdle)
      .setScale(1 / RS)
      .setInteractive(this.circleHit(ACTION_SIZE), Phaser.Geom.Circle.Contains);
    this.action.on('pointerdown', () => {
      this.mapper()?.pressAction();
      this.press(this.action);
    });
    this.siren = this.add
      .image(SIREN_POS.x, SIREN_POS.y, HUD.siren)
      .setScale(1 / RS)
      .setVisible(false)
      .setInteractive(this.circleHit(SIREN_SIZE), Phaser.Geom.Circle.Contains);
    this.siren.on('pointerdown', () => {
      this.mapper()?.pressSiren();
      this.press(this.siren);
    });
    // Quick change (spec 005): with all three badges, switch uniforms from anywhere.
    this.uniform = this.add
      .image(UNIFORM_POS.x, UNIFORM_POS.y, HUD.uniform)
      .setScale(1 / RS)
      .setVisible(false)
      .setInteractive(this.circleHit(UNIFORM_SIZE), Phaser.Geom.Circle.Contains);
    this.uniform.on('pointerdown', () => {
      this.press(this.uniform);
      (this.registry.get(OPEN_JOBS_KEY) as (() => void) | undefined)?.();
    });

    // The world ignores pointers that land on these buttons.
    this.registry.set(HUD_HIT_KEY, (x: number, y: number) => {
      const near = (p: { x: number; y: number }, r: number) => Math.hypot(x - p.x, y - p.y) <= r;
      return (
        near(ACTION_POS, ACTION_SIZE / 2 + 6) ||
        (this.siren.visible && near(SIREN_POS, SIREN_SIZE / 2 + 6)) ||
        (this.uniform.visible && near(UNIFORM_POS, UNIFORM_SIZE / 2 + 6))
      );
    });

    this.base = this.add
      .image(0, 0, UI.stickBase)
      .setScale(1 / RS)
      .setVisible(false);
    this.knob = this.add
      .image(0, 0, UI.stickKnob)
      .setScale(1 / RS)
      .setVisible(false);
    this.arrow = this.add
      .image(0, 0, HUD.arrow)
      .setScale(1 / RS)
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.tweens.add({
      targets: this.arrow,
      scale: { from: 1 / RS, to: 1.15 / RS },
      duration: 380,
      yoyo: true,
      repeat: -1,
    });

    const offCoins = state.economy.onChange((c) => this.flyCoins(c.delta, c.coins));
    const onMission = (r: { stars: number }) => this.celebrate(r.stars);
    const onBadge = (job: string) => this.ceremony(job);
    // Finale parade (spec 007): night tint with twinkling lit windows, under the buttons.
    const night = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x0b1640, 0)
      .setOrigin(0, 0)
      .setDepth(-10);
    const lights: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 14; i++) {
      const l = this.add
        .circle(
          Math.random() * GAME_W,
          Math.random() * GAME_H * 0.8,
          3 + Math.random() * 3,
          0xffe680,
          0,
        )
        .setDepth(-9);
      lights.push(l);
    }
    const onNight = (on: boolean) => {
      this.tweens.add({ targets: night, fillAlpha: on ? 0.5 : 0, duration: 1500 });
      for (const l of lights) {
        this.tweens.killTweensOf(l);
        if (on)
          this.tweens.add({
            targets: l,
            fillAlpha: { from: 0.2, to: 0.95 },
            duration: 400 + Math.random() * 800,
            yoyo: true,
            repeat: -1,
            delay: Math.random() * 1500,
          });
        else this.tweens.add({ targets: l, fillAlpha: 0, duration: 800 });
      }
    };
    this.game.events.on(EV.night, onNight);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(EV.night, onNight));
    this.game.events.on(EV.missionComplete, onMission);
    this.game.events.on(EV.badge, onBadge);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offCoins();
      this.game.events.off(EV.missionComplete, onMission);
      this.game.events.off(EV.badge, onBadge);
      this.registry.remove(HUD_HIT_KEY);
    });
  }

  private addBadge(job: string, pop: boolean): Phaser.GameObjects.Image {
    const img = this.add
      .image(54 + this.badges.length * 70, 118, HUD.badge(job))
      .setScale(pop ? 0 : 1 / RS);
    this.badges.push(img);
    if (pop) this.tweens.add({ targets: img, scale: 1 / RS, duration: 300, ease: 'Back.easeOut' });
    return img;
  }

  /** Badge ceremony: a big shiny badge spins in with sparkles, then flies to its HUD slot. */
  private ceremony(job: string): void {
    sfx.play('tada');
    sfx.play('sparkle');
    const cx = GAME_W / 2;
    const cy = GAME_H / 2 - 20;
    const shade = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(70);
    this.tweens.add({ targets: shade, fillAlpha: 0.45, duration: 300 });
    const big = this.add
      .image(cx, cy, `${HUD.badge(job)}-big`)
      .setScale(0)
      .setDepth(72);
    this.tweens.add({
      targets: big,
      scale: 1 / RS,
      angle: 360,
      duration: 900,
      ease: 'Back.easeOut',
    });
    const sparkles: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const st = this.add
        .image(cx, cy, HUD.star)
        .setScale(0.3 / RS)
        .setDepth(71);
      sparkles.push(st);
      this.tweens.add({
        targets: st,
        x: cx + Math.cos(a) * 230,
        y: cy + Math.sin(a) * 170,
        angle: 180,
        duration: 900,
        delay: 300,
        ease: 'Quad.easeOut',
      });
      this.tweens.add({ targets: st, alpha: 0, delay: 1800, duration: 600 });
    }
    this.time.delayedCall(3200, () => {
      const slot = { x: 54 + this.badges.length * 70, y: 118 };
      this.tweens.add({
        targets: shade,
        fillAlpha: 0,
        duration: 400,
        onComplete: () => shade.destroy(),
      });
      this.tweens.add({
        targets: big,
        x: slot.x,
        y: slot.y,
        scale: 64 / 300 / RS,
        duration: 700,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          big.destroy();
          for (const s of sparkles) s.destroy();
          this.addBadge(job, true);
          sfx.play('pop', 1.3);
        },
      });
    });
  }

  private circleHit(size: number): Phaser.Geom.Circle {
    const c = (size / 2 + 4) * RS;
    return new Phaser.Geom.Circle(c, c, (size / 2) * RS);
  }

  private mapper(): InputMapper | undefined {
    return this.registry.get(INPUT_KEY) as InputMapper | undefined;
  }

  private press(img: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: img, scale: 0.88 / RS, duration: 70, yoyo: true });
  }

  /** Coins fly to the counter one by one; the counter ticks up with a rising ding. */
  private flyCoins(delta: number, total: number): void {
    if (delta <= 0) {
      // Spent in the Shop: just show the new total (coins only fly in when earned).
      this.shownCoins = total;
      this.coinText.setText(`${total}`);
      return;
    }
    const n = Math.min(delta, 12);
    for (let i = 0; i < n; i++) {
      const c = this.add
        .image(
          GAME_W / 2 + (Math.random() - 0.5) * 120,
          GAME_H / 2 + (Math.random() - 0.5) * 80,
          HUD.coin,
        )
        .setScale(1 / RS)
        .setDepth(50);
      this.tweens.add({
        targets: c,
        x: this.coinIcon.x,
        y: this.coinIcon.y,
        delay: i * 70,
        duration: 600,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          c.destroy();
          sfx.coin();
          this.shownCoins =
            i === n - 1 ? total : Math.min(total, this.shownCoins + Math.ceil(delta / n));
          this.coinText.setText(`${this.shownCoins}`);
          this.tweens.add({ targets: this.coinIcon, scale: 1.25 / RS, duration: 80, yoyo: true });
        },
      });
    }
  }

  /** Mission done: stars pop in the middle of the screen. */
  private celebrate(stars: number): void {
    const items: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      const img = this.add
        .image(
          GAME_W / 2 + (i - 1) * 130,
          GAME_H / 2 - 120 - (i === 1 ? 24 : 0),
          i < stars ? HUD.star : HUD.starEmpty,
        )
        .setScale(0)
        .setDepth(60);
      items.push(img);
      this.tweens.add({
        targets: img,
        scale: 1.2 / RS,
        delay: 250 * i,
        duration: 320,
        ease: 'Back.easeOut',
        onStart: () => (i < stars ? sfx.play('pop', 1 + i * 0.2) : undefined),
      });
    }
    this.time.delayedCall(3200, () =>
      this.tweens.add({
        targets: items,
        alpha: 0,
        duration: 400,
        onComplete: () => items.forEach((s) => s.destroy()),
      }),
    );
  }

  /**
   * Mission progress (spec 008): a row of dots, one per step. Done steps are gold with a tick,
   * the step you're on is a white ring, and under it small dots count its parts (flags passed,
   * fires out, robbers caught). Redrawn only when something changes.
   */
  private drawTracker(m: HudInfo['mission']): void {
    const sig = m ? `${m.goals}:${m.index}:${m.parts}:${m.partsDone}` : '';
    if (sig === this.trackerSig) return;
    this.trackerSig = sig;
    const g = this.tracker;
    g.clear();
    if (!m) return;
    const gap = 46;
    const x0 = GAME_W / 2 - ((m.goals - 1) * gap) / 2;
    const y = 40;
    g.fillStyle(0x2b2d42, 0.3);
    g.fillRoundedRect(x0 - 32, y - 26, (m.goals - 1) * gap + 64, 52, 26);
    g.lineStyle(5, 0x2b2d42, 1);
    if (m.goals > 1) g.lineBetween(x0, y, x0 + (m.goals - 1) * gap, y);
    for (let i = 0; i < m.goals; i++) {
      const x = x0 + i * gap;
      const done = i < m.index;
      const now = i === m.index;
      g.fillStyle(done ? 0xffd23f : now ? 0xffffff : 0x9aa0b0, 1);
      g.fillCircle(x, y, now ? 16 : 13);
      g.lineStyle(4, 0x2b2d42, 1);
      g.strokeCircle(x, y, now ? 16 : 13);
      if (done) {
        g.lineStyle(4, 0x2b2d42, 1);
        g.beginPath();
        g.moveTo(x - 6, y);
        g.lineTo(x - 1, y + 5);
        g.lineTo(x + 7, y - 5);
        g.strokePath();
      }
    }
    if (m.parts > 1) {
      const px = x0 + m.index * gap - ((m.parts - 1) * 20) / 2;
      for (let i = 0; i < m.parts; i++) {
        g.fillStyle(i < m.partsDone ? 0x7bd35a : 0xffffff, 1);
        g.fillCircle(px + i * 20, y + 38, 7);
        g.lineStyle(3, 0x2b2d42, 1);
        g.strokeCircle(px + i * 20, y + 38, 7);
      }
    }
  }

  update(): void {
    const info = this.registry.get(HUD_INFO_KEY) as HudInfo | undefined;
    const js = this.mapper()?.joystick;
    const show = !!js?.active;
    this.base.setVisible(show);
    this.knob.setVisible(show);
    if (js && show) {
      this.base.setPosition(js.origin.x, js.origin.y);
      this.knob.setPosition(js.knob.x, js.knob.y);
    }
    if (!info) return;

    if (info.action !== this.lastAction) {
      this.lastAction = info.action;
      this.action.setTexture(
        info.action === 'enter'
          ? HUD.actionEnter
          : info.action === 'exit'
            ? HUD.actionExit
            : info.action === 'net'
              ? HUD.actionNet
              : info.action === 'hose'
                ? HUD.actionHose
                : info.action === 'blast'
                  ? HUD.actionBlast
                  : HUD.actionIdle,
      );
      if (info.action !== 'none')
        this.tweens.add({ targets: this.action, scale: 1.12 / RS, duration: 140, yoyo: true });
    }
    // Siren while driving; on foot the same button blows a police whistle.
    this.siren.setVisible(true);
    this.uniform.setVisible(this.state.progress.badges.length >= 3);
    this.siren.setTexture(info.sirenOn ? HUD.sirenOn : HUD.siren);

    this.drawTracker(info.mission);

    const donuts = info.donuts > 0;
    this.donutIcon.setVisible(donuts);
    this.donutText.setVisible(donuts).setText(`${info.donuts}`);

    if (info.hint) {
      // On screen: the arrow bounces above the target. Off screen: it sits on the edge of the
      // screen (clear of the buttons) and points the way to go.
      const a = arrowPlace(info.hint, GAME_W, GAME_H, ARROW_MARGIN);
      const bob = Math.sin(this.time.now / 160) * 8;
      if (a.onScreen) this.arrow.setPosition(a.x, a.y - 6 + bob).setRotation(0);
      else
        this.arrow
          .setPosition(a.x + Math.cos(a.angle) * bob, a.y + Math.sin(a.angle) * bob)
          .setRotation(a.angle - Math.PI / 2);
      this.arrow.setVisible(true);
    } else this.arrow.setVisible(false);
  }
}
