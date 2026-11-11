import { WalkGrid } from '../iso/grid';
import { buildLaneGraph, type LaneGraph } from '../iso/roads';
import downtownRaw from './downtown.json';
import plazaRaw from './plaza.json';
import { mergeMaps, parseMap, tileAt, type MapDef, type TileKind } from './schema';

/** Build the walk grid for a map: building/tree/fountain footprints and water are blocked. */
export function buildWalkGrid(m: MapDef): WalkGrid {
  const g = new WalkGrid(m.width, m.height);
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) if (tileAt(m, x, y) === 'water') g.block(x, y);
  for (const b of m.buildings) g.blockRect(b.gx, b.gy, b.w, b.d);
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
 * The playable world (ADR-005). Downtown (west, 16×32) is joined to the City Plaza (16×16, east of
 * Downtown's north half). The rest of the 32×32 square is sea until later specs add districts.
 */
export function loadWorld(): MapDef {
  return mergeMaps('city', [
    { map: parseMap(downtownRaw), ox: 0, oy: 0 },
    { map: parseMap(plazaRaw), ox: 16, oy: 0 },
  ]);
}
