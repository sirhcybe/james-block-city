/**
 * The two Firefighter minigames (spec 004), as pure models; their scenes only draw them. Both
 * last about 2 minutes, pay 5/15/30 by score tier, can't be failed, and get a bit harder on replay.
 */

// ---------------------------------------------------------------------------------------------
// Window Splash: grumpy flames pop up in a tower's 3×3 windows; tap one to splash it. A flame
// nobody taps just goes "pfft" on its own after a while (no penalty).
// ---------------------------------------------------------------------------------------------

export const WS = {
  windows: 9,
  /** Seconds a flame stays up, at the first play and the fastest it ever gets. */
  upSec: 2.2,
  minUpSec: 1.1,
  /** Seconds between new flames. */
  everySec: 1.1,
  minEverySec: 0.55,
  /** Most flames up at once. */
  maxUp: 2,
  maxMaxUp: 4,
};

export type WSEvent =
  | { type: 'pop'; window: number }
  | { type: 'splash'; window: number }
  | { type: 'fizzle'; window: number }
  | { type: 'finished' };

export class WindowSplashModel {
  score = 0;
  elapsed = 0;
  finished = false;
  /** Seconds left for the flame in each window (0 = no flame). */
  readonly up: number[] = Array<number>(WS.windows).fill(0);
  readonly upSec: number;
  readonly everySec: number;
  readonly maxUp: number;
  private next = 0.6;

  constructor(
    readonly durationSec: number,
    plays: number,
    step: number,
    private readonly rand: () => number = Math.random,
  ) {
    const d = Math.min(1, plays * step);
    this.upSec = WS.upSec - (WS.upSec - WS.minUpSec) * d;
    this.everySec = WS.everySec - (WS.everySec - WS.minEverySec) * d;
    this.maxUp = Math.round(WS.maxUp + (WS.maxMaxUp - WS.maxUp) * d);
  }

  get flames(): number {
    return this.up.filter((u) => u > 0).length;
  }

  /** Tap a window: splash the flame if there is one. */
  tap(w: number): WSEvent | null {
    if (this.finished || (this.up[w] ?? 0) <= 0) return null;
    this.up[w] = 0;
    this.score++;
    return { type: 'splash', window: w };
  }

  update(dt: number): WSEvent[] {
    if (this.finished) return [];
    const out: WSEvent[] = [];
    this.elapsed += dt;
    for (let i = 0; i < this.up.length; i++) {
      if (this.up[i]! <= 0) continue;
      this.up[i]! -= dt;
      if (this.up[i]! <= 0) {
        this.up[i] = 0;
        out.push({ type: 'fizzle', window: i });
      }
    }
    if (this.elapsed >= this.durationSec) {
      this.finished = true;
      out.push({ type: 'finished' });
      return out;
    }
    this.next -= dt;
    if (this.next <= 0 && this.flames < this.maxUp) {
      this.next = this.everySec;
      const free = this.up.map((u, i) => (u > 0 ? -1 : i)).filter((i) => i >= 0);
      const w = free[Math.floor(this.rand() * free.length)]!;
      this.up[w] = this.upSec;
      out.push({ type: 'pop', window: w });
    }
    return out;
  }
}

// ---------------------------------------------------------------------------------------------
// Ladder Rescue: a cat waits at a window on floor 1..8. Hold to raise the ladder; let go when the
// top is at the cat's floor. Close enough: the cat slides down (+1). Too low or too high: the
// ladder lowers and you try again. After 3 misses on one cat, "close enough" gets wider.
// ---------------------------------------------------------------------------------------------

export const LR = {
  floors: 8,
  /** Ladder speed (floors per second), at the first play and the fastest. */
  speed: 2.2,
  maxSpeed: 3.6,
  /** How close (floors) counts. */
  tolerance: 0.55,
  easyTolerance: 1.1,
  missesForEasier: 3,
  /** Seconds for the ladder to drop back / the cat to slide down. */
  resetSec: 0.8,
};

export type LREvent =
  | { type: 'cat'; floor: number }
  | { type: 'saved'; floor: number }
  | { type: 'miss'; diff: number }
  | { type: 'finished' };

export class LadderRescueModel {
  score = 0;
  elapsed = 0;
  finished = false;
  /** Ladder top height in floors (0 = down). */
  height = 0;
  cat = 1;
  missesOnCat = 0;
  readonly speed: number;
  private holding = false;
  private busy = 0;
  private started = false;

  constructor(
    readonly durationSec: number,
    plays: number,
    step: number,
    private readonly rand: () => number = Math.random,
  ) {
    const d = Math.min(1, plays * step);
    this.speed = LR.speed + (LR.maxSpeed - LR.speed) * d;
  }

  get tolerance(): number {
    return this.missesOnCat >= LR.missesForEasier ? LR.easyTolerance : LR.tolerance;
  }

  private newCat(): LREvent {
    this.cat = 1 + Math.floor(this.rand() * LR.floors);
    this.missesOnCat = 0;
    return { type: 'cat', floor: this.cat };
  }

  /** Start holding (raise the ladder). */
  press(): void {
    if (!this.finished && this.busy <= 0) this.holding = true;
  }

  /** Let go: check the ladder against the cat. */
  release(): LREvent | null {
    if (!this.holding) return null;
    this.holding = false;
    const diff = this.height - this.cat;
    this.busy = LR.resetSec;
    if (Math.abs(diff) <= this.tolerance) {
      this.score++;
      return { type: 'saved', floor: this.cat };
    }
    this.missesOnCat++;
    return { type: 'miss', diff };
  }

  update(dt: number): LREvent[] {
    if (this.finished) return [];
    const out: LREvent[] = [];
    this.elapsed += dt;
    if (!this.started) {
      this.started = true;
      out.push(this.newCat());
    }
    if (this.busy > 0) {
      this.busy -= dt;
      this.height = Math.max(0, this.height - (this.height / LR.resetSec) * dt * 1.5);
      if (this.busy <= 0) {
        this.height = 0;
        if (this.elapsed >= this.durationSec) {
          this.finished = true;
          out.push({ type: 'finished' });
          return out;
        }
        // A new cat after a rescue; the same cat again after a miss.
        if (this.missesOnCat === 0) out.push(this.newCat());
      }
      return out;
    }
    if (this.holding) this.height = Math.min(LR.floors + 0.6, this.height + this.speed * dt);
    if (this.elapsed >= this.durationSec + 10) {
      this.finished = true;
      out.push({ type: 'finished' });
    }
    return out;
  }
}
