import * as EasyStarNS from 'easystarjs';
import type { WalkGrid } from './grid';
import type { Vec2 } from './projection';

// easystarjs is CommonJS (`module.exports = { js }`); depending on the bundler the namespace import
// exposes `js` directly or under `default`.
type EasyStarModule = typeof EasyStarNS;
const ns = EasyStarNS as EasyStarModule & { default?: EasyStarModule };
const EasyStarJs = ns.js ?? ns.default?.js;

/**
 * A* over a WalkGrid (EasyStar, synchronous; fine for small maps). 8-way movement without cutting
 * corners past blocked tiles.
 */
export class PathFinder {
  private readonly star = new EasyStarJs();

  /** Re-read the walk grid after it changed (something was built). */
  refresh(): void {
    this.star.setGrid(this.grid.toMatrix());
  }

  constructor(private readonly grid: WalkGrid) {
    this.star.setGrid(grid.toMatrix());
    this.star.setAcceptableTiles([0]);
    this.star.enableDiagonals();
    this.star.disableCornerCutting();
    this.star.enableSync();
  }

  /**
   * Tiles from `from` to `to`, excluding the start tile. If `to` is blocked (a building), aims for
   * the nearest walkable tile instead, preferring ones closer to the start. Returns null if
   * unreachable, [] if already there.
   */
  find(from: Vec2, to: Vec2): Vec2[] | null {
    const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
    if (!this.grid.isWalkable(start.x, start.y)) return null;
    const target = this.resolveTarget(to, start);
    if (!target) return null;
    if (target.x === start.x && target.y === start.y) return [];

    let result: Vec2[] | null = null;
    this.star.findPath(start.x, start.y, target.x, target.y, (path) => {
      result = path ? path.slice(1).map((p) => ({ x: p.x, y: p.y })) : null;
    });
    this.star.calculate();
    return result;
  }

  /** The walkable tile actually aimed for when asked to go to `to`. */
  resolveTarget(to: Vec2, start: Vec2): Vec2 | null {
    const tx = Math.floor(to.x);
    const ty = Math.floor(to.y);
    if (this.grid.isWalkable(tx, ty)) return { x: tx, y: ty };
    let best: Vec2 | null = null;
    let bestScore = Infinity;
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        if (!this.grid.isWalkable(x, y)) continue;
        const dTarget = (x + 0.5 - to.x) ** 2 + (y + 0.5 - to.y) ** 2;
        const dStart = (x - start.x) ** 2 + (y - start.y) ** 2;
        const score = dTarget * 1000 + dStart; // nearest to target; tie-break nearest to start
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }
}
