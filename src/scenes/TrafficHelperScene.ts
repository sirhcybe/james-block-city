import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { characterFrameKey } from '../art/characters';
import { HUD } from '../art/hud';
import { MG, MG_CAR_COLORS, ROAD } from '../art/minigame';
import { RS, WT } from '../art/renderScale';
import { GAME_H, GAME_W } from '../config';
import type { GameState } from '../systems/GameState';
import { TrafficHelperModel, type THEvent } from '../systems/minigames';
import { EV, STATE_KEY, type MinigameResult } from './keys';
import { addQuitButton, leaveMinigame } from './minigameKit';

const CROSS_X = 640;
const WAIT_Y = 505;
const ARRIVE_Y = 268;
const TRACK = { x0: 420, x1: 860, y: 46 };

/**
 * Traffic Helper (Cop minigame): tap anywhere (or the big light) to turn it red so the cars stop
 * and the ducks and kids can cross. ~2 minutes, pays 5/15/30, can't be failed, eases off after
 * misses and gets a bit harder on replays. Runs as its own scene over the paused city.
 */
export class TrafficHelperScene extends Phaser.Scene {
  private model!: TrafficHelperModel;
  private id = 'traffic-helper';
  private state!: GameState;
  private light!: Phaser.GameObjects.Image;
  private carImgs = new Map<number, Phaser.GameObjects.Image>();
  private walkerImgs = new Map<number, Phaser.GameObjects.Image>();
  private scoreText!: Phaser.GameObjects.Text;
  private trackDuck!: Phaser.GameObjects.Image;
  private done = false;

  constructor() {
    super('TrafficHelper');
  }

  init(data: { id?: string; plays?: number; durationSec?: number }): void {
    this.id = data.id ?? 'traffic-helper';
    this.state = this.registry.get(STATE_KEY) as GameState;
    const def = this.state.content.minigames.find((m) => m.id === this.id)!;
    this.model = new TrafficHelperModel(
      data.durationSec ?? def.durationSec,
      data.plays ?? 0,
      def.difficultyStepPerReplay,
    );
    this.carImgs = new Map();
    this.walkerImgs = new Map();
    this.done = false;
    this.closed = false;
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.add
      .image(0, 0, MG.bg)
      .setOrigin(0, 0)
      .setScale(1 / RS);
    this.light = this.add
      .image(1090, 60, MG.light)
      .setOrigin(0, 0)
      .setScale(1 / RS)
      .setDepth(5);

    // Score: duck icon + number. Time: a little duck walking along a track to a flag.
    this.add
      .image(60, 50, MG.duck)
      .setScale(0.8 / RS)
      .setDepth(20);
    this.scoreText = this.add
      .text(104, 50, '0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#2B2D42',
        strokeThickness: 8,
        resolution: RS,
      })
      .setOrigin(0, 0.5)
      .setDepth(20);
    const track = this.add.graphics().setDepth(19);
    track.lineStyle(10, 0x2b2d42, 1);
    track.lineBetween(TRACK.x0, TRACK.y + 20, TRACK.x1, TRACK.y + 20);
    track.lineStyle(6, 0xffffff, 1);
    track.lineBetween(TRACK.x0, TRACK.y + 20, TRACK.x1, TRACK.y + 20);
    this.add
      .image(TRACK.x1 + 10, TRACK.y - 6, MG.flag)
      .setScale(1 / RS)
      .setDepth(20);
    this.trackDuck = this.add
      .image(TRACK.x0, TRACK.y, MG.duck)
      .setScale(0.55 / RS)
      .setDepth(21);

    // Tap anywhere (or press Space) to switch the light. Easy target for small fingers.
    this.input.on('pointerdown', () => this.toggle());
    this.input.keyboard?.on('keydown-SPACE', () => this.toggle());
    this.input.keyboard?.on('keydown-ENTER', () => this.toggle());

    this.quitBtn = addQuitButton(this, () => {
      if (this.done || this.closed) return;
      this.closed = true;
      leaveMinigame(this);
    });

