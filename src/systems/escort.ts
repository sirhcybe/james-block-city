import type { Vec2 } from '../iso/projection';

/**
 * Duck Crossing escort (pure). The mother duck and ducklings follow a trail of the leader's
 * footsteps ("breadcrumbs"), each a few crumbs behind the one in front, so they waddle in a line
 * along the path the player actually walked (never through walls).
 *
 * - Before the player reaches them they wait (phase 'lost').
 * - When the player gets too far ahead they stop and wait ('waiting'); walking back picks them up.
 * - At a road with traffic coming, they wait at the kerb ('kerb') until the traffic stops (siren).
 * - Easier after about 3 tries: once they have had to stop 3 times, they hurry (bigger pick-up
 *   radius, faster) and no longer wait at the kerb (traffic stops for them by itself).
 * - Delivered when the mother is within `deliverDist` of the destination.
 */
export const ESCORT = {
  pickUpDist: 1.4,
  /** Leader this far ahead of the last duck: they stop and wait. */
  tooFar: 5,
  crumbEvery: 0.18,
  /** Crumbs between one duck and the next. */
  gap: 3,
  speed: 3.2,
  fastSpeed: 4.6,
  deliverDist: 1.3,
  triesForEasier: 3,
};
export type EscortTuning = typeof ESCORT;

export type EscortPhase = 'lost' | 'following' | 'waiting' | 'kerb' | 'delivered';

export class EscortState {
  phase: EscortPhase = 'lost';
  readonly ducks: Vec2[];
  /** Times the ducks had to stop (too far ahead, or traffic): drives the easier step. */
  stops = 0;
  private crumbs: Vec2[] = [];

  constructor(
    start: Vec2,
    count: number,
    readonly to: Vec2,
    private readonly t: EscortTuning = ESCORT,
  ) {
    this.ducks = Array.from({ length: count }, (_, i) => ({
      x: start.x - i * 0.35,
      y: start.y + i * 0.2,
    }));
  }

  get easier(): boolean {
    return this.stops >= this.t.triesForEasier;
  }

  /**
   * @param leader where the player is
   * @param roadAhead whether the spot the mother walks to next is on a road
   * @param trafficComing a traffic car is close and not stopped
   */
  update(dt: number, leader: Vec2, roadAhead: boolean, trafficComing: boolean): EscortPhase {
    if (this.phase === 'delivered') return this.phase;
    const mother = this.ducks[0]!;
    const last = this.ducks[this.ducks.length - 1]!;
    const pick = this.easier ? this.t.pickUpDist * 1.6 : this.t.pickUpDist;

    if (this.phase === 'lost' || this.phase === 'waiting') {
      if (Math.hypot(leader.x - mother.x, leader.y - mother.y) >= pick) return this.phase;
      this.phase = 'following';
      if (this.crumbs.length === 0) this.crumbs = [{ ...mother }];
    }

    // Lay crumbs behind the leader.
    const lastCrumb = this.crumbs[this.crumbs.length - 1]!;
    if (Math.hypot(leader.x - lastCrumb.x, leader.y - lastCrumb.y) >= this.t.crumbEvery)
      this.crumbs.push({ ...leader });

    const tooFar = this.easier ? this.t.tooFar * 1.6 : this.t.tooFar;
    if (Math.hypot(leader.x - last.x, leader.y - last.y) > tooFar) {
      this.phase = 'waiting';
      this.stops++;
      return this.phase;
    }

    if (roadAhead && trafficComing && !this.easier) {
      if (this.phase !== 'kerb') this.stops++;
      this.phase = 'kerb';
      return this.phase;
    }
    this.phase = 'following';

    // Each duck heads for its own crumb along the trail.
    const step = (this.easier ? this.t.fastSpeed : this.t.speed) * dt;
    this.ducks.forEach((d, i) => {
      const idx = Math.max(0, this.crumbs.length - 1 - this.t.gap * (i + 1));
      const c = this.crumbs[idx]!;
      const dx = c.x - d.x;
      const dy = c.y - d.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return;
      const k = Math.min(1, step / len);
      d.x += dx * k;
      d.y += dy * k;
    });
    // Drop crumbs nobody needs any more.
    const keep = this.t.gap * (this.ducks.length + 1) + 2;
    if (this.crumbs.length > keep) this.crumbs.splice(0, this.crumbs.length - keep);

    if (Math.hypot(mother.x - this.to.x, mother.y - this.to.y) < this.t.deliverDist)
      this.phase = 'delivered';
    return this.phase;
  }

  /** Where the mother is walking to next (for the "road ahead?" check). */
  nextStep(): Vec2 {
    const idx = Math.max(0, this.crumbs.length - 1 - this.t.gap);
    return this.crumbs[idx] ?? this.ducks[0]!;
  }
}
