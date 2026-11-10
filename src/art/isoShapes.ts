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

/**
 * A box turned to any angle on the ground (vehicles drawn in 8 directions). Same look rules as
 * blocks: flat top, flat sides, no studs. `angle` is the grid-space heading of the long axis.
 */
export interface OrientedBox {
  /** Centre of the footprint, grid units. */
  cx: number;
  cy: number;
  /** Half length along the heading and half width across it, tiles. */
  halfL: number;
  halfW: number;
  z0: number;
  z1: number;
  angle: number;
}

export type OrientedSide = 'front' | 'back' | 'left' | 'right';

export interface OrientedFace {
  side: OrientedSide;
  /** Grid-space outward normal. */
  normal: Vec2;
  /** Ground corners at u = 0 and u = 1 along the face (grid units). */
  a: Vec2;
  b: Vec2;
  /** Projected quad: bottom a, bottom b, top b, top a. */
  pts: Vec2[];
  /** 0 = faces +gy (base colour), 1 = faces +gx (darkest), like the block's left/right faces. */
  shade: number;
  /** Visible from the iso camera (faces toward the viewer, i.e. toward +gx+gy). */
  visible: boolean;
}

export function orientedAxes(angle: number): { f: Vec2; r: Vec2 } {
  const f = { x: Math.cos(angle), y: Math.sin(angle) };
  return { f, r: { x: -f.y, y: f.x } };
}

/** All four side faces, the top face and the silhouette of an oriented box. */
export function orientedBoxFaces(
  o: OrientedBox,
  s: number,
): { sides: OrientedFace[]; top: Vec2[]; silhouette: Vec2[] } {
  const { f, r } = orientedAxes(o.angle);
  const g = (i: number, j: number): Vec2 => ({
    x: o.cx + f.x * o.halfL * i + r.x * o.halfW * j,
    y: o.cy + f.y * o.halfL * i + r.y * o.halfW * j,
  });
  const P = (p: Vec2, z: number) => project(p.x, p.y, z, s);
  const FL = g(1, -1);
  const FR = g(1, 1);
  const BL = g(-1, -1);
  const BR = g(-1, 1);
  const face = (side: OrientedSide, normal: Vec2, a: Vec2, b: Vec2): OrientedFace => {
    const sum = normal.x + normal.y;
    return {
      side,
      normal,
      a,
      b,
      pts: [P(a, o.z0), P(b, o.z0), P(b, o.z1), P(a, o.z1)],
      shade: sum > 1e-9 ? Math.max(0, Math.min(1, normal.x / sum)) : 0,
      visible: sum > 1e-3,
    };
  };
  const neg = (v: Vec2) => ({ x: -v.x, y: -v.y });
  const sides = [
    face('front', f, FL, FR),
    face('back', neg(f), BR, BL),
    face('right', r, FR, BR),
    face('left', neg(r), BL, FL),
  ];
  const top = [P(FL, o.z1), P(FR, o.z1), P(BR, o.z1), P(BL, o.z1)];
  const all = [FL, FR, BR, BL].flatMap((p) => [P(p, o.z0), P(p, o.z1)]);
  return { sides, top, silhouette: convexHull(all) };
}

/** A point on an oriented face: u 0..1 along it, z in block units (absolute). */
export function orientedFacePoint(fc: OrientedFace, u: number, z: number, s: number): Vec2 {
  return project(fc.a.x + (fc.b.x - fc.a.x) * u, fc.a.y + (fc.b.y - fc.a.y) * u, z, s);
}

/** Convex hull (monotone chain), counter-clockwise. */
export function convexHull(points: Vec2[]): Vec2[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec2[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: Vec2[] = [];
  for (const pt of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, pt) <= 0) upper.pop();
    upper.push(pt);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
