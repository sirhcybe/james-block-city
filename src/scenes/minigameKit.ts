import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { HUD } from '../art/hud';
import { MENU } from '../art/menu';
import { RS } from '../art/renderScale';
import { GAME_H, GAME_W } from '../config';
import type { GameState } from '../systems/GameState';
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

/**
 * Shared bones of every minigame scene (spec 003+): launched over the paused city with
 * `{ id, plays }`, pays by score tier through GameState, shows stars + coins + a big check
 * button, then returns to the city. Never a fail screen.
 */
export abstract class MinigameScene extends Phaser.Scene {
  protected id = '';
  protected plays = 0;
  protected state!: GameState;
  protected done = false;
  private closed = false;

  private quitBtn: Phaser.GameObjects.Image | null = null;

  init(data: { id?: string; plays?: number }): void {
    this.id = data.id ?? this.defaultId();
    this.plays = data.plays ?? 0;
    this.state = this.registry.get(STATE_KEY) as GameState;
    this.done = false;
    this.closed = false;
    // Every minigame gets the back arrow once its own create() has drawn the board.
    this.events.once(Phaser.Scenes.Events.CREATE, () => {
      this.quitBtn = addQuitButton(this, () => this.quit());
    });
  }

  /** Leave without finishing: no coins, no fuss, straight back to the city. */
  quit(): void {
    if (this.done || this.closed) return;
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
