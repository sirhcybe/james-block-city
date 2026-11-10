import { BLOCK_H, TILE_H, TILE_W } from '../config';

export interface Vec2 {
  x: number;
  y: number;
}

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

/**
 * Grid (tiles, continuous) -> screen (px). Grid point (0,0) is the north (top) corner of tile (0,0).
 * gz is in block-height units.
 */
export function gridToScreen(gx: number, gy: number, gz = 0): Vec2 {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H - gz * BLOCK_H };
}

/** Screen (px) -> grid (continuous), assuming gz = 0. Inverse of gridToScreen. */
export function screenToGrid(x: number, y: number): Vec2 {
  const a = x / HALF_W; // gx - gy
  const b = y / HALF_H; // gx + gy
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Integer tile containing a continuous grid position. */
export function tileOf(gx: number, gy: number): Vec2 {
  return { x: Math.floor(gx), y: Math.floor(gy) };
}

/** Painter's-order depth. Larger = drawn later (in front). */
export function depthOf(gx: number, gy: number, gz = 0): number {
  return (gx + gy) * 100 + gz;
}

/** Axis-aligned footprint on the grid: [x, x+w) × [y, y+d). */
export interface Footprint {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** Static depth for a multi-tile object: sorts by its front-most tile. */
export function footprintDepth(f: Footprint): number {
  return depthOf(f.x + f.w - 1 + 0.5, f.y + f.d - 1 + 0.5);
}

/**
 * Whether a point object (with radius r) is in front of a box footprint, from the iso viewer's point
 * of view. The viewer looks from +x/+y, so anything entirely past the box's far x or far y edge is in
 * front. Assumes the point is not inside the footprint.
 */
export function isInFrontOf(px: number, py: number, f: Footprint, r = 0): boolean {
  return px - r >= f.x + f.w - 1e-6 || py - r >= f.y + f.d - 1e-6;
}

/**
 * Choose a depth for a moving object given the static depths of overlapping boxes it must be in
 * front of / behind. Falls back to its own painter's depth when unconstrained.
 */
export function resolveDepth(own: number, frontOf: number[], behind: number[]): number {
  let d = own;
  for (const f of frontOf) if (d <= f) d = f + 1;
  for (const b of behind) if (d >= b) d = b - 1;
  return d;
}
