import type { Vec2 } from '../iso/projection';

/**
 * Lost Puppy "Find" goal (pure): barks that get louder as you get closer lead to the hiding spots
 * in order; the puppy is in the last one. Easier after a while on one spot: the barks go to full
 * volume, and the paw-print trail is shown all the way.
 */
export const FIND = {
  checkDist: 1.3,
  /** Barks are heard from this far (minimum volume beyond). */
  hearDist: 14,
  minVolume: 0.25,
  barkEverySec: 2.4,
  /** Seconds on one spot before the barks go to full volume (the easier step). */
  louderAfterSec: 45,
};
export type FindTuning = typeof FIND;

export type FindEvent =
  { type: 'empty'; spot: number } | { type: 'found' } | { type: 'bark'; volume: number };

export class FindState {
  spot = 0;
  found = false;
  private onSpot = 0;
  private sinceBark = 0;

  constructor(
    readonly spots: readonly Vec2[],
    private readonly t: FindTuning = FIND,
  ) {}

  get current(): Vec2 {
    return this.spots[Math.min(this.spot, this.spots.length - 1)]!;
  }

  get easier(): boolean {
    return this.onSpot >= this.t.louderAfterSec;
  }

  /** Bark volume (0..1) heard at a position: louder the closer you are. */
  volumeAt(p: Vec2): number {
    if (this.found) return 0;
    if (this.easier) return 1;
    const d = Math.hypot(p.x - this.current.x, p.y - this.current.y);
    const k = 1 - Math.min(1, d / this.t.hearDist);
    return this.t.minVolume + (1 - this.t.minVolume) * k;
  }

  update(dt: number, player: Vec2): FindEvent[] {
    if (this.found) return [];
    const out: FindEvent[] = [];
    this.onSpot += dt;
    this.sinceBark += dt;
    if (this.sinceBark >= this.t.barkEverySec) {
      this.sinceBark = 0;
      out.push({ type: 'bark', volume: this.volumeAt(player) });
    }
    const c = this.current;
    if (Math.hypot(player.x - c.x, player.y - c.y) < this.t.checkDist) {
      if (this.spot >= this.spots.length - 1) {
        this.found = true;
        out.push({ type: 'found' });
      } else {
        out.push({ type: 'empty', spot: this.spot });
        this.spot++;
        this.onSpot = 0;
        this.sinceBark = this.t.barkEverySec; // bark right away from the next spot
      }
    }
    return out;
  }
}
