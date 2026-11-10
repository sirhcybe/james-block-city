import { describe, expect, it } from 'vitest';
import { darken, lighten } from '../../src/art/color';
import { blockFaces, boundsOf, project } from '../../src/art/isoShapes';

describe('block geometry (art-style: three faces, no studs)', () => {
  const f = blockFaces({ w: 2, d: 1, h: 1 }, 1);

  it('has exactly three flat quad faces and a hexagon silhouette', () => {
    expect(Object.keys(f).sort()).toEqual(['left', 'right', 'silhouette', 'top']);
    expect(f.top).toHaveLength(4);
    expect(f.left).toHaveLength(4);
    expect(f.right).toHaveLength(4);
    expect(f.silhouette).toHaveLength(6);
  });

  it('the top face is flat: nothing rises above it (no studs/pegs)', () => {
    const topY = Math.min(...f.top.map((p) => p.y));
    const all = [...f.top, ...f.left, ...f.right, ...f.silhouette];
    expect(boundsOf(all).minY).toBe(topY);
    // The top face sits exactly one block-height above the ground footprint.
    expect(project(0, 0, 1, 1).y).toBe(topY);
  });

  it('shades top lighter and right darker than the base color', () => {
    const base = 0x2f6fde;
    const lum = (c: number) => ((c >> 16) & 0xff) + ((c >> 8) & 0xff) + (c & 0xff);
    expect(lum(lighten(base, 0.15))).toBeGreaterThan(lum(base));
    expect(lum(darken(base, 0.2))).toBeLessThan(lum(base));
  });
});
