import type { Vec2 } from './projection';

/**
 * Road-assist steering in **screen** space (ADR-004).
 *
 * Roads run diagonally on screen, so a single arrow key (or a thumb pushed straight up) sits
 * between two road directions. Steering therefore compares the stick with each road direction
 * *as drawn on screen*, prefers the current heading on ties, and only turns around when the stick
 * is clearly behind. With one direction held, a vehicle only ever travels roads within
 * `MAX_BRANCH_DEG` of the stick, so it can't flip back and forth.
 */

/** A branch is only taken under stick input if it is within this angle of the stick. */
export const MAX_BRANCH_DEG = 100;
/** Turn around mid-road only when the stick is more than this far from the heading. */
export const UTURN_DEG = 110;
/** …and not within this many seconds of the last change of direction. */
export const UTURN_COOLDOWN = 0.3;
/**
 * From a stop, go back the way you came if that is within this angle of the stick. Under 90°, so
 * a sideways push can never bounce the car between the two ends of a road (d and −d can't both
 * be within it). Was 70° (180 − UTURN_DEG), which left a diagonal push 72° off the way back with
 * the car parked for good (playtest 2026-11-10).
 */
export const BACK_FROM_STOP_DEG = 85;
/** Angles closer than this count as a tie. */
const TIE_DEG = 3;

/** Screen-space vector of a grid direction (2:1 iso: one grid step = (dx − dy, (dx + dy) / 2)). */
export function toScreen(d: Vec2): Vec2 {
  return { x: d.x - d.y, y: (d.x + d.y) / 2 };
}

/** Unsigned angle between two vectors in degrees (0..180). */
export function angleDeg(a: Vec2, b: Vec2): number {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la < 1e-9 || lb < 1e-9) return 180;
  const c = (a.x * b.x + a.y * b.y) / (la * lb);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** How far a grid direction is from a screen-space stick, as seen on screen. */
export function stickDiff(stickScreen: Vec2, gridDir: Vec2): number {
  return angleDeg(stickScreen, toScreen(gridDir));
}

const same = (a: Vec2, b: Vec2) => a.x === b.x && a.y === b.y;
const opposite = (a: Vec2, b: Vec2) => a.x === -b.x && a.y === -b.y;

/**
 * Branch choice at a node.
 * @param stickScreen screen-space stick (up = negative y), or null for "no input"
 * @param heading grid direction the vehicle arrived with
 * @param options grid directions of the node's links (may include going back)
 * @param stopped the vehicle is standing still at the node, so going back is allowed too
 * @returns index into `options`, or -1 to stop and wait
 *
 * - No input: straight on, else follow a single bend, else stop (a T-junction waits for a choice).
 * - Input: the branch closest to the stick on screen, within `MAX_BRANCH_DEG`. Ties go to straight
 *   on, then to the gentler turn. Nothing close enough: stop (the stick says "not that way").
 */
export function pickBranch(
  stickScreen: Vec2 | null,
  heading: Vec2,
  options: Vec2[],
  stopped = false,
): number {
  if (options.length === 0) return -1;
  const forward = options.map((o, i) => ({ o, i })).filter(({ o }) => !opposite(o, heading));
  const len = stickScreen ? Math.hypot(stickScreen.x, stickScreen.y) : 0;
  if (!stickScreen || len < 1e-6) {
    const straight = forward.find(({ o }) => same(o, heading));
    if (straight) return straight.i;
    if (forward.length === 1) return forward[0]!.i;
    return -1;
  }
  const pool = stopped ? options.map((o, i) => ({ o, i })) : forward;
  let best: { i: number; diff: number; turn: number } | null = null;
  for (const { o, i } of pool) {
    const diff = stickDiff(stickScreen, o);
    // Going back needs the stick mostly behind, so a sideways push can't bounce the car between
    // two corners.
    const limit = opposite(o, heading) ? BACK_FROM_STOP_DEG : MAX_BRANCH_DEG;
    if (diff > limit) continue;
    const turn = angleDeg(toScreen(heading), toScreen(o));
    if (
      !best ||
      diff < best.diff - TIE_DEG ||
      (Math.abs(diff - best.diff) <= TIE_DEG && turn < best.turn)
    )
      best = { i, diff, turn };
  }
  return best ? best.i : -1;
}

/** Whether the stick asks for a U-turn on the road (it's clearly behind, and not just after a turn). */
export function wantsUTurn(
  stickScreen: Vec2 | null,
  heading: Vec2,
  secondsSinceTurn: number,
): boolean {
  if (!stickScreen || Math.hypot(stickScreen.x, stickScreen.y) < 1e-6) return false;
  if (secondsSinceTurn < UTURN_COOLDOWN) return false;
  return stickDiff(stickScreen, heading) > UTURN_DEG;
}
