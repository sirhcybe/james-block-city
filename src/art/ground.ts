import type Phaser from 'phaser';
import { BLOCK_H, PALETTE } from '../config';
import { tileAt, type MapDef, type TileKind } from '../content/schema';
import { darken, lighten } from './color';
import { bakeGraphics } from './bake';
import { project } from './isoShapes';
import { WT } from './renderScale';

const TILE_COLOR: Record<TileKind, number> = {
  grass: PALETTE.grass,
  road: PALETTE.road,
  sidewalk: PALETTE.sidewalk,
  plaza: PALETTE.plaza,
  path: PALETTE.parkPath,
  water: PALETTE.water,
  sand: PALETTE.sand,
};

const EARTH = 0xb98a5a;
const SLAB_H = 0.6;
/** Ground textures are screen-aligned rectangles this big (world px) that tile the map. */
export const GROUND_TILE_W = 1024;
export const GROUND_TILE_H = 512;

/** Deterministic pseudo-random in [0,1) per tile, for grass tufts. */
function hash(x: number, y: number, k: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** One baked ground texture and where its top-left corner sits in the world (px). */
export interface GroundTile {
  key: string;
  x: number;
  y: number;
}

const groundByMap = new Map<string, GroundTile[]>();

export function groundTileKey(m: MapDef, sx: number, sy: number): string {
  return `ground:${m.id}:${sx},${sy}`;
}

/** The ground textures baked for a map (place each at its x, y with origin 0 and scale 1/WT). */
export function groundTiles(m: MapDef): GroundTile[] {
  return groundByMap.get(m.id) ?? [];
}

/**
 * Bake the map's ground (island slab edges, tiles, road lines, grass tufts, kerbs, coastline) as
 * screen-aligned textures of GROUND_TILE_W × GROUND_TILE_H world px.
 */
export function bakeGround(scene: Phaser.Scene, m: MapDef): GroundTile[] {
  const W = m.width;
  const H = m.height;
  const isRoad = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && tileAt(m, x, y) === 'road';
  const isSea = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= H || tileAt(m, x, y) === 'water';
  // Open sea = water connected to the map edge; other water (the duck pond) is drawn.
  const sea = new Set<number>();
  const stack: [number, number][] = [];
  for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= W || y >= H || sea.has(y * W + x) || tileAt(m, x, y) !== 'water')
      continue;
    sea.add(y * W + x);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const isSeaEdge = (x: number, y: number) => sea.has(y * W + x);
  /**
   * Draw the ground for grid tiles [cx, x1) × [cy, y1) into `g`, with world (0, 0) at (ox, oy).
   * `keep` says which tiles touch the texture being baked; the rest are skipped.
   */
  const drawRange = (
    g: Phaser.GameObjects.Graphics,
    ox: number,
    oy: number,
    s: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    keep: (x: number, y: number) => boolean,
  ): void => {
    const P = (x: number, y: number, z = 0) => {
      const p = project(x, y, z, s);
      return { x: p.x + ox, y: p.y + oy };
    };
    // Island slab sides on the map's front edges.
    const side = (pts: { x: number; y: number }[], color: number) => {
      g.fillStyle(color, 1);
      g.fillPoints(pts, true);
      g.lineStyle(2 * s, PALETTE.outline, 1);
      g.lineBetween(pts[2]!.x, pts[2]!.y, pts[3]!.x, pts[3]!.y);
    };
    // Earth sides wherever land meets water on its front (+x / +y) edges.
    for (let y = cy; y < y1; y++) {
      for (let x = cx; x < x1; x++) {
        if (!keep(x, y)) continue;
        if (isSea(x, y)) continue;
        if (isSea(x, y + 1))
          side(
            [P(x, y + 1), P(x + 1, y + 1), P(x + 1, y + 1, -SLAB_H), P(x, y + 1, -SLAB_H)],
            EARTH,
          );
        if (isSea(x + 1, y))
          side(
            [P(x + 1, y + 1), P(x + 1, y), P(x + 1, y, -SLAB_H), P(x + 1, y + 1, -SLAB_H)],
            darken(EARTH, 0.2),
          );
      }
    }

    for (let y = cy; y < y1; y++) {
      for (let x = cx; x < x1; x++) {
        if (!keep(x, y)) continue;
        const kind = tileAt(m, x, y);
        if (kind === 'water' && isSeaEdge(x, y)) continue; // open sea: background
        const c = TILE_COLOR[kind];
        const pts = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
        g.fillStyle(c, 1);
        g.fillPoints(pts, true);
        if (kind === 'water') {
          // Pond: a darker middle and a couple of ripples.
          g.fillStyle(PALETTE.pondDeep, 1);
          g.fillPoints(
            [P(x + 0.2, y + 0.2), P(x + 0.8, y + 0.2), P(x + 0.8, y + 0.8), P(x + 0.2, y + 0.8)],
            true,
          );
          g.lineStyle(Math.max(1, 1.5 * s), lighten(PALETTE.water, 0.4), 1);
          const r = P(x + 0.3 + hash(x, y, 1) * 0.4, y + 0.3 + hash(y, x, 1) * 0.4);
          g.lineBetween(r.x - 6 * s, r.y, r.x + 6 * s, r.y);
        } else if (kind === 'sand') {
          // no grid lines on a beach
        } else if (kind !== 'grass') {
          g.lineStyle(Math.max(1, s), darken(c, 0.08), 1);
          g.strokePoints(pts, true);
        } else {
          g.lineStyle(Math.max(1, 1.5 * s), darken(PALETTE.grass, 0.18), 1);
          for (let k = 0; k < 3; k++) {
            const t = P(x + 0.15 + hash(x, y, k) * 0.7, y + 0.15 + hash(y, x, k) * 0.7);
            g.lineBetween(t.x - 3 * s, t.y - 4 * s, t.x, t.y);
            g.lineBetween(t.x + 3 * s, t.y - 4 * s, t.x, t.y);
          }
        }
        if (kind === 'sand') {
          // Speckles and a little shell-pink dot so beaches don't look like paving.
          g.fillStyle(darken(c, 0.14), 1);
          for (let k = 0; k < 5; k++) {
            const t = P(x + 0.12 + hash(x, y, k) * 0.76, y + 0.12 + hash(y, x, k) * 0.76);
            g.fillCircle(t.x, t.y, 1.3 * s);
          }
          if (hash(x, y, 9) < 0.3) {
            const t = P(x + 0.3 + hash(x, y, 7) * 0.4, y + 0.3 + hash(y, x, 7) * 0.4);
            g.fillStyle(0xffb3c7, 1);
            g.fillCircle(t.x, t.y, 2.4 * s);
          }
        }
        if (kind === 'sidewalk') {
          g.lineStyle(Math.max(1, s), lighten(c, 0.5), 1);
          g.lineBetween(pts[3]!.x, pts[3]!.y - s, pts[0]!.x, pts[0]!.y + s);
        }
      }
    }

    // Edges are found tile by tile but drawn as long runs: one line per straight
    // stretch, so a chunk needs a few dozen strokes instead of thousands.
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    type Edge = (x: number, y: number) => boolean;
    /** Runs along gx: `on(x, y)` says the edge on the north side of tile (x, y) is on. */
    const runsX = (on: Edge, draw: (x0: number, x1: number, y: number) => void) => {
      for (let y = cy; y <= y1; y++) {
        let start = -1;
        for (let x = cx; x <= x1; x++) {
          const hit = x < x1 && on(x, y);
          if (hit && start < 0) start = x;
          if (!hit && start >= 0) {
            draw(start, x, y);
            start = -1;
          }
        }
      }
    };
    /** Runs along gy: `on(x, y)` says the edge on the west side of tile (x, y) is on. */
    const runsY = (on: Edge, draw: (y0: number, y1: number, x: number) => void) => {
      for (let x = cx; x <= x1; x++) {
        let start = -1;
        for (let y = cy; y <= y1; y++) {
          const hit = y < y1 && on(x, y);
          if (hit && start < 0) start = y;
          if (!hit && start >= 0) {
            draw(start, y, x);
            start = -1;
          }
        }
      }
    };
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      g.lineBetween(a.x, a.y, b.x, b.y);

    // Kerbs: where a road meets anything else, a pale kerb stone with a dark seam, so
    // roads have a crisp edge instead of two flat colours touching.
    const kerbX: Edge = (x, y) =>
      inMap(x, y) && inMap(x, y - 1) && isRoad(x, y) !== isRoad(x, y - 1);
    const kerbY: Edge = (x, y) =>
      inMap(x, y) && inMap(x - 1, y) && isRoad(x, y) !== isRoad(x - 1, y);
    for (const [w, color, alpha] of [
      [3 * s, 0xf1f3f7, 1],
      [Math.max(1, s), darken(PALETTE.road, 0.35), 0.9],
    ] as const) {
      g.lineStyle(w, color, alpha);
      runsX(kerbX, (x0, x2, y) => line(P(x0, y), P(x2, y)));
      runsY(kerbY, (y0, y2, x) => line(P(x, y0), P(x, y2)));
    }

    // Coastline: the outline runs round the top edge of the land wherever it meets the
    // open sea, and down the corners of the earth sides.
    const open = (x: number, y: number) => !inMap(x, y) || isSeaEdge(x, y);
    g.lineStyle(2 * s, PALETTE.outline, 1);
    runsX(
      (x, y) => open(x, y) !== open(x, y - 1),
      (x0, x2, y) => line(P(x0, y), P(x2, y)),
    );
    runsY(
      (x, y) => open(x, y) !== open(x - 1, y),
      (y0, y2, x) => line(P(x, y0), P(x, y2)),
    );
    for (let y = cy; y < y1; y++) {
      for (let x = cx; x < x1; x++) {
        if (!keep(x, y)) continue;
        if (open(x, y)) continue;
        const front = open(x, y + 1);
        const right = open(x + 1, y);
        // Vertical edges where a run of earth side starts, ends or turns a corner.
        if (front && (open(x - 1, y) || !open(x - 1, y + 1)))
          line(P(x, y + 1), P(x, y + 1, -SLAB_H));
        if (right && (open(x, y - 1) || !open(x + 1, y - 1)))
          line(P(x + 1, y), P(x + 1, y, -SLAB_H));
        // The front corner, where the two sides meet. Where a side runs into land in
        // front of it, that land's top hides the corner, so no line there.
        if (front && right) line(P(x + 1, y + 1), P(x + 1, y + 1, -SLAB_H));
      }
    }

    // Dashed centre lines between two-lane road stripes.
    g.lineStyle(2.5 * s, PALETTE.roadLine, 0.95);
    const dash = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      g.lineBetween(
        a.x + (b.x - a.x) * 0.25,
        a.y + (b.y - a.y) * 0.25,
        a.x + (b.x - a.x) * 0.75,
        a.y + (b.y - a.y) * 0.75,
      );
    };
    for (let y = cy; y < y1; y++) {
      for (let x = cx; x < x1; x++) {
        if (!keep(x, y)) continue;
        if (isRoad(x, y) && isRoad(x, y + 1) && !isRoad(x, y - 1) && !isRoad(x, y + 2)) {
          dash(P(x, y + 1), P(x + 1, y + 1));
        }
        if (isRoad(x, y) && isRoad(x + 1, y) && !isRoad(x - 1, y) && !isRoad(x + 2, y)) {
          dash(P(x + 1, y), P(x + 1, y + 1));
        }
      }
    }
  };

  // Screen-aligned textures that sit edge to edge: every pixel of ground is drawn once per frame,
  // and no texture is half transparent (ADR-013: the old 16 × 16-tile chunks were diamonds in
  // rectangles, so most of the screen had ground drawn twice).
  const TW = GROUND_TILE_W;
  const TH = GROUND_TILE_H;
  const slab = SLAB_H * BLOCK_H;
  const s = WT;
  // Which grid tiles a screen point lies over (the inverse of project at z = 0).
  const gx = (px: number, py: number) => (py / 16 + px / 32) / 2;
  const gy = (px: number, py: number) => (py / 16 - px / 32) / 2;
  const tiles: GroundTile[] = [];
  const bottom = (W + H) * 16 + slab;
  for (let sy = 0; sy < bottom; sy += TH) {
    for (let sx = Math.floor((-H * 32) / TW) * TW; sx < W * 32; sx += TW) {
      // A tile's diamond spans x ± 32 and y 0..32 from its north corner, plus the slab below.
      const keep = (x: number, y: number) => {
        const n = project(x, y, 0, 1);
        return n.x + 32 > sx && n.x - 32 < sx + TW && n.y + 32 + slab > sy && n.y < sy + TH;
      };
      const xs = [sx - 32, sx + TW + 32];
      const ys = [sy - 32 - slab, sy + TH];
      const gxs = xs.flatMap((px) => ys.map((py) => gx(px, py)));
      const gys = xs.flatMap((px) => ys.map((py) => gy(px, py)));
      const x0 = Math.max(0, Math.floor(Math.min(...gxs)) - 1);
      const x1 = Math.min(W, Math.ceil(Math.max(...gxs)) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(...gys)) - 1);
      const y1 = Math.min(H, Math.ceil(Math.max(...gys)) + 1);
      let land = false;
      for (let y = y0; y < y1 && !land; y++)
        for (let x = x0; x < x1 && !land; x++) if (!isSeaEdge(x, y) && keep(x, y)) land = true;
      if (!land) continue; // all sea: the camera background is the sea
      const key = groundTileKey(m, sx, sy);
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawRange(g, -sx * s, -sy * s, s, x0, y0, x1, y1, keep);
      bakeGraphics(scene, g, key, TW * s, TH * s);
      g.destroy();
      tiles.push({ key, x: sx, y: sy });
    }
  }
  groundByMap.set(m.id, tiles);
  return tiles;
}
