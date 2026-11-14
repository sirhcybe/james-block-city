import type Phaser from 'phaser';
import { getBaked } from '../art/blocks';
import { boatFrameKey, type BoatLook } from '../art/boats';
import { WT } from '../art/renderScale';
import { screenDirToGrid } from '../input/direction';
import { gridToScreen, type Vec2 } from '../iso/projection';
import { BoatModel, type SeaChart } from '../systems/boat';
import { dir8ForAngle, type DriveInput } from './LaneDriver';

/**
 * A drawn boat (spec 008): the free-steering BoatModel plus a sprite that bobs on the swell.
 * It offers the same small surface the city uses on road vehicles (`pos`, `img`, `driver.speed`,
 * `driver.headingAngle`, `flash`, `hop`), so hopping in, the siren, mission checks and the HUD
 * treat it like any other ride.
 */
export class Boat {
  readonly kind = 'boat' as const;
  readonly model: BoatModel;
  readonly img: Phaser.GameObjects.Image;
  /** The slice of LaneDriver the city reads on whatever is being ridden. */
  readonly driver: {
    speed: number;
    readonly headingAngle: number;
    readonly path: string[];
    cancelPath(): void;
    goToward(p: Vec2): boolean;
  };
  lightsFor = 0;
  hop = 0;
  private t = 0;
  private frame: 0 | 1 = 0;
  private frameT = 0;

  constructor(
    scene: Phaser.Scene,
    sea: SeaChart,
    readonly look: BoatLook,
    start: Vec2,
    heading = 0,
  ) {
    const model = new BoatModel(sea, start, heading);
    this.model = model;
    this.driver = {
      get speed() {
        return model.speed;
      },
      set speed(v: number) {
        if (v === 0) model.stop();
      },
      get headingAngle() {
        return model.heading;
      },
      path: [],
      cancelPath: () => (model.target = null),
      goToward: (p) => model.goToward(p),
    };
    const meta = getBaked(boatFrameKey(look.name, dir8ForAngle(heading), 0));
    this.img = scene.add
      .image(0, 0, meta.key)
      .setOrigin(meta.originX, meta.originY)
      .setScale(1 / WT);
    this.sync(0);
  }

  get pos(): Vec2 {
    return this.model.pos;
  }

  get flashing(): boolean {
    return this.lightsFor > 0;
  }

  flash(seconds: number): void {
    this.lightsFor = Math.max(this.lightsFor, seconds);
  }

  /** Put the boat somewhere (mooring, tests). */
  moveTo(p: Vec2): void {
    this.model.pos = { ...p };
    this.model.stop();
    this.sync(0);
  }

  update(dt: number, input: DriveInput): void {
    const stick = input.stick ? screenDirToGrid(input.stick) : null;
    this.model.update(dt, stick);
    this.sync(dt);
  }

  sync(dt: number): void {
    this.t += dt;
    if (this.lightsFor > 0) this.lightsFor -= dt;
    const moving = this.model.speed > 0.6;
    this.frameT += dt * (moving ? 1 : 0.35);
    if (this.frameT > 0.22) {
      this.frameT = 0;
      this.frame = this.frame === 0 ? 1 : 0;
    }
    const p = gridToScreen(this.model.pos.x, this.model.pos.y);
    const bob = Math.sin(this.t * 2.4) * 1.6;
    this.img
      .setPosition(p.x, p.y - this.hop + bob)
      .setTexture(boatFrameKey(this.look.name, dir8ForAngle(this.model.heading), this.frame));
    // The siren: the whole boat blinks red and blue.
    if (this.lightsFor > 0) this.img.setTint(Math.floor(this.t * 8) % 2 ? 0xffb0b0 : 0xb0c8ff);
    else this.img.clearTint();
  }
}
