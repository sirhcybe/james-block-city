import type Phaser from 'phaser';
import { getBaked } from '../art/blocks';
import { WT } from '../art/renderScale';
import {
  vehicleFrameKey,
  vehicleLightKey,
  type LightFrame,
  type VehicleLook,
} from '../art/vehicles';
import { gridToScreen, type Vec2 } from '../iso/projection';
import type { LaneGraph, LaneNode } from '../iso/roads';
import { DRIVE_TUNING, LaneDriver, type DriveInput } from './LaneDriver';

/**
 * A drawn vehicle on the lane graph: road-assist motion (LaneDriver) + sprite with spinning wheels,
 * a flashing light bar, and cartoon hop / wobble offsets for bumps.
 */
export class Vehicle {
  readonly driver: LaneDriver;
  readonly img: Phaser.GameObjects.Image;
  /** Lit light bar drawn over the body while the siren flashes (police vehicles). */
  readonly lightImg: Phaser.GameObjects.Image | null = null;
  look: VehicleLook;
  private wheelT = 0;
  private wheel: 0 | 1 = 0;
  private lightT = 0;
  private light: LightFrame = 0;
  /** Seconds of light-bar flashing left (siren). */
  lightsFor = 0;
  /** Cartoon offsets (logical px), tweened by bump effects. */
  hop = 0;

  constructor(
    scene: Phaser.Scene,
    graph: LaneGraph,
    look: VehicleLook,
    start: LaneNode,
    heading: Vec2,
    maxSpeed?: number,
    accelScale = 1,
  ) {
    this.look = look;
    this.driver = new LaneDriver(graph, start, heading, maxSpeed, accelScale);
    const meta = getBaked(vehicleFrameKey(look.name, this.driver.dir8, 0));
    this.img = scene.add
      .image(0, 0, meta.key)
      .setOrigin(meta.originX, meta.originY)
      .setScale(1 / WT);
    if (look.lightBar) {
      const lm = getBaked(vehicleLightKey(look.name, 0, 1));
      this.lightImg = scene.add
        .image(0, 0, lm.key)
        .setOrigin(lm.originX, lm.originY)
        .setScale(1 / WT)
        .setVisible(false);
    }
    this.sync(0);
  }

  get pos(): Vec2 {
    return this.driver.pos;
  }

  /** Swap the look (e.g. getaway car once Pickles has hopped out). Frames share one origin. */
  setLook(look: VehicleLook): void {
    this.look = look;
    this.sync(0);
  }

  flash(seconds: number): void {
    this.lightsFor = Math.max(this.lightsFor, seconds);
  }

  update(dt: number, input: DriveInput): void {
    this.driver.update(dt, input);
    this.sync(dt);
  }

  sync(dt: number): void {
    const p = gridToScreen(this.driver.pos.x, this.driver.pos.y);
    // A little hop while spinning round (U-turn).
    const spin = this.driver.spin;
    const spinHop = spin ? Math.sin(Math.PI * Math.min(1, spin.t / DRIVE_TUNING.uturnSec)) * 10 : 0;
    this.img.setPosition(p.x, p.y - this.hop - spinHop);

    this.wheelT += Math.abs(this.driver.speed) * dt;
    if (this.wheelT > 0.18) {
      this.wheelT = 0;
      this.wheel = this.wheel === 0 ? 1 : 0;
    }
    if (this.look.lightBar && this.lightsFor > 0) {
      this.lightsFor -= dt;
      this.lightT += dt;
      if (this.lightT > 0.12 || this.light === 0) {
        this.lightT = 0;
        this.light = this.light === 1 ? 2 : 1;
      }
    } else this.light = 0;
    const d8 = this.driver.dir8;
    this.img.setTexture(vehicleFrameKey(this.look.name, d8, this.wheel));
    if (this.lightImg) {
      const on = this.light !== 0 && this.img.visible;
      this.lightImg.setVisible(on);
      if (on) {
        this.lightImg
          .setTexture(vehicleLightKey(this.look.name, d8, this.light as 1 | 2))
          .setPosition(this.img.x, this.img.y)
          .setDepth(this.img.depth + 0.5)
          .setAlpha(this.img.alpha);
      }
    }
  }

  /** Lights currently flashing (siren on). */
  get flashing(): boolean {
    return this.lightsFor > 0;
  }

  placeAt(node: LaneNode, heading: Vec2): void {
    this.driver.placeAt(node, heading);
    this.sync(0);
  }
}
