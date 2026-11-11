import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ACTION_SIZE, COIN_SIZE, HUD, SIREN_SIZE } from '../art/hud';
import { RS } from '../art/renderScale';
import { UI } from '../art/ui';
import { GAME_H, GAME_W } from '../config';
import type { InputMapper } from '../input/InputMapper';
import type { GameState } from '../systems/GameState';
import { EV, HUD_HIT_KEY, HUD_INFO_KEY, INPUT_KEY, STATE_KEY, type HudInfo } from './keys';

const ACTION_POS = { x: GAME_W - 110, y: GAME_H - 110 };
const SIREN_POS = { x: GAME_W - 110, y: GAME_H - 270 };

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
  private shownCoins = 0;
  private lastAction: HudInfo['action'] | null = null;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    const state = this.registry.get(STATE_KEY) as GameState;

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
    // The world ignores pointers that land on these buttons.
    this.registry.set(HUD_HIT_KEY, (x: number, y: number) => {
      const near = (p: { x: number; y: number }, r: number) => Math.hypot(x - p.x, y - p.y) <= r;
      return (
        near(ACTION_POS, ACTION_SIZE / 2 + 6) ||
        (this.siren.visible && near(SIREN_POS, SIREN_SIZE / 2 + 6))
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
    this.siren.setTexture(info.sirenOn ? HUD.sirenOn : HUD.siren);

    const donuts = info.donuts > 0;
    this.donutIcon.setVisible(donuts);
    this.donutText.setVisible(donuts).setText(`${info.donuts}`);

    if (info.hint) {
      const x = Phaser.Math.Clamp(info.hint.x, 50, GAME_W - 50);
      const y = Phaser.Math.Clamp(info.hint.y, 100, GAME_H - 20);
      this.arrow.setVisible(true).setPosition(x, y);
      // Off-screen targets: tip the arrow toward them.
      const dx = info.hint.x - x;
      const dy = info.hint.y - y;
      this.arrow.setRotation(dx || dy ? Math.atan2(dy, dx) - Math.PI / 2 : 0);
    } else this.arrow.setVisible(false);
  }
}
