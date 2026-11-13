import type Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { voice } from '../audio/voice';
import { characterFrameKey } from '../art/characters';
import { MG, MG_CAR_COLORS, ROAD } from '../art/minigame';
import { RS, WT } from '../art/renderScale';
import { TrafficHelperModel, type THEvent } from '../systems/minigames';
import { MinigameScene } from './minigameKit';

const CROSS_X = 640;
const WAIT_Y = 505;
const ARRIVE_Y = 268;

/**
 * Traffic Helper, "Ducks Crossing" (Cop minigame): tap anywhere (or the big light) to turn it red
 * so the cars stop and the ducks and kids can cross. Turn it green again to let the cars go, but
 * only once everyone is across: a car on the crossing while someone is on it honks, the walker
 * flaps back to the kerb, and a heart goes (spec 008). No hearts left = "Oops, try again".
 * ~2 minutes, pays 5/15/30, speeds up every few crossings and on replays, eases off after misses.
 */
export class TrafficHelperScene extends MinigameScene {
  private model!: TrafficHelperModel;
  private light!: Phaser.GameObjects.Image;
  private carImgs = new Map<number, Phaser.GameObjects.Image>();
  private walkerImgs = new Map<number, Phaser.GameObjects.Image>();

  constructor() {
    super('TrafficHelper');
  }

  protected defaultId(): string {
    return 'traffic-helper';
  }

  protected get score(): number {
    return this.model.score;
  }

  protected set score(v: number) {
    this.model.score = v;
  }

  override init(data: { id?: string; plays?: number; fails?: number; durationSec?: number }): void {
    super.init(data);
    this.model = new TrafficHelperModel(
      this.durationSec,
      this.plays,
      this.def.difficultyStepPerReplay,
    );
    this.carImgs = new Map();
    this.walkerImgs = new Map();
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.add
      .image(0, 0, MG.bg)
      .setOrigin(0, 0)
      .setScale(1 / RS);
    // Clouds drifting over the street.
    for (let i = 0; i < 3; i++) {
      const c = this.add.graphics().setDepth(1);
      c.fillStyle(0xffffff, 0.9);
      c.fillEllipse(0, 0, 130, 40).fillEllipse(-30, -16, 70, 40).fillEllipse(26, -20, 84, 48);
      c.setPosition(120 + i * 430, 112 + (i % 2) * 26).setScale(0.6 + i * 0.12);
      this.tweens.add({
        targets: c,
        x: c.x + 160,
        duration: 26000 + i * 6000,
        yoyo: true,
        repeat: -1,
      });
    }
    this.light = this.add
      .image(1090, 96, MG.light)
      .setOrigin(0, 0)
      .setScale(0.9 / RS)
      .setDepth(5);
    this.addTopBar('duck');

    // Tap anywhere (or press Space) to switch the light. Easy target for small fingers.
    this.input.on('pointerdown', () => this.toggle());
    this.input.keyboard?.on('keydown-SPACE', () => this.toggle());
    this.input.keyboard?.on('keydown-ENTER', () => this.toggle());

    voice.say('minigame-intro', { interrupt: true });
  }

  private toggle(): void {
    if (this.done) return;
    this.handle([this.model.toggleLight()]);
  }

  private handle(events: THEvent[]): void {
    for (const e of events) {
      if (e.type === 'light') {
        this.light.setTexture(e.red ? MG.lightRed : MG.light);
        sfx.play('pop', e.red ? 0.8 : 1.2);
        this.tweens.add({ targets: this.light, scale: 0.98 / RS, duration: 80, yoyo: true });
      } else if (e.type === 'score') {
        sfx.play('quack', 1.1);
        const img = this.walkerImgs.get(e.walker);
        this.good(CROSS_X, ARRIVE_Y - 50);
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
      } else if (e.type === 'scare') {
        // Honk! The walker flaps back to the kerb. Nobody is touched, ever.
        sfx.play('honk', 1.2);
        sfx.play('quack', 1.5, 0.8);
        const img = this.walkerImgs.get(e.walker);
        if (img) {
          img.y = WAIT_Y;
          this.tweens.add({ targets: img, y: WAIT_Y - 46, duration: 130, yoyo: true, repeat: 1 });
          this.tweens.add({
            targets: img,
            angle: { from: -14, to: 14 },
            duration: 70,
            yoyo: true,
            repeat: 3,
            onComplete: () => img.setAngle(0),
          });
        }
        if (e.hurt) {
          voice.say('th-scare', { minGapMs: 7000 });
          this.oops();
        }
      } else if (e.type === 'finished') {
        this.finish();
      }
    }
  }

  update(_t: number, deltaMs: number): void {
    if (this.done) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.handle(this.model.update(dt));
    this.model.level = this.syncTopBar(this.model.elapsed, this.model.durationSec);
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
      if (w.state === 'crossing') {
        tx = CROSS_X;
        img.y = WAIT_Y + (ARRIVE_Y - WAIT_Y) * w.t; // crossing is driven exactly by the model
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
        queue++;
        if (w.kind === 'duck') img.setTexture(w.waitedFor > 5 ? MG.duckSad : MG.duck);
        if (!this.tweens.isTweening(img)) img.y += (WAIT_Y - img.y) * 0.15;
      }
      img.x += (tx - img.x) * 0.15;
    }
  }

  /** Test hook: the light and who is where. */
  debugTraffic() {
    return {
      red: this.model.red,
      crossing: this.model.walkers.filter((w) => w.state === 'crossing').length,
      waiting: this.model.walkers.filter((w) => w.state === 'waiting').length,
      scares: this.model.scares,
    };
  }

  /** Test hook: switch the light. */
  debugToggle(): void {
    this.toggle();
  }
}
