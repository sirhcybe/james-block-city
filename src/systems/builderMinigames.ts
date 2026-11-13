/**
 * The three Builder minigames (spec 005), as pure models; their scenes only draw them. About 2
 * minutes each, pay 5/15/30 by score tier, can't be failed, and get a bit harder on replay.
 */

// ---------------------------------------------------------------------------------------------
// Block Stack: a block swings on a crane; tap to drop it. Close enough to the block below: it
// stacks (+1). Too far: it bounces off (no penalty). After 3 misses in a row the swing slows.
// ---------------------------------------------------------------------------------------------

export const BS = {
  /** Swing half-width (px) and speed (radians/s), first play and fastest. */
  swing: 260,
  speed: 1.6,
  maxSpeed: 3.0,
  /** How close (px) the drop must be to the top block to stack. */
  tolerance: 70,
  missesForEasier: 3,
  easySpeedScale: 0.55,
  /** Seconds a drop takes (no new drop meanwhile). */
  dropSec: 0.5,
};

export type BSEvent =
  | { type: 'stacked'; x: number; height: number }
  | { type: 'bounced'; x: number }
  | { type: 'finished' };

export class BlockStackModel {
  score = 0;
  elapsed = 0;
  finished = false;
  /** x of the top of the stack (0 = centre), and of the swinging block. */
  topX = 0;
  phase = 0;
  missesInRow = 0;
  private readonly baseSpeed: number;
  /** Level inside the round (the scene sets it): the crane swings a little faster. */
  level = 1;
  private busy = 0;

  constructor(
    readonly durationSec: number,
    plays: number,
    step: number,
  ) {
    const d = Math.min(1, plays * step);
    this.baseSpeed = BS.speed + (BS.maxSpeed - BS.speed) * d;
  }

  get speed(): number {
    return Math.min(BS.maxSpeed * 1.1, this.baseSpeed * (1 + 0.05 * (this.level - 1)));
  }

  get easier(): boolean {
    return this.missesInRow >= BS.missesForEasier;
  }

  get blockX(): number {
    return Math.sin(this.phase) * BS.swing;
  }

  /** Tap: drop the swinging block. */
  drop(): BSEvent | null {
    if (this.finished || this.busy > 0) return null;
    this.busy = BS.dropSec;
    const x = this.blockX;
    if (Math.abs(x - this.topX) <= BS.tolerance) {
      this.score++;
      this.missesInRow = 0;
      // The stack leans a little toward where it landed (but never off the screen).
      this.topX = Math.max(-120, Math.min(120, (this.topX + x) / 2));
      return { type: 'stacked', x, height: this.score };
    }
    this.missesInRow++;
    return { type: 'bounced', x };
  }

  update(dt: number): BSEvent[] {
    if (this.finished) return [];
    this.elapsed += dt;
    if (this.busy > 0) this.busy -= dt;
    this.phase += dt * this.speed * (this.easier ? BS.easySpeedScale : 1);
    if (this.elapsed >= this.durationSec) {
      this.finished = true;
      return [{ type: 'finished' }];
    }
    return [];
  }
}

// ---------------------------------------------------------------------------------------------
// Copy the Build: copy the little picture. Each tap on a square changes its colour (empty → red →
// yellow → teal → empty). When it matches, a new picture comes (+1).
// ---------------------------------------------------------------------------------------------

export const CB = {
  colors: 3,
  /** Grid size at the first play and later. */
  size: 2,
  maxSize: 3,
};

export type CBEvent = { type: 'matched'; score: number } | { type: 'finished' };

export class CopyBuildModel {
  score = 0;
  elapsed = 0;
  finished = false;
  size: number;
  /** Level inside the round (the scene sets it): from level 3 the pictures are 3×3. */
  level = 1;
  target: number[] = [];
  grid: number[] = [];

  constructor(
    readonly durationSec: number,
    plays: number,
    private readonly rand: () => number = Math.random,
  ) {
    this.big = plays >= 2;
    this.size = this.big ? CB.maxSize : CB.size;
    this.newPicture();
  }

  private readonly big: boolean;

