import type Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Facing } from '../entities/Player';
import { darken, lighten } from './color';
import { bakeParts, type BakedMeta, type Part } from './blocks';
import { FACINGS } from './characters';
import { facePoint, project, type BlockGeom } from './isoShapes';
import { drawStar } from './shapes2d';

export interface VehicleLook {
  name: string;
  body: number;
  cabin: number | null;
  /** Length along travel and width, in tiles. */
  length: number;
  width: number;
  /** Chassis height (block units). */
  bodyH: number;
  lightBar: boolean;
  star: boolean;
  /** Draw a masked driver sitting in an open-top car. */
  robberDriver?: boolean;
  stripe?: number;
}

export const POLICE_CAR: VehicleLook = {
  name: 'police-car',
  body: PALETTE.buildingWhite,
  cabin: PALETTE.policeBlue,
  length: 1.3,
  width: 0.74,
  bodyH: 0.38,
  lightBar: true,
  star: true,
  stripe: PALETTE.policeBlue,
};

export const GETAWAY_CAR: VehicleLook = {
  name: 'getaway-car',
  body: PALETTE.getawayPurple,
  cabin: null,
  length: 1.25,
  width: 0.72,
  bodyH: 0.36,
  lightBar: false,
  star: false,
  robberDriver: true,
};

export const POLICE_VAN: VehicleLook = {
  name: 'police-van',
  body: PALETTE.buildingWhite,
  cabin: null,
  length: 1.6,
  width: 0.82,
  bodyH: 0.9,
  lightBar: true,
  star: true,
  stripe: PALETTE.policeBlue,
};

/** Light frame: 0 = off, 1 = red bright, 2 = blue bright. */
export type LightFrame = 0 | 1 | 2;

export function vehicleFrameKey(name: string, f: Facing, wheel: 0 | 1, light: LightFrame): string {
  return `${name}-${f}-${wheel}-${light}`;
}

const along = (f: Facing) => (f === 'SE' || f === 'NW' ? 'x' : 'y');
const forwardSign = (f: Facing) => (f === 'SE' || f === 'SW' ? 1 : -1);