    voice.say('minigame-intro', { interrupt: true });
  }

  private quitBtn: Phaser.GameObjects.Image | null = null;

  private toggle(): void {
    if (this.done) return;
    this.handle([this.model.toggleLight()]);
  }

  private handle(events: THEvent[]): void {
    for (const e of events) {
      if (e.type === 'light') {
        this.light.setTexture(e.red ? MG.lightRed : MG.light);
        sfx.play('pop', e.red ? 0.8 : 1.2);
        this.tweens.add({ targets: this.light, scale: 1.08 / RS, duration: 80, yoyo: true });
      } else if (e.type === 'score') {
        sfx.play('quack', 1.1);
        this.scoreText.setText(`${this.model.score}`);
        this.tweens.add({ targets: this.scoreText, scale: 1.3, duration: 90, yoyo: true });
        const img = this.walkerImgs.get(e.walker);
        if (img) {
          this.walkerImgs.delete(e.walker);
          this.tweens.add({
            targets: img,
            x: img.x + 260,
            y: img.y - 30,
            alpha: 0,
            duration: 900,
            onComplete: () => img.destroy(),
          });
        }
      } else if (e.type === 'miss') {
        sfx.play(e.reason === 'car' ? 'honk' : 'quack', e.reason === 'car' ? 1 : 0.7);
      } else if (e.type === 'finished') {
        this.finish();
      }
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.handle(this.model.update(dt));
    this.sync();
  }

  private sync(): void {
    const m = this.model;
    // Cars.
    const seen = new Set<number>();
    for (const c of m.cars) {
      seen.add(c.id);
      let img = this.carImgs.get(c.id);
      if (!img) {
        img = this.add
          .image(c.x, ROAD.laneY + 30, MG.car(c.id % MG_CAR_COLORS.length))
          .setOrigin(1, 0.95)
          .setScale(1 / RS)
          .setDepth(10);
        this.carImgs.set(c.id, img);
      }
      img.x = c.x;
    }
    for (const [id, img] of this.carImgs) {
      if (!seen.has(id)) {
        img.destroy();
        this.carImgs.delete(id);
      }
    }
    // Walkers: queue on the near sidewalk, cross up the crosswalk.
    let queue = 0;
    for (const w of m.walkers) {
      let img = this.walkerImgs.get(w.id);
      if (!img) {
        img =
          w.kind === 'duck'
            ? this.add.image(CROSS_X - 80 * 6, WAIT_Y, MG.duck).setScale(0.9 / RS)
            : this.add
                .image(
                  CROSS_X - 80 * 6,
                  WAIT_Y,
                  characterFrameKey(w.id % 2 ? 'walkerGreen' : 'walkerRed', 'SE', 0),
                )
                .setScale(1.3 / WT);
        img.setOrigin(0.5, 0.9).setDepth(12);
        this.walkerImgs.set(w.id, img);
      }
      let tx: number;
      let ty: number;
      if (w.state === 'crossing') {
        tx = CROSS_X;
        ty = WAIT_Y + (ARRIVE_Y - WAIT_Y) * w.t;
        img.y = ty; // crossing is driven exactly by the model
        if (w.kind === 'duck') img.setTexture(MG.duck);
        else
          img.setTexture(
            characterFrameKey(
              w.id % 2 ? 'walkerGreen' : 'walkerRed',
              'NE',
              Math.floor(w.t * 8) % 2 ? 1 : 0,
            ),
          );
      } else {
        tx = CROSS_X - 80 * queue;
        ty = WAIT_Y;
        queue++;
        if (w.kind === 'duck') img.setTexture(w.waitedFor > 5 ? MG.duckSad : MG.duck);
      }
      img.x += (tx - img.x) * 0.15;
      if (w.state !== 'crossing') img.y += (ty - img.y) * 0.15;
    }
    const k = Math.min(1, m.elapsed / m.durationSec);
    this.trackDuck.x = TRACK.x0 + (TRACK.x1 - TRACK.x0) * k;
  }

  /** End of the round: pay by tier, show it, then go back to the city. Never a fail screen. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    this.quitBtn?.destroy();
    const coins = this.state.finishMinigame(this.id, this.model.score);
    voice.say('minigame-done', { interrupt: true });
    sfx.play('tada');

    const shade = this.add
      .rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.35)
      .setOrigin(0, 0)
      .setDepth(40);
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
        fontFamily: 'system-ui, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#FFD23F',
        stroke: '#2B2D42',
        strokeThickness: 10,
        resolution: RS,
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
    const close = () => this.close({ id: this.id, score: this.model.score, coins });
    back.once('pointerup', close);
    this.input.keyboard?.once('keydown-SPACE', close);
    this.input.keyboard?.once('keydown-ENTER', close);
    this.time.delayedCall(8000, close);
    void shade;
  }

  private closed = false;

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
    this.model.score = score;
    this.finish();
  }
}
