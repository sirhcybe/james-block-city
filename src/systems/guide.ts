/**
 * Objective arrows (spec 008, playtest 2026-11-12: "arrows for active objectives, e.g. flags,
 * that appear when a player is stuck"). Pure: the city feeds it how far the player is from the
 * current objective, and it says when to show the arrow.
 *
 * - Not getting at least `progress` tiles closer for `stuckSec` seconds = stuck: show the arrow.
 * - Once showing it stays, however the player wanders, until they arrive (`arriveDist`).
 * - A new objective starts the clock again.
 * Unlike the 20-second idle hint, this fires while the player is busy driving the wrong way.
 */
export const GUIDE = {
  /** Seconds without progress before the arrow shows, in a mission and outside one. */
  stuckSec: 5,
  idleStuckSec: 12,
  /** Tiles closer that count as progress. */
  progress: 1,
  /** Within this many tiles the player has found it. */
  arriveDist: 2.4,
};
export type GuideTuning = typeof GUIDE;

export interface GuideTarget {
  /** Changes when the objective changes (a new goal, the next flag). */
  key: string;
  /** Tiles from the player to the objective. */
  dist: number;
  /** A mission is running (a shorter wait than when just roaming). */
  urgent: boolean;
}

export class ObjectiveGuide {
  showing = false;
  private key: string | null = null;
  private best = Infinity;
  private since = 0;

  constructor(private readonly t: GuideTuning = GUIDE) {}

  /** Advance by dt seconds. Returns whether the arrow should show now. */
  update(dt: number, target: GuideTarget | null): boolean {
    if (!target) {
      this.reset();
      return false;
    }
    if (target.key !== this.key) {
      this.key = target.key;
      this.best = target.dist;
      this.since = 0;
      this.showing = false;
    }
    if (target.dist <= this.t.arriveDist) {
      // Found it. If they walk away again the clock starts from here.
      this.showing = false;
      this.best = target.dist;
      this.since = 0;
      return false;
    }
    if (target.dist <= this.best - this.t.progress) {
      this.best = target.dist;
      this.since = 0;
    } else {
      this.since += dt;
      if (this.since >= (target.urgent ? this.t.stuckSec : this.t.idleStuckSec))
        this.showing = true;
    }
    return this.showing;
  }

  reset(): void {
    this.key = null;
    this.best = Infinity;
    this.since = 0;
    this.showing = false;
  }
}

/**
 * Where to draw the arrow for a target at logical screen point `p`: on the target when it is on
 * screen, otherwise on the edge of the screen (inside `margin`) along the line from the middle
 * of the screen to the target. `angle` is the way the arrow should point (radians, 0 = right).
 */
export function arrowPlace(
  p: { x: number; y: number },
  w: number,
  h: number,
  margin: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number; angle: number; onScreen: boolean } {
  const x0 = margin.left;
  const x1 = w - margin.right;
  const y0 = margin.top;
  const y1 = h - margin.bottom;
  if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1)
    return { x: p.x, y: p.y, angle: Math.PI / 2, onScreen: true };
  const cx = w / 2;
  const cy = h / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  // Scale the ray from the centre so it just touches the inner box.
  let k = Infinity;
  if (dx > 0) k = Math.min(k, (x1 - cx) / dx);
  if (dx < 0) k = Math.min(k, (x0 - cx) / dx);
  if (dy > 0) k = Math.min(k, (y1 - cy) / dy);
  if (dy < 0) k = Math.min(k, (y0 - cy) / dy);
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx), onScreen: false };
}
