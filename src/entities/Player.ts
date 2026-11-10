import { PLAYER_RADIUS, WALK_SPEED } from '../config';
import { screenDirToGrid } from '../input/direction';
import type { WalkGrid } from '../iso/grid';
import type { Vec2 } from '../iso/projection';

/** The four facings the character art supports (screen diagonals). */
export type Facing = 'NE' | 'NW' | 'SE' | 'SW';

/** Facing for a grid-space velocity. +gx = SE on screen, +gy = SW, -gx = NW, -gy = NE. */
export function facingForGridDir(v: Vec2, prev: Facing): Facing {
  // Screen direction of the velocity.
  const sx = v.x - v.y;
  const sy = v.x + v.y;
  if (Math.abs(sx) < 1e-6 && Math.abs(sy) < 1e-6) return prev;
  const right = Math.abs(sx) < 1e-6 ? prev === 'NE' || prev === 'SE' : sx > 0;
  const down = Math.abs(sy) < 1e-6 ? prev === 'SE' || prev === 'SW' : sy > 0;
  return down ? (right ? 'SE' : 'SW') : right ? 'NE' : 'NW';
}

/**
 * Player movement model (no rendering): continuous grid position, facing, wall sliding and
 * go-to path following.
 */
export class Player {
  pos: Vec2;
  facing: Facing = 'SE';
  moving = false;
  path: Vec2[] = [];
  private stuckFor = 0;

  constructor(
    private readonly grid: WalkGrid,
    start: Vec2,
    readonly radius = PLAYER_RADIUS,
    readonly speed = WALK_SPEED,
  ) {
    this.pos = { ...start };
  }

  get following(): boolean {
    return this.path.length > 0;
  }

  setPath(tiles: Vec2[]): void {
    this.path = tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
    this.stuckFor = 0;
  }

  cancelPath(): void {
    this.path = [];
  }

  /** Advance by dt seconds. `screenMove` (length 0..1) cancels any path when non-zero. */
  update(dt: number, screenMove: Vec2): void {
    let dir: Vec2 = { x: 0, y: 0 };
    if (Math.hypot(screenMove.x, screenMove.y) > 0) {
      this.cancelPath();
      dir = screenDirToGrid(screenMove);
    } else if (this.path.length > 0) {
      dir = this.pathDirection(dt);
    }

    const step = this.speed * dt;
    const before = this.pos;
    const delta = { x: dir.x * step, y: dir.y * step };
    this.pos = this.grid.slide(this.pos, delta, this.radius);

    const moved = Math.hypot(this.pos.x - before.x, this.pos.y - before.y);
    this.moving = moved > 1e-4;
    if (this.moving) this.facing = facingForGridDir(dir, this.facing);

    if (this.path.length > 0) {
      this.stuckFor = moved < step * 0.2 ? this.stuckFor + dt : 0;
      if (this.stuckFor > 0.5) this.cancelPath();
    }
  }

  private pathDirection(dt: number): Vec2 {
    const step = this.speed * dt;
    while (this.path.length > 0) {
      const t = this.path[0]!;
      const dx = t.x - this.pos.x;
      const dy = t.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d <= Math.max(0.02, step * 0.5)) {
        this.path.shift();
        if (this.path.length === 0) {
          // Snap exactly onto the last tile centre.
          if (this.grid.circleFits(t.x, t.y, this.radius)) this.pos = { ...t };
          return { x: 0, y: 0 };
        }
        continue;
      }
      // Don't overshoot the waypoint.
      const k = d < step ? d / step : 1;
      return { x: (dx / d) * k, y: (dy / d) * k };
    }
    return { x: 0, y: 0 };
  }
}
