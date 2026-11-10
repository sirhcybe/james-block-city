import { WalkGrid } from '../iso/grid';
import type { MapDef } from './schema';

/** Build the walk grid for a map: every building/tree/fountain footprint is blocked. */
export function buildWalkGrid(m: MapDef): WalkGrid {
  const g = new WalkGrid(m.width, m.height);
  for (const b of m.buildings) g.blockRect(b.gx, b.gy, b.w, b.d);
  return g;
}
