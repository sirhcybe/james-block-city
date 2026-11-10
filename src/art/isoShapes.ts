import { BLOCK_H, TILE_H, TILE_W } from '../config';
import type { Vec2 } from '../iso/projection';

/**
 * Pure geometry for drawing iso blocks (no Phaser), so the "three faces, no studs" rule is testable.
 * All coordinates are texture-local pixels at scale `s`, relative to an origin that corresponds to
 * grid point (0,0,0).
 */
export interface BlockGeom {
  /** Footprint in tiles along gx (w) and gy (d); height in block units. */
  w: number;
  d: number;
  h: number;
  /** Position of the block's north corner in grid units, relative to the texture origin. */
  gx?: number;
  gy?: number;
  gz?: number;
}

export interface BlockFaces {
  top: Vec2[];
  left: Vec2[];
  right: Vec2[];
  /** Outer outline (hexagon). */
  silhouette: Vec2[];
}

export function project(gx: number, gy: number, gz: number, s: number): Vec2 {
  return { x: (gx - gy) * (TILE_W / 2) * s, y: ((gx + gy) * (TILE_H / 2) - gz * BLOCK_H) * s };
}

/** The three visible faces of a block. Exactly three faces, each a flat quad: no studs. */
export function blockFaces(b: BlockGeom, s: number): BlockFaces {
  const x0 = b.gx ?? 0;
  const y0 = b.gy ?? 0;
  const z0 = b.gz ?? 0;
  const z1 = z0 + b.h;
  const p = (x: number, y: number, z: number) => project(x, y, z, s);
  const N1 = p(x0, y0, z1);
  const E0 = p(x0 + b.w, y0, z0);
  const E1 = p(x0 + b.w, y0, z1);
  const S0 = p(x0 + b.w, y0 + b.d, z0);
  const S1 = p(x0 + b.w, y0 + b.d, z1);
  const W0 = p(x0, y0 + b.d, z0);
  const W1 = p(x0, y0 + b.d, z1);
  return {
    top: [N1, E1, S1, W1],
    left: [W0, S0, S1, W1],
    right: [S0, E0, E1, S1],
    silhouette: [W0, S0, E0, E1, N1, W1],
  };
}

/** Pixel bounds of a set of points. */
export function boundsOf(points: Vec2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of points) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * A point on a vertical face. `face` 'left' runs along +gx at gy = y0 + d; 'right' runs along -gy
 * at gx = x0 + w (u measured from the south corner). u in tiles, z in block units.
 */
export function facePoint(
  b: BlockGeom,
  face: 'left' | 'right',
  u: number,
  z: number,
  s: number,
): Vec2 {
  const x0 = b.gx ?? 0;
  const y0 = b.gy ?? 0;
  const z0 = b.gz ?? 0;
  return face === 'left'
    ? project(x0 + u, y0 + b.d, z0 + z, s)
    : project(x0 + b.w, y0 + b.d - u, z0 + z, s);
}