  /** A new picture with at least two coloured squares; the player's grid is cleared. */
  newPicture(): void {
    this.size = this.big || this.level >= 3 ? CB.maxSize : CB.size;
    const n = this.size * this.size;
    do {
      this.target = Array.from({ length: n }, () => Math.floor(this.rand() * (CB.colors + 1)));
    } while (this.target.filter((c) => c > 0).length < 2);
    this.grid = Array<number>(n).fill(0);
  }

  get matches(): boolean {
    return this.grid.every((c, i) => c === this.target[i]);
  }

  /** Tap a square: next colour. Returns 'matched' when the picture is copied. */
  tap(i: number): CBEvent | null {
    if (this.finished || i < 0 || i >= this.grid.length) return null;
    this.grid[i] = (this.grid[i]! + 1) % (CB.colors + 1);
    if (!this.matches) return null;
    this.score++;
    const e: CBEvent = { type: 'matched', score: this.score };
    this.newPicture();
    return e;
  }

  update(dt: number): CBEvent[] {
    if (this.finished) return [];
    this.elapsed += dt;
    if (this.elapsed >= this.durationSec) {
      this.finished = true;
      return [{ type: 'finished' }];
    }
    return [];
  }
}

// ---------------------------------------------------------------------------------------------
// Cement Pour: hold to pour; let go at the line. 3 points if very close, 2 if close, 1 otherwise
// (even a big splat scores 1). The next line is somewhere else; on replay it drifts up and down.
// ---------------------------------------------------------------------------------------------

export const CP = {
  /** Fill speed (0..1 of the mould per second). */
  rate: 0.45,
  close: 0.05,
  near: 0.12,
  /** How fast the line drifts on replay (0..1 per second; 0 at the first play). */
  drift: 0.12,
  /** Seconds to tip out the mould before the next pour. */
  resetSec: 0.7,
};

export type CPEvent =
  /** `spilled`: it went over the top of the mould (a heart in the scene). */
  { type: 'poured'; points: number; diff: number; spilled: boolean } | { type: 'finished' };

export class CementPourModel {
  score = 0;
  elapsed = 0;
  finished = false;
  level = 0;
  line: number;
  private holding = false;
  private busy = 0;
  private t = 0;
  private readonly baseDrift: number;
  /** Level inside the round (the scene sets it): the line starts to drift, then drifts more. */
  stage = 1;

  constructor(
    readonly durationSec: number,
    plays: number,
    private readonly rand: () => number = Math.random,
  ) {
    this.baseDrift = plays === 0 ? 0 : Math.min(0.3, CP.drift * plays);
    this.line = this.newLine();
  }

  get drift(): number {
    return Math.min(0.36, this.baseDrift + 0.04 * (this.stage - 1));
  }

  private newLine(): number {
    return 0.35 + this.rand() * 0.5;
  }

  press(): void {
    if (!this.finished && this.busy <= 0) this.holding = true;
  }

  release(): CPEvent | null {
    if (!this.holding) return null;
    this.holding = false;
    const diff = this.level - this.line;
    const a = Math.abs(diff);
    const points = a <= CP.close ? 3 : a <= CP.near ? 2 : 1;
    this.score += points;
    this.busy = CP.resetSec;
    return { type: 'poured', points, diff, spilled: this.level > 1.001 };
  }

  update(dt: number): CPEvent[] {
    if (this.finished) return [];
    this.elapsed += dt;
    this.t += dt;
    if (this.drift > 0 && !this.holding && this.busy <= 0)
      this.line = Math.max(0.3, Math.min(0.9, this.line + Math.sin(this.t * 2) * this.drift * dt));
    if (this.busy > 0) {
      this.busy -= dt;
      if (this.busy <= 0) {
        this.level = 0;
        this.line = this.newLine();
        if (this.elapsed >= this.durationSec) {
          this.finished = true;
          return [{ type: 'finished' }];
        }
      }
      return [];
    }
    if (this.holding) this.level = Math.min(1.15, this.level + CP.rate * dt);
    if (this.elapsed >= this.durationSec + 8) {
      this.finished = true;
      return [{ type: 'finished' }];
    }
    return [];
  }
}
