import type { Vec2 } from '../iso/projection';

/**
 * The rescue boat (spec 008, pure). Unlike road vehicles it steers freely: push the stick and it
 * speeds up that way, let go and it glides to a stop. It can't leave the water: it slides along
 * shores and docks with a soft bump. Tap-to-go steers straight at a point until it gets there or
 * gets blocked.
 */
export const BOAT = {
  /** Tiles per second. */
  maxSpeed: 5.2,
  accel: 9,
  /** How quickly it slows with no input (1/s). */
  drag: 1.8,
  /** Hull radius in tiles (collision with the shore). */
  radius: 0.42,
  /** Tap-to-go stops this close to the point. */
  arrive: 0.35,
  /** Radians per second the hull turns toward where it's going. */
  turnRate: 7,
};
export type BoatTuning = typeof BOAT;

/** Something that can say whether a circle of water is free (WalkGrid.circleFits does). */
export interface SeaChart {
  circleFits(x: number, y: number, r: number): boolean;
}

export class BoatModel {
  pos: Vec2;
  vel: Vec2 = { x: 0, y: 0 };
  /** Grid-space heading (radians; 0 = +gx). */
  heading: number;
  /** Tap-to-go destination, if any. */
  target: Vec2 | null = null;
  /** Bumped the shore this step (for a sound). */
  bumped = false;
  private blockedFor = 0;

  constructor(
    private readonly sea: SeaChart,
    start: Vec2,
    heading = 0,
    private readonly t: BoatTuning = BOAT,
  ) {
    this.pos = { ...start };
    this.heading = heading;
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  /** Stop dead (hopping out, a mission parking the boat). */
  stop(): void {
    this.vel = { x: 0, y: 0 };
    this.target = null;
  }

  /** Steer to a point on the water. False if that point isn't water. */
  goToward(p: Vec2): boolean {
    if (!this.sea.circleFits(p.x, p.y, 0.05)) return false;
    this.target = { ...p };
    this.blockedFor = 0;
    return true;
  }

  /**
   * Advance by dt seconds. `stick` is a grid-space direction (length 0..1) or null; any stick
   * input cancels tap-to-go.
   */
  update(dt: number, stick: Vec2 | null): void {
    this.bumped = false;
    let want: Vec2 | null = null;
    if (stick && Math.hypot(stick.x, stick.y) > 0) {
      this.target = null;
      const l = Math.hypot(stick.x, stick.y);
      const k = Math.min(1, l) / l;
      want = { x: stick.x * k, y: stick.y * k };
    } else if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dy = this.target.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d <= this.t.arrive) this.target = null;
      else {
        // Ease off near the point so it doesn't overshoot.
        const k = Math.min(1, d / 1.5 + 0.25);
        want = { x: (dx / d) * k, y: (dy / d) * k };
      }
    }

    if (want) {
      const tx = want.x * this.t.maxSpeed;
      const ty = want.y * this.t.maxSpeed;
      const dx = tx - this.vel.x;
      const dy = ty - this.vel.y;
      const d = Math.hypot(dx, dy);
      const step = this.t.accel * dt;
      if (d <= step) this.vel = { x: tx, y: ty };
      else this.vel = { x: this.vel.x + (dx / d) * step, y: this.vel.y + (dy / d) * step };
    } else {
      const k = Math.exp(-this.t.drag * dt);
      this.vel = { x: this.vel.x * k, y: this.vel.y * k };
      if (this.speed < 0.05) this.vel = { x: 0, y: 0 };
    }

    // Move one axis at a time so it slides along a shore instead of sticking to it.
    const r = this.t.radius;
    const nx = this.pos.x + this.vel.x * dt;
    if (this.sea.circleFits(nx, this.pos.y, r)) this.pos.x = nx;
    else if (this.vel.x !== 0) {
      this.bumped = Math.abs(this.vel.x) > 1.5;
      this.vel.x = 0;
    }
    const ny = this.pos.y + this.vel.y * dt;
    if (this.sea.circleFits(this.pos.x, ny, r)) this.pos.y = ny;
    else if (this.vel.y !== 0) {
      this.bumped = this.bumped || Math.abs(this.vel.y) > 1.5;
      this.vel.y = 0;
    }
    // Tap-to-go that runs into the shore gives up rather than push forever.
    if (this.target) {
      this.blockedFor = this.speed < 0.3 ? this.blockedFor + dt : 0;
      if (this.blockedFor > 0.8) this.target = null;
    }

    if (this.speed > 0.4) {
      const to = Math.atan2(this.vel.y, this.vel.x);
      let diff = to - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = this.t.turnRate * dt;
      this.heading += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
    }
  }
}
