import type { Vec2 } from '../iso/projection';

/**
 * Net launcher aim help (pure). A target counts if it is inside a forward cone from the shooter.
 * The cone is generous on purpose (a 6-year-old aims with the whole car), and the net then homes in
 * on the chosen target, so it hits whatever lane he is in. A miss costs nothing.
 */
export const NET = {
  /** Half-angle of the cone, degrees (so 70° wide). */
  halfAngleDeg: 35,
  /** How far ahead it reaches, tiles. */
  range: 5,
  /** Flight speed, tiles/s (faster than any robber so a fired net always arrives). */
  speed: 9,
  /** It hits within this distance, tiles. */
  hitDist: 0.9,
  /** And gives up (a miss) after this long, s. */
  lifeSec: 1.2,
  /** Seconds between shots. */
  cooldownSec: 0.6,
};
export type NetTuning = typeof NET;

export interface NetCandidate {
  id: string;
  pos: Vec2;
}

/**
 * The best target in the cone: the one closest to the centre line, then the nearest. `heading` is
 * a grid-space vector (the way the vehicle points).
 */
export function netTarget(
  shooter: Vec2,
  heading: Vec2,
  candidates: readonly NetCandidate[],
  t: NetTuning = NET,
): string | null {
  const hl = Math.hypot(heading.x, heading.y) || 1;
  const hx = heading.x / hl;
  const hy = heading.y / hl;
  const cos = Math.cos((t.halfAngleDeg * Math.PI) / 180);
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const dx = c.pos.x - shooter.x;
    const dy = c.pos.y - shooter.y;
    const d = Math.hypot(dx, dy);
    if (d > t.range) continue;
    // Right on top of him counts too (bumper to bumper).
    const along = d < 0.5 ? 1 : (dx * hx + dy * hy) / d;
    if (along < cos) continue;
    const score = along * 4 - d / t.range;
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

/** A net in flight: moves toward its target each step. */
export class NetShot {
  pos: Vec2;
  age = 0;
  state: 'flying' | 'hit' | 'missed' = 'flying';

  constructor(
    from: Vec2,
    readonly target: string,
    private readonly t: NetTuning = NET,
  ) {
    this.pos = { ...from };
  }

  /** Advance toward the target's current position. Returns the new state. */
  step(dt: number, targetPos: Vec2 | null): NetShot['state'] {
    if (this.state !== 'flying') return this.state;
    this.age += dt;
    if (!targetPos || this.age > this.t.lifeSec) {
      this.state = 'missed';
      return this.state;
    }
    const dx = targetPos.x - this.pos.x;
    const dy = targetPos.y - this.pos.y;
    const d = Math.hypot(dx, dy);
    const stepLen = this.t.speed * dt;
    if (d <= this.t.hitDist || d <= stepLen) {
      this.pos = { ...targetPos };
      this.state = 'hit';
      return this.state;
    }
    this.pos = { x: this.pos.x + (dx / d) * stepLen, y: this.pos.y + (dy / d) * stepLen };
    return this.state;
  }
}
