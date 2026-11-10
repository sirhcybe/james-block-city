import { z } from 'zod';
import { PALETTE, type PaletteKey } from '../config';

const paletteKeys = Object.keys(PALETTE) as [PaletteKey, ...PaletteKey[]];

export const TileKind = z.enum(['grass', 'road', 'sidewalk', 'plaza']);
export type TileKind = z.infer<typeof TileKind>;

export const BuildingKind = z.enum([
  'cityhall',
  'tower',
  'house',
  'fountain',
  'tree',
  'police',
  'donutshop',
]);
export type BuildingKind = z.infer<typeof BuildingKind>;

export const BuildingDef = z.object({
  id: z.string().min(1),
  kind: BuildingKind,
  gx: z.number().int().nonnegative(),
  gy: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  d: z.number().int().positive(),
  h: z.number().positive(),
  color: z.enum(paletteKeys),
});
export type BuildingDef = z.infer<typeof BuildingDef>;

const Point = z.object({ gx: z.number(), gy: z.number() });

export const PropKind = z.enum(['cone', 'trashcan', 'trafficLight']);
export type PropKind = z.infer<typeof PropKind>;

export const PropDef = z.object({
  id: z.string().min(1),
  kind: PropKind,
  gx: z.number(),
  gy: z.number(),
});
export type PropDef = z.infer<typeof PropDef>;

/** A pedestrian who strolls back and forth between two sidewalk points. */
export const WalkerDef = z.object({
  id: z.string().min(1),
  look: z.string(),
  from: Point,
  to: Point,
});
export type WalkerDef = z.infer<typeof WalkerDef>;

export const MapDef = z
  .object({
    id: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    legend: z.record(z.string().length(1), TileKind),
    tiles: z.array(z.string()),
    spawn: Point,
    buildings: z.array(BuildingDef),
    /** Named points used by missions, errands and minigames. */
    markers: z.record(z.string(), Point).default({}),
    props: z.array(PropDef).default([]),
    walkers: z.array(WalkerDef).default([]),
  })
  .superRefine((m, ctx) => {
    if (m.tiles.length !== m.height) {
      ctx.addIssue({ code: 'custom', message: `expected ${m.height} tile rows` });
    }
    m.tiles.forEach((row, y) => {
      if (row.length !== m.width) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${y} has ${row.length} tiles, not ${m.width}`,
        });
      }
      for (const ch of row) {
        if (!(ch in m.legend)) {
          ctx.addIssue({ code: 'custom', message: `row ${y}: unknown tile '${ch}'` });
        }
      }
    });
    const ids = new Set<string>();
    for (const b of m.buildings) {
      if (ids.has(b.id)) ctx.addIssue({ code: 'custom', message: `duplicate id ${b.id}` });
      ids.add(b.id);
      if (b.gx + b.w > m.width || b.gy + b.d > m.height) {
        ctx.addIssue({ code: 'custom', message: `${b.id} is outside the map` });
      }
    }
  });
export type MapDef = z.infer<typeof MapDef>;

/** Validate raw JSON; throws a readable error if the content is broken. */
export function parseMap(raw: unknown): MapDef {
  const r = MapDef.safeParse(raw);
  if (!r.success) {
    throw new Error(`Invalid map content:\n${r.error.issues.map((i) => i.message).join('\n')}`);
  }
  return r.data;
}

/** Tile kind at (x, y). */
export function tileAt(m: MapDef, x: number, y: number): TileKind {
  const ch = m.tiles[y]?.[x];
  const kind = ch === undefined ? undefined : m.legend[ch];
  if (!kind) throw new Error(`no tile at ${x},${y}`);
  return kind;
}

/** One map piece placed at a tile offset in the merged world. */
export interface MapPiece {
  map: MapDef;
  ox: number;
  oy: number;
}

/**
 * Merge map pieces into one world map. Tiles, buildings, props, walkers and markers are shifted by
 * each piece's offset; gaps are grass. The world spawn is the first piece's spawn.
 */
export function mergeMaps(id: string, pieces: MapPiece[]): MapDef {
  const width = Math.max(...pieces.map((p) => p.ox + p.map.width));
  const height = Math.max(...pieces.map((p) => p.oy + p.map.height));
  const legend: Record<string, TileKind> = { g: 'grass', r: 'road', s: 'sidewalk', p: 'plaza' };
  const code: Record<TileKind, string> = { grass: 'g', road: 'r', sidewalk: 's', plaza: 'p' };
  const rows = [...Array(height)].map(() => Array<string>(width).fill('g'));
  const shift = <T extends { gx: number; gy: number }>(o: T, p: MapPiece): T => ({
    ...o,
    gx: o.gx + p.ox,
    gy: o.gy + p.oy,
  });
  const merged: MapDef = {
    id,
    width,
    height,
    legend,
    tiles: [],
    spawn: shift(pieces[0]!.map.spawn, pieces[0]!),
    buildings: [],
    markers: {},
    props: [],
    walkers: [],
  };
  for (const p of pieces) {
    const m = p.map;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) rows[y + p.oy]![x + p.ox] = code[tileAt(m, x, y)];
    }
    merged.buildings.push(...m.buildings.map((b) => shift(b, p)));
    merged.props.push(...m.props.map((o) => shift(o, p)));
    merged.walkers.push(
      ...m.walkers.map((w) => ({ ...w, from: shift(w.from, p), to: shift(w.to, p) })),
    );
    for (const [k, v] of Object.entries(m.markers)) {
      if (k in merged.markers) throw new Error(`duplicate marker ${k}`);
      merged.markers[k] = shift(v, p);
    }
  }
  merged.tiles = rows.map((r) => r.join(''));
  return parseMap(merged);
}

/** Look up a named marker; throws if the content is missing it. */
export function marker(m: MapDef, name: string): { gx: number; gy: number } {
  const p = m.markers[name];
  if (!p) throw new Error(`map has no marker '${name}'`);
  return p;
}
