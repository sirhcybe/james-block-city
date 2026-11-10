import { describe, expect, it } from 'vitest';
import { darken, lighten } from '../../src/art/color';
import { blockFaces, boundsOf, orientedBoxFaces, project } from '../../src/art/isoShapes';

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

describe('oriented boxes (vehicles in 8 headings, still no studs)', () => {
  it('shows at most two side faces plus a flat top, at every heading', () => {
    for (let k = 0; k < 8; k++) {
      const f = orientedBoxFaces(
        { cx: 0, cy: 0, halfL: 0.6, halfW: 0.35, z0: 0, z1: 0.4, angle: (k * Math.PI) / 4 },
        1,
      );
      const visible = f.sides.filter((s) => s.visible);
      expect(visible.length).toBeGreaterThanOrEqual(1);
      expect(visible.length).toBeLessThanOrEqual(2);
      const topY = Math.min(...f.top.map((p) => p.y));
      expect(boundsOf(f.silhouette).minY).toBeCloseTo(topY, 9); // nothing pokes above the top
    }
  });

  it('heading straight down the screen shows only the front face', () => {
    const f = orientedBoxFaces(
      { cx: 0, cy: 0, halfL: 0.6, halfW: 0.35, z0: 0, z1: 0.4, angle: Math.PI / 4 },
      1,
    );
    expect(f.sides.filter((s) => s.visible).map((s) => s.side)).toEqual(['front']);
  });
});
