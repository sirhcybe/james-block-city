import { WalkGrid } from '../iso/grid';
import { buildLaneGraph, type LaneGraph } from '../iso/roads';
import downtownRaw from './downtown.json';
import harborRaw from './harbor.json';
import heightsRaw from './heights.json';
import parksideRaw from './parkside.json';
import plazaRaw from './plaza.json';
import seaRaw from './sea.json';
import { mergeMaps, parseMap, tileAt, type MapDef, type TileKind } from './schema';

/** Build spots you can walk on once built (they span water). */
const WALK_ON = new Set(['dock', 'bridge']);

/**
 * Build the walk grid for a map: building/tree/fountain footprints and water are blocked. Build
 * spots (spec 005) only count once built: a built dock or bridge makes its water walkable, other
 * built things block their footprint.
 */
export function buildWalkGrid(m: MapDef, built: ReadonlySet<string> = new Set()): WalkGrid {
  const g = new WalkGrid(m.width, m.height);
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) if (tileAt(m, x, y) === 'water') g.block(x, y);
  for (const b of m.buildings) {
    if (b.site && !built.has(b.id)) continue;
    if (b.site && WALK_ON.has(b.kind)) {
      for (let y = b.gy; y < b.gy + b.d; y++)
        for (let x = b.gx; x < b.gx + b.w; x++) g.unblock(x, y);
      continue;
    }
    g.blockRect(b.gx, b.gy, b.w, b.d);
  }
  return g;
}

/** Which tiles each kind of vehicle may drive on (AC10 of spec 003: bikes also use park paths). */
export type VehicleClass = 'car' | 'bike';
const DRIVABLE: Record<VehicleClass, TileKind[]> = {
  car: ['road'],
  bike: ['road', 'path'],
};

/** The lane graph for one vehicle class. */
export function buildRoadGraph(m: MapDef, cls: VehicleClass): LaneGraph {
  const ok = DRIVABLE[cls];
  return buildLaneGraph((x, y) => ok.includes(tileAt(m, x, y)), m.width, m.height);
}

/**
 * Where the rescue boat may sail (spec 008): sea tiles, minus anything built or standing in the
 * water (a built dock or bridge, the barge, rocks). Outside the map is not navigable.
 */
export function buildSeaGrid(m: MapDef, built: ReadonlySet<string> = new Set()): WalkGrid {
  const g = new WalkGrid(m.width, m.height);
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) if (tileAt(m, x, y) !== 'water') g.block(x, y);
  for (const b of m.buildings) {
    if (b.site && !built.has(b.id)) continue;
    g.blockRect(b.gx, b.gy, b.w, b.d);
  }
  return g;
}

/**
 * The playable world (ADR-005, stretched and given open sea in spec 008, Parkside added in spec
 * 010): the sea is the background piece; over it lie Downtown (west), the City Plaza, Skyscraper
 * Heights (under the Plaza), the Harbor (east) and Parkside along the south coast. Parkside
 * starts on the old south grass edge (row 39) and is laid over it. Offsets of the first four come
 * from `scripts/stretch-map.mjs`; see ADR-013 for Parkside.
 */
export function loadWorld(): MapDef {
  return mergeMaps(
    'city',
    [
      { map: parseMap(seaRaw), ox: 0, oy: 0 },
      { map: parseMap(downtownRaw), ox: 0, oy: 0 },
      { map: parseMap(plazaRaw), ox: 21, oy: 0 },
      { map: parseMap(heightsRaw), ox: 21, oy: 21 },
      { map: parseMap(harborRaw), ox: 42, oy: 0 },
      { map: parseMap(parksideRaw), ox: 0, oy: 39 },
    ],
    1,
  );
}
