import type Phaser from 'phaser';
import type { VehicleLook } from '../art/vehicles';
import type { Vec2 } from '../iso/projection';
import type { LaneGraph, LaneNode } from '../iso/roads';
import type { BranchChooser } from './LaneDriver';
import { Vehicle } from './Vehicle';

/** Friendly town traffic speed (tiles/s). */
export const TRAFFIC_SPEED = 2.6;
/** A siren (or whistle) within this many tiles makes traffic stop and wait... */
export const SIREN_REACH = 7;
/** ...for this long (s). */
export const SIREN_WAIT = 5;

/**
 * An ambient town car: wanders the roads, choosing branches at random. It always gives way: it
 * stops for anyone or anything in front of it (so nobody is ever hit), and it waits when a police
 * siren goes off nearby (spec 003: Duck Crossing).
 */
export class TrafficCar {
  readonly vehicle: Vehicle;
  /** Seconds left waiting for a siren. */
  waiting = 0;

  constructor(
    scene: Phaser.Scene,
    graph: LaneGraph,
    look: VehicleLook,
    start: LaneNode,
    heading: Vec2,
    private readonly rand: () => number = Math.random,
  ) {
    this.vehicle = new Vehicle(scene, graph, look, start, heading);
  }

  get pos(): Vec2 {
    return this.vehicle.pos;
  }

  /** True while it's stopped for a siren (ducks may cross). */
  get stoppedForSiren(): boolean {
    return this.waiting > 0;
  }

  /** A siren went off at `at`. */
  hearSiren(at: Vec2): void {
    if (Math.hypot(at.x - this.pos.x, at.y - this.pos.y) <= SIREN_REACH) this.waiting = SIREN_WAIT;
  }

  private chooser: BranchChooser = (options, heading) => {
    const fwd = options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !(o.x === -heading.x && o.y === -heading.y));
    const pool = fwd.length > 0 ? fwd : options.map((o, i) => ({ o, i }));
    return pool[Math.floor(this.rand() * pool.length)]!.i;
  };

  /** Something is just ahead in its lane. */
  blockedBy(obstacles: readonly Vec2[]): boolean {
    const d = this.vehicle.driver.dir;
    const p = this.pos;
    for (const o of obstacles) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const along = dx * d.x + dy * d.y;
      const side = Math.abs(dx * d.y - dy * d.x);
      if (along > 0.2 && along < 1.8 && side < 0.8) return true;
    }
    return false;
  }

  update(dt: number, obstacles: readonly Vec2[]): void {
    if (this.waiting > 0) this.waiting -= dt;
    const stop = this.waiting > 0 || this.blockedBy(obstacles);
    if (stop) this.vehicle.driver.speed = Math.max(0, this.vehicle.driver.speed - 14 * dt);
    this.vehicle.update(dt, {
      stick: null,
      cruise: stop ? 0 : TRAFFIC_SPEED,
      chooser: this.chooser,
    });
  }
}
