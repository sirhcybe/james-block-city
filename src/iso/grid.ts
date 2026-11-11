import type { Vec2 } from './projection';

/** Which tiles can be walked on. Pure data + collision helpers; no rendering. */
export class WalkGrid {
  private readonly blocked: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.blocked = new Uint8Array(width * height);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.blocked[y * this.width + x] === 0;
  }

  block(x: number, y: number): void {
    if (this.inBounds(x, y)) this.blocked[y * this.width + x] = 1;
  }

  /** Copy another grid of the same size (used when something new is built). */
  copyFrom(o: WalkGrid): void {
    this.blocked.set((o as unknown as { blocked: Uint8Array }).blocked);
  }

  unblock(x: number, y: number): void {
    if (this.inBounds(x, y)) this.blocked[y * this.width + x] = 0;
  }

  blockRect(x: number, y: number, w: number, d: number): void {
    for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) this.block(i, j);
  }

  /** 2D array (rows of columns) for EasyStar: 0 = walkable, 1 = blocked. */
  toMatrix(): number[][] {
    const rows: number[][] = [];
    for (let y = 0; y < this.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.width; x++) row.push(this.isWalkable(x, y) ? 0 : 1);
      rows.push(row);
    }
    return rows;
  }

  /** Whether a circle of radius r centered at (px, py) touches no blocked tile or the map edge. */
  circleFits(px: number, py: number, r: number): boolean {
    if (px - r < 0 || py - r < 0 || px + r > this.width || py + r > this.height) return false;
    const x0 = Math.floor(px - r);
    const x1 = Math.floor(px + r);
    const y0 = Math.floor(py - r);
    const y1 = Math.floor(py + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (this.isWalkable(x, y)) continue;
        // Closest point of tile (x, y) to the circle centre.
        const cx = Math.max(x, Math.min(px, x + 1));
        const cy = Math.max(y, Math.min(py, y + 1));
        if ((px - cx) ** 2 + (py - cy) ** 2 < r * r - 1e-9) return false;
      }
    }
    return true;
  }

  /**
   * Move a circle from `from` by `delta`, sliding along walls: try the full move, then each axis
   * alone. Returns the new position (never inside a blocked tile or off the map).
   */
  slide(from: Vec2, delta: Vec2, r: number): Vec2 {
    const full = { x: from.x + delta.x, y: from.y + delta.y };
    if (this.circleFits(full.x, full.y, r)) return full;
    let p = { ...from };
    const tx = { x: from.x + delta.x, y: from.y };
    if (this.circleFits(tx.x, tx.y, r)) p = tx;
    const ty = { x: p.x, y: p.y + delta.y };
    if (this.circleFits(ty.x, ty.y, r)) p = ty;
    return p;
  }

  /** Nearest walkable tile to (x, y) by straight-line distance (ties: first found). */
  nearestWalkable(x: number, y: number): Vec2 | null {
    if (this.isWalkable(x, y)) return { x, y };
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (let j = 0; j < this.height; j++) {
      for (let i = 0; i < this.width; i++) {
        if (!this.isWalkable(i, j)) continue;
        const d = (i - x) ** 2 + (j - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x: i, y: j };
        }
      }
    }
    return best;
  }
}
