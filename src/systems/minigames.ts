import { z } from 'zod';

export const MinigameDef = z.object({
  id: z.string(),
  job: z.enum(['cop', 'fire', 'builder']),
  durationSec: z.number().positive(),
  /** Score thresholds for 5 / 15 / 30 coins. tiers[0] is the floor (always paid). */
  tiers: z.tuple([z.number(), z.number(), z.number()]),
  difficultyStepPerReplay: z.number().nonnegative(),
});
export type MinigameDef = z.infer<typeof MinigameDef>;
export const MinigameList = z.array(MinigameDef);

export const TIER_COINS = [5, 15, 30] as const;

/** Coins for a score: never fails — the lowest tier always pays 5. */
export function coinsForScore(score: number, tiers: readonly [number, number, number]): number {
  if (score >= tiers[2]) return TIER_COINS[2];
  if (score >= tiers[1]) return TIER_COINS[1];
  return TIER_COINS[0];
}

// ---------------------------------------------------------------------------------------------
// Traffic Helper: tap the light to stop the cars so ducks and kids can cross.
// Pure model in logical screen px; TrafficHelperScene only draws it.
// ---------------------------------------------------------------------------------------------

export const TH = {
  carLength: 130,
  carGap: 26,
  carSpeed: 260,
  /** Cars drive left -> right; their front stops here when they must wait. */
  stopLine: 540,
  crossLeft: 560,
  crossRight: 720,
  spawnX: -160,
  despawnX: 1440,
  crossSec: 2.2,
  /** Seconds between walkers starting to cross. */
  crossGapSec: 0.6,
  walkerPatienceSec: 8,
  carPatienceSec: 6,
  baseCarEvery: 2.4,
  baseWalkerEvery: 3.2,
  maxQueue: 6,
} as const;

export interface THCar {
  id: number;
  /** Front bumper x. */
  x: number;
  stoppedFor: number;
}

export interface THWalker {
  id: number;
  kind: 'duck' | 'kid';
  state: 'waiting' | 'crossing' | 'done';
  /** 0..1 progress across the road while crossing. */
  t: number;
  waitedFor: number;
}

export type THEvent =
  | { type: 'score'; walker: number }
  | { type: 'miss'; reason: 'walker' | 'car' }
  | { type: 'light'; red: boolean }
  | { type: 'finished' };

export class TrafficHelperModel {
  red = false;
  score = 0;
  misses = 0;
  elapsed = 0;
  finished = false;
  cars: THCar[] = [];
  walkers: THWalker[] = [];
  private nextId = 1;
  private carTimer = 0;
  private walkerTimer = 1.0;
  private sinceCrossStart = Infinity;

  constructor(
    readonly durationSec: number,
    /** How many times this minigame was played before (replays get a little harder). */
    readonly plays = 0,
    readonly step = 0.1,
    private readonly rand: () => number = Math.random,
  ) {}

  /** Spawn-rate multiplier: harder on replay, easier after misses. */
  get pace(): number {
    const p = (1 + this.step * this.plays) / (1 + 0.15 * this.misses);
    return Math.max(0.5, Math.min(2, p));
  }

  toggleLight(): THEvent {
    this.red = !this.red;
    return { type: 'light', red: this.red };
  }

  private carOnCrosswalk(): boolean {
    return this.cars.some((c) => c.x > TH.crossLeft && c.x - TH.carLength < TH.crossRight);
  }

  private anyoneCrossing(): boolean {
    return this.walkers.some((w) => w.state === 'crossing');
  }

  update(dt: number): THEvent[] {
    if (this.finished) return [];
    const ev: THEvent[] = [];
    this.elapsed += dt;
    this.sinceCrossStart += dt;

    // Spawning (stops near the end so the road can clear).
    const ending = this.elapsed > this.durationSec - 3;
    this.carTimer -= dt * this.pace;
    if (!ending && this.carTimer <= 0) {
      const last = this.cars[this.cars.length - 1];
      if (!last || last.x - TH.carLength - TH.carGap > TH.spawnX) {
        this.cars.push({ id: this.nextId++, x: TH.spawnX, stoppedFor: 0 });
        this.carTimer = TH.baseCarEvery * (0.75 + this.rand() * 0.5);
      }
    }
    this.walkerTimer -= dt * this.pace;
    const waiting = this.walkers.filter((w) => w.state === 'waiting').length;
    if (!ending && this.walkerTimer <= 0 && waiting < TH.maxQueue) {
      this.walkers.push({
        id: this.nextId++,
        kind: this.rand() < 0.6 ? 'duck' : 'kid',
        state: 'waiting',
        t: 0,
        waitedFor: 0,
      });
      this.walkerTimer = TH.baseWalkerEvery * (0.75 + this.rand() * 0.5);
    }

    // Cars: stop at the line when the light is red or someone is on the crosswalk.
    const mustStop = this.red || this.anyoneCrossing();
    let limit = Infinity; // front of the car ahead minus its length and gap
    for (const c of this.cars) {
      let target = c.x + TH.carSpeed * dt;
      if (mustStop && c.x <= TH.stopLine) target = Math.min(target, TH.stopLine);
      target = Math.min(target, limit);
      const moved = target - c.x;
      c.x = Math.max(c.x, target);
      if (moved < 1) {
        c.stoppedFor += dt;
        if (c.stoppedFor >= TH.carPatienceSec) {
          c.stoppedFor = 0;
          this.misses++;
          ev.push({ type: 'miss', reason: 'car' });
        }
      } else c.stoppedFor = 0;
      limit = c.x - TH.carLength - TH.carGap;
    }
    this.cars = this.cars.filter((c) => c.x - TH.carLength < TH.despawnX);

    // Walkers: start crossing only when cars are held at red and the crosswalk is clear.
    const front = this.walkers.find((w) => w.state === 'waiting');
    if (front && this.red && !this.carOnCrosswalk() && this.sinceCrossStart >= TH.crossGapSec) {
      front.state = 'crossing';
      this.sinceCrossStart = 0;
    }
    for (const w of this.walkers) {
      if (w.state === 'crossing') {
        w.t += dt / TH.crossSec;
        if (w.t >= 1) {
          w.t = 1;
          w.state = 'done';
          this.score++;
          ev.push({ type: 'score', walker: w.id });
        }
      } else if (w.state === 'waiting') {
        w.waitedFor += dt;
        if (w.waitedFor >= TH.walkerPatienceSec) {
          w.waitedFor = 0;
          this.misses++;
          ev.push({ type: 'miss', reason: 'walker' });
        }
      }
    }
    this.walkers = this.walkers.filter((w) => w.state !== 'done');

    if (this.elapsed >= this.durationSec && !this.anyoneCrossing()) {
      this.finished = true;
      ev.push({ type: 'finished' });
    }
    return ev;
  }
}
