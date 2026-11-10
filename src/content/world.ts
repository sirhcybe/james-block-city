import { WalkGrid } from '../iso/grid';
import downtownRaw from './downtown-slice.json';
import plazaRaw from './plaza.json';
import { mergeMaps, parseMap, type MapDef } from './schema';

/** Build the walk grid for a map: every building/tree/fountain footprint is blocked. */
export function buildWalkGrid(m: MapDef): WalkGrid {
  const g = new WalkGrid(m.width, m.height);
  for (const b of m.buildings) g.blockRect(b.gx, b.gy, b.w, b.d);
  return g;
}

/** The playable world: Downtown slice (west / screen up-left) joined to the City Plaza. */
export function loadWorld(): MapDef {
  return mergeMaps('city', [
    { map: parseMap(downtownRaw), ox: 0, oy: 0 },
    { map: parseMap(plazaRaw), ox: 16, oy: 0 },
  ]);
}
