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

/** Deterministic pseudo-random in [0,1) per tile, for grass tufts. */
function hash(x: number, y: number, k: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Bake the whole map's ground (an island slab with tiles, road lines and grass tufts). */
export function bakeGround(scene: Phaser.Scene, m: MapDef): BakedMeta {
  const W = m.width;
  const H = m.height;
  const isRoad = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && tileAt(m, x, y) === 'road';

  return bakeParts(scene, `ground:${m.id}`, [
    // Island slab: earth sides under the grass.
    { type: 'block', w: W, d: H, h: 0.6, gz: -0.6, color: 0xb98a5a, top: PALETTE.grass, bevel: 0 },
    {
      type: 'custom',
      bounds: [project(0, 0, 0, 1), project(W, H, 0, 1)],
      draw: (g, ox, oy, s) => {
        const P = (x: number, y: number) => {
          const p = project(x, y, 0, s);
          return { x: p.x + ox, y: p.y + oy };
        };
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const kind = tileAt(m, x, y);
            const c = TILE_COLOR[kind];
            const pts = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
            g.fillStyle(c, 1);
            g.fillPoints(pts, true);
            if (kind !== 'grass') {
              g.lineStyle(Math.max(1, s), darken(c, 0.08), 1);
              g.strokePoints(pts, true);
            } else {
              // A few tufts.
              g.lineStyle(Math.max(1, 1.5 * s), darken(PALETTE.grass, 0.18), 1);
              for (let k = 0; k < 3; k++) {
                const t = P(x + 0.15 + hash(x, y, k) * 0.7, y + 0.15 + hash(y, x, k) * 0.7);
                g.lineBetween(t.x - 3 * s, t.y - 4 * s, t.x, t.y);
                g.lineBetween(t.x + 3 * s, t.y - 4 * s, t.x, t.y);
              }
            }
            if (kind === 'sidewalk') {
              // Subtle highlight on the top-left edges for a "kerb" feel.
              g.lineStyle(Math.max(1, s), lighten(c, 0.5), 1);
              g.lineBetween(pts[3]!.x, pts[3]!.y - s, pts[0]!.x, pts[0]!.y + s);
            }
          }
        }
        // Dashed centre lines between two-lane road stripes.
        g.lineStyle(2.5 * s, PALETTE.roadLine, 0.95);
        const dash = (a: { x: number; y: number }, b: { x: number; y: number }) => {
          const ax = a.x + (b.x - a.x) * 0.25;
          const ay = a.y + (b.y - a.y) * 0.25;
          const bx = a.x + (b.x - a.x) * 0.75;
          const by = a.y + (b.y - a.y) * 0.75;
          g.lineBetween(ax, ay, bx, by);
        };
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            // Horizontal-in-grid stripe: rows y and y+1 are road, y-1 and y+2 are not.
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
  ]);
}
