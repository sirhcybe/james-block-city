import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { tileAt, type MapDef, type TileKind } from '../content/schema';
import { darken, lighten } from './color';
import { bakeParts, type BakedMeta } from './blocks';
import { project } from './isoShapes';

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
/** Ground is baked in square chunks so no texture gets too big for mobile GPUs (ADR-002). */
export const GROUND_CHUNK = 16;

/** Deterministic pseudo-random in [0,1) per tile, for grass tufts. */
function hash(x: number, y: number, k: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Bake the map's ground (island slab edges, tiles, road lines, grass tufts) as chunk textures.
 * Every chunk's grid origin is world (0,0), so all chunk images are placed at gridToScreen(0,0).
 */
export function groundChunkKey(m: MapDef, cx: number, cy: number): string {
  return `ground:${m.id}:${cx},${cy}`;
}

export function bakeGround(scene: Phaser.Scene, m: MapDef): BakedMeta[] {
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
  const metas: BakedMeta[] = [];

  for (let cy = 0; cy < H; cy += GROUND_CHUNK) {
    for (let cx = 0; cx < W; cx += GROUND_CHUNK) {
      const x1 = Math.min(W, cx + GROUND_CHUNK);
      const y1 = Math.min(H, cy + GROUND_CHUNK);
      // All-sea chunks need no texture: the camera background is the sea.
      let land = false;
      for (let y = cy; y < y1 && !land; y++)
        for (let x = cx; x < x1; x++) if (!isSea(x, y)) land = true;
      if (!land) continue;
      const bounds = [
        project(cx, cy, 0, 1),
        project(x1, cy, 0, 1),
        project(cx, y1, 0, 1),
        project(x1, y1, -SLAB_H, 1),
        project(cx, y1, -SLAB_H, 1),
        project(x1, cy, -SLAB_H, 1),
      ];
      metas.push(
        bakeParts(scene, groundChunkKey(m, cx, cy), [
          {
            type: 'custom',
            bounds,
            draw: (g, ox, oy, s) => {
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
                  if (isSea(x, y)) continue;
                  if (isSea(x, y + 1))
                    side(
                      [
                        P(x, y + 1),
                        P(x + 1, y + 1),
                        P(x + 1, y + 1, -SLAB_H),
                        P(x, y + 1, -SLAB_H),
                      ],
                      EARTH,
                    );
                  if (isSea(x + 1, y))
                    side(
                      [
                        P(x + 1, y + 1),
                        P(x + 1, y),
                        P(x + 1, y, -SLAB_H),
                        P(x + 1, y + 1, -SLAB_H),
                      ],
                      darken(EARTH, 0.2),
                    );
                }
              }

              for (let y = cy; y < y1; y++) {
                for (let x = cx; x < x1; x++) {
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
                      [
                        P(x + 0.2, y + 0.2),
                        P(x + 0.8, y + 0.2),
                        P(x + 0.8, y + 0.8),
                        P(x + 0.2, y + 0.8),
                      ],
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
                  if (isRoad(x, y) && isRoad(x, y + 1) && !isRoad(x, y - 1) && !isRoad(x, y + 2)) {
                    dash(P(x, y + 1), P(x + 1, y + 1));
                  }
                  if (isRoad(x, y) && isRoad(x + 1, y) && !isRoad(x - 1, y) && !isRoad(x + 2, y)) {
                    dash(P(x + 1, y), P(x + 1, y + 1));
                  }
                }
              }
            },
          },
        ]),
      );
    }
  }
  return metas;
}
