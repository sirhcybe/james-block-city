/** Tuning for a robber chase. Kept generous: a 6-year-old must always be able to win. */
export interface ChaseTuning {
  bumpsNeeded: number;
  /** A "catch attempt" starts when the police get this close (tiles)... */
  nearDist: number;
  /** ...and is missed when they fall back beyond this distance without a bump. */
  missDist: number;
  /** Missed attempts before the getaway car runs out of gas. */
  missesForGas: number;
  /** The car also runs out of gas after this long, no matter what. */
  maxChaseSec: number;
  /** Seconds between dropped loot items, and how many in total. */
  dropEverySec: number;
  drops: number;
  /** Minimum seconds between two bumps counting. */
  bumpCooldownSec: number;
}

export const DEFAULT_CHASE: ChaseTuning = {
  bumpsNeeded: 3,
  nearDist: 2.5,
  missDist: 6,
  missesForGas: 3,
  maxChaseSec: 75,
  dropEverySec: 3,
  drops: 5,
  bumpCooldownSec: 1,
};

export type ChaseEvent = 'drop' | 'miss' | 'outOfGas' | 'bump' | 'caught';

/**
 * Pure chase bookkeeping: bumps, missed attempts, out-of-gas, loot drops. No fail state —
 * the chase only ever gets easier until the robber is caught.
 */
export class ChaseState {
  bumps = 0;
  misses = 0;
  elapsed = 0;
  dropped = 0;
  outOfGas = false;
  caught = false;
  private near = false;
  private dropTimer = 0;
  private sinceBump = Infinity;

  constructor(readonly t: ChaseTuning = DEFAULT_CHASE) {}

  /** Advance time; `distance` is police→robber in tiles. Returns events that happened. */
  update(dt: number, distance: number): ChaseEvent[] {
    if (this.caught) return [];
    const out: ChaseEvent[] = [];
    this.elapsed += dt;
    this.sinceBump += dt;

    if (!this.outOfGas) {
      this.dropTimer += dt;
      if (this.dropped < this.t.drops && this.dropTimer >= this.t.dropEverySec) {
        this.dropTimer = 0;
        this.dropped++;
        out.push('drop');
      }
      if (distance < this.t.nearDist) this.near = true;
      else if (this.near && distance > this.t.missDist) {
        this.near = false;
        this.misses++;
        out.push('miss');
      }
      if (this.misses >= this.t.missesForGas || this.elapsed >= this.t.maxChaseSec) {
        this.outOfGas = true;
        out.push('outOfGas');
      }
    }
    return out;
  }

  /** The police car touched the getaway car. Returns what it led to (or null if on cooldown). */
  bump(): 'bump' | 'caught' | null {
    if (this.caught || this.sinceBump < this.t.bumpCooldownSec) return null;
    this.sinceBump = 0;
    this.bumps++;
    this.near = false;
    if (this.bumps >= this.t.bumpsNeeded) {
      this.caught = true;
      return 'caught';
    }
    return 'bump';
  }

  /** Robber speed factor relative to the police car's top speed (never faster than 80%). */
  speedFactor(distance: number): number {
    if (this.outOfGas || this.caught) return 0;
    if (distance > 9) return 0.45; // rubber band: wait up for the player
    if (distance > 5) return 0.65;
    return 0.8;
  }
}
