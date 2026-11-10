import { describe, expect, it } from 'vitest';
import { footprintDepth } from '../../src/iso/projection';
import { resolveOcclusion, type Occluder } from '../../src/systems/occlusion';

const tower = { x: 10, y: 4, w: 2, d: 2 };
const house = { x: 7, y: 4, w: 2, d: 1 };
const occ = (id: string, box: typeof tower, overlaps = true): Occluder => ({
  id,
  box,
  depth: footprintDepth(box),
  overlaps,
});

describe('resolveOcclusion', () => {
  it('walker behind a tall building (north-west of it) is hidden and sorts behind', () => {
    const r = resolveOcclusion({ x: 9.5, y: 4.5, r: 0.28 }, [occ('tower', tower)]);
    expect(r.hiding.has('tower')).toBe(true);
    expect(r.depth).toBeLessThan(footprintDepth(tower));
  });

  it('walker in front (south / east) is not hidden and sorts in front', () => {
    for (const p of [
      { x: 11, y: 6.5 },
      { x: 12.5, y: 4.2 },
      { x: 12.5, y: 3.6 },
    ]) {
      const r = resolveOcclusion({ ...p, r: 0.28 }, [occ('tower', tower)]);
      expect(r.hiding.size, JSON.stringify(p)).toBe(0);
      expect(r.depth).toBeGreaterThan(footprintDepth(tower));
    }
  });

  it('ignores occluders that do not overlap on screen', () => {
    const r = resolveOcclusion({ x: 9.5, y: 4.5, r: 0.28 }, [occ('tower', tower, false)]);
    expect(r.hiding.size).toBe(0);
  });

  it('sorts between two overlapping boxes: in front of one, behind the other', () => {
    // Between the small shop (north) and the tower (east): in front of the shop, behind the tower.
    const r = resolveOcclusion({ x: 9.5, y: 5.5, r: 0.28 }, [
      occ('house', house),
      occ('tower', tower),
    ]);
    expect(r.depth).toBeGreaterThan(footprintDepth(house));
    expect(r.depth).toBeLessThan(footprintDepth(tower));
    expect([...r.hiding]).toEqual(['tower']);
  });
});