function vehicleParts(v: VehicleLook, facing: Facing, wheel: 0 | 1, light: LightFrame): Part[] {
  const ax = along(facing);
  const fwd = forwardSign(facing);
  const L = v.length;
  const Wd = v.width;
  const w = ax === 'x' ? L : Wd;
  const d = ax === 'x' ? Wd : L;
  const chassis: BlockGeom = { gx: -w / 2, gy: -d / 2, gz: 0.12, w, d, h: v.bodyH };
  // The long side we can see: 'left' face runs along gx, 'right' face along gy.
  const side: 'left' | 'right' = ax === 'x' ? 'left' : 'right';
  // The visible short end: front if driving toward the viewer (SE/SW), else the back.
  const end: 'left' | 'right' = ax === 'x' ? 'right' : 'left';
  const showsFront = fwd === 1;
  const parts: Part[] = [
    // Fixed frame box so every frame has the same size and origin (wheels, glow, driver fit inside).
    {
      type: 'custom',
      bounds: [
        { x: -64, y: -96 },
        { x: 64, y: 36 },
      ],
      draw: () => {},
    },
    { type: 'block', ...chassis, color: v.body, bevel: 3 },
  ];

  if (v.stripe !== undefined) {
    parts.push({
      type: 'window',
      block: chassis,
      face: side,
      u0: 0.04,
      u1: L - 0.04,
      z0: v.bodyH * 0.35,
      z1: v.bodyH * 0.6,
      color: v.stripe,
    });
  }
  // Head / tail lights on the visible end.
  for (const u of [0.08, Wd - 0.2]) {
    parts.push({
      type: 'window',
      block: chassis,
      face: end,
      u0: u,
      u1: u + 0.12,
      z0: v.bodyH * 0.45,
      z1: v.bodyH * 0.8,
      color: showsFront ? 0xfff1a8 : PALETTE.fireRed,
    });
  }

  // Cabin, a little toward the back.
  const back = -fwd * 0.08;
  let roofZ = 0.12 + v.bodyH;
  if (v.cabin !== null) {
    const cl = L * 0.52;
    const cabin: BlockGeom =
      ax === 'x'
        ? { gx: -cl / 2 + back, gy: -Wd / 2 + 0.05, gz: roofZ, w: cl, d: Wd - 0.1, h: 0.26 }
        : { gx: -Wd / 2 + 0.05, gy: -cl / 2 + back, gz: roofZ, w: Wd - 0.1, d: cl, h: 0.26 };
    parts.push({ type: 'block', ...cabin, color: v.body, top: lighten(v.cabin, 0.1), bevel: 3 });
    for (const face of ['left', 'right'] as const) {
      const span = face === 'left' ? cabin.w : cabin.d;
      parts.push({
        type: 'window',
        block: cabin,
        face,
        u0: 0.06,
        u1: span - 0.06,
        z0: 0.06,
        z1: 0.22,
        color: PALETTE.windowBlue,
      });
    }
    roofZ += 0.26;
  }

  if (v.lightBar) {
    const bright = (c: number, on: boolean) => (on ? lighten(c, 0.35) : darken(c, 0.35));
    const half = 0.16;
    const red = { color: bright(PALETTE.fireRed, light === 1), bevel: 1 };
    const blue = { color: bright(PALETTE.policeBlue, light === 2), bevel: 1 };
    if (ax === 'x') {
      parts.push({
        type: 'block',
        gx: -0.1 + back,
        gy: -half,
        gz: roofZ,
        w: 0.2,
        d: half,
        h: 0.1,
        ...red,
      });
      parts.push({
        type: 'block',
        gx: -0.1 + back,
        gy: 0,
        gz: roofZ,
        w: 0.2,
        d: half,
        h: 0.1,
        ...blue,
      });
    } else {
      parts.push({
        type: 'block',
        gx: -half,
        gy: -0.1 + back,
        gz: roofZ,
        w: half,
        d: 0.2,
        h: 0.1,
        ...red,
      });
      parts.push({
        type: 'block',
        gx: 0,
        gy: -0.1 + back,
        gz: roofZ,
        w: half,
        d: 0.2,
        h: 0.1,
        ...blue,
      });
    }
    if (light !== 0) {
      // Glow.
      parts.push({
        type: 'custom',
        bounds: [],
        draw: (g, ox, oy, s) => {
          const c = project(0, 0, roofZ + 0.1, s);
          g.fillStyle(light === 1 ? PALETTE.fireRed : PALETTE.policeBlue, 0.35);
          g.fillCircle(c.x + ox, c.y + oy, 15 * s);
        },
      });
    }
  }

  if (v.robberDriver) {
    // Pickles at the wheel of his open-top getaway car: striped body + masked head.
    parts.push({
      type: 'custom',
      bounds: [
        { x: -20, y: -66 },
        { x: 20, y: -10 },
      ],
      draw: (g, ox, oy, s) => {
        const c = project(0, 0, roofZ, s);
        const x = c.x + ox;
        const y = c.y + oy;
        g.lineStyle(2 * s, PALETTE.outline, 1);
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(x - 9 * s, y - 16 * s, 18 * s, 15 * s, 5 * s);
        g.fillStyle(PALETTE.robberBlack, 1);
        g.fillRect(x - 8 * s, y - 12 * s, 16 * s, 2.5 * s);
        g.fillRect(x - 8 * s, y - 7 * s, 16 * s, 2.5 * s);
        g.strokeRoundedRect(x - 9 * s, y - 16 * s, 18 * s, 15 * s, 5 * s);
        g.fillStyle(PALETTE.skin, 1);
        g.fillCircle(x, y - 26 * s, 10 * s);
        g.fillStyle(0xd9822b, 1);
        g.slice(x, y - 26 * s, 10 * s, Math.PI * 1.05, Math.PI * 1.95, false);
        g.fillPath();
        g.strokeCircle(x, y - 26 * s, 10 * s);
        g.fillStyle(PALETTE.robberBlack, 1);
        g.fillRoundedRect(x - 9 * s, y - 29 * s, 18 * s, 6 * s, 2 * s);
        if (showsFront) {
          g.fillStyle(0xffffff, 1);
          g.fillCircle(x - 3.5 * s, y - 26 * s, 2 * s);
          g.fillCircle(x + 3.5 * s, y - 26 * s, 2 * s);
          g.lineStyle(1.5 * s, PALETTE.outline, 1);
          g.beginPath();
          g.arc(x, y - 22 * s, 3.5 * s, Math.PI * 0.1, Math.PI * 0.9, false);
          g.strokePath();
        }
      },
    });
  }

  // Wheels on the visible long side, with a spoke that turns between frames.
  parts.push({
    type: 'custom',
    bounds: [],
    draw: (g, ox, oy, s) => {
      for (const u of [L * 0.2, L * 0.8]) {
        const c = facePoint(chassis, side, u, 0.02, s);
        const x = c.x + ox;
        const y = c.y + oy;
        const r = 7.5 * s;
        g.fillStyle(0x2b2d42, 1);
        g.fillEllipse(x, y, r * 2, r * 2.1);
        g.fillStyle(0xc9ced8, 1);
        g.fillCircle(x, y, r * 0.5);
        g.lineStyle(2 * s, 0x2b2d42, 1);
        const a = wheel === 0 ? Math.PI / 4 : -Math.PI / 4;
        g.lineBetween(
          x - Math.cos(a) * r * 0.5,
          y - Math.sin(a) * r * 0.5,
          x + Math.cos(a) * r * 0.5,
          y + Math.sin(a) * r * 0.5,
        );
      }
    },
  });

  if (v.star) {
    parts.push({
      type: 'custom',
      bounds: [],
      draw: (g, ox, oy, s) => {
        const c = facePoint(chassis, side, L / 2, v.bodyH * 0.62, s);
        drawStar(g, c.x + ox, c.y + oy, (v.bodyH > 0.5 ? 13 : 7) * s, PALETTE.coinGold, 1.5 * s);
      },
    });
  }
  return parts;
}

/** Bake every frame of a vehicle look (4 facings × 2 wheel frames × light frames). */
export function bakeVehicle(scene: Phaser.Scene, v: VehicleLook): BakedMeta[] {
  const metas: BakedMeta[] = [];
  const lights: LightFrame[] = v.lightBar ? [0, 1, 2] : [0];
  for (const f of FACINGS) {
    for (const wheel of [0, 1] as const) {
      for (const light of lights) {
        const key = vehicleFrameKey(v.name, f, wheel, light);
        metas.push(bakeParts(scene, key, vehicleParts(v, f, wheel, light)));
      }
    }
  }
  return metas;
}

/** The getaway car after Pickles has hopped out. */
export const GETAWAY_EMPTY: VehicleLook = {
  ...GETAWAY_CAR,
  name: 'getaway-empty',
  robberDriver: false,
};
