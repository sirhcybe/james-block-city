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
export function bakeGround(scene: Phaser.Scene, m: MapDef): BakedMeta[] {
  const W = m.width;
  const H = m.height;
  const isRoad = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && tileAt(m, x, y) === 'road';
  const metas: BakedMeta[] = [];

  for (let cy = 0; cy < H; cy += GROUND_CHUNK) {
    for (let cx = 0; cx < W; cx += GROUND_CHUNK) {
      const x1 = Math.min(W, cx + GROUND_CHUNK);
      const y1 = Math.min(H, cy + GROUND_CHUNK);
      const bounds = [
        project(cx, cy, 0, 1),
        project(x1, cy, 0, 1),
        project(cx, y1, 0, 1),
        project(x1, y1, -SLAB_H, 1),
        project(cx, y1, -SLAB_H, 1),
        project(x1, cy, -SLAB_H, 1),
      ];
      metas.push(
        bakeParts(scene, `ground:${m.id}:${cx},${cy}`, [
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
              if (y1 === H) {
                for (let x = cx; x < x1; x++) {
                  side([P(x, H), P(x + 1, H), P(x + 1, H, -SLAB_H), P(x, H, -SLAB_H)], EARTH);
                }
              }
              if (x1 === W) {
                for (let y = cy; y < y1; y++) {
                  side(
                    [P(W, y + 1), P(W, y), P(W, y, -SLAB_H), P(W, y + 1, -SLAB_H)],
                    darken(EARTH, 0.2),
                  );
                }
              }

              for (let y = cy; y < y1; y++) {
                for (let x = cx; x < x1; x++) {
                  const kind = tileAt(m, x, y);
                  const c = TILE_COLOR[kind];
                  const pts = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
                  g.fillStyle(c, 1);
                  g.fillPoints(pts, true);
                  if (kind !== 'grass') {
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
