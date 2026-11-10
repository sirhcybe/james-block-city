import { z } from 'zod';
import { PALETTE, type PaletteKey } from '../config';

const paletteKeys = Object.keys(PALETTE) as [PaletteKey, ...PaletteKey[]];

export const TileKind = z.enum(['grass', 'road', 'sidewalk', 'plaza']);
export type TileKind = z.infer<typeof TileKind>;

export const BuildingKind = z.enum(['cityhall', 'tower', 'house', 'fountain', 'tree']);
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

export const MapDef = z
  .object({
    id: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    legend: z.record(z.string().length(1), TileKind),
    tiles: z.array(z.string()),
    spawn: z.object({ gx: z.number(), gy: z.number() }),
    buildings: z.array(BuildingDef),
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
