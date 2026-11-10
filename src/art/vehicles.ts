import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import {
  bakeParts,
  drawOrientedBlock,
  drawOrientedWindow,
  type BakedMeta,
  type Part,
} from './blocks';
import {
  orientedAxes,
  orientedFacePoint,
  project,
  type OrientedBox,
  type OrientedSide,
} from './isoShapes';
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

/** Number of drawn headings: 8 (every 45° in grid space; 0 = +gx, down-right on screen). */
export const VEHICLE_DIRS = 8;

export function vehicleFrameKey(name: string, dir8: number, wheel: 0 | 1): string {
  return `${name}-d${dir8}-${wheel}`;
}

/** The lit light-bar overlay for a heading (light 1 = red bright, 2 = blue bright). */
export function vehicleLightKey(name: string, dir8: number, light: 1 | 2): string {
  return `${name}-d${dir8}-light${light}`;
}

/** Height of the roof (where the light bar / driver sit), in block units. */
function roofOf(v: VehicleLook): number {
  return 0.12 + v.bodyH + (v.cabin !== null ? 0.26 : 0);
}

/** The two light-bar blocks on the roof, back one first. */
function lightBar(v: VehicleLook, angle: number): { box: OrientedBox; red: boolean }[] {
  const { f, r } = orientedAxes(angle);
  const back = -0.08;
  const z = roofOf(v);
  const at = (side: number) => ({
    cx: f.x * back + r.x * side * 0.085,
    cy: f.y * back + r.y * side * 0.085,
  });
  const bars = [
    { box: { ...at(-1), halfL: 0.1, halfW: 0.08, z0: z, z1: z + 0.1, angle }, red: true },
    { box: { ...at(1), halfL: 0.1, halfW: 0.08, z0: z, z1: z + 0.1, angle }, red: false },
  ];
  return bars.sort((a, b) => a.box.cx + a.box.cy - (b.box.cx + b.box.cy));
}

function drawVehicle(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  s: number,
  v: VehicleLook,
  dir8: number,
  wheel: 0 | 1,
): void {
  const angle = (dir8 * Math.PI) / 4;
  const { f } = orientedAxes(angle);
  const L = v.length;
  const Wd = v.width;
  const z0 = 0.12;
  const zTop = z0 + v.bodyH;
  const chassis: OrientedBox = { cx: 0, cy: 0, halfL: L / 2, halfW: Wd / 2, z0, z1: zTop, angle };
  const sides = drawOrientedBlock(g, chassis, { color: v.body, bevel: 3 }, ox, oy, s);
  const bySide = (k: OrientedSide) => sides.find((fc) => fc.side === k)!;
  const longSides = [bySide('left'), bySide('right')];
  const showsFront = f.x + f.y > 1e-3;

  for (const fc of longSides) {
    if (!fc.visible) continue;
    if (v.stripe !== undefined) {
      drawOrientedWindow(
        g,
        fc,
        0.03,
        0.97,
        z0 + v.bodyH * 0.35,
        z0 + v.bodyH * 0.6,
        ox,
        oy,
        v.stripe,
        s,
        false,
      );
    }
  }
  // Head lights on the front, tail lights on the back (whichever we can see).
  for (const [k, color] of [
    ['front', 0xfff1a8],
    ['back', PALETTE.fireRed],
  ] as const) {
    const fc = bySide(k);
    if (!fc.visible) continue;
    for (const u of [0.1, 0.72]) {
      drawOrientedWindow(
        g,
        fc,
        u,
        u + 0.18,
        z0 + v.bodyH * 0.45,
        z0 + v.bodyH * 0.8,
        ox,
        oy,
        color,
        s,
        false,
      );
    }
  }

  // Wheels on the long sides we can see (or see edge-on), with a spoke that turns between frames.
  for (const fc of longSides) {
    const facing = fc.normal.x + fc.normal.y;
    if (facing < -0.05) continue;
    // Seen edge-on (heading straight up/down the screen) a wheel is a thin upright ellipse.
    const squash = 0.4 + 0.6 * Math.min(1, Math.max(0, facing));
    for (const u of [0.2, 0.8]) {
      const c = orientedFacePoint(fc, u, z0 + 0.02, s);
      const x = c.x + ox;
      const y = c.y + oy;
      const rr = 7.5 * s;
      g.fillStyle(0x2b2d42, 1);
      g.fillEllipse(x, y, rr * 2 * squash, rr * 2.1);
      g.fillStyle(0xc9ced8, 1);
      g.fillEllipse(x, y, rr * squash, rr);
      g.lineStyle(2 * s, 0x2b2d42, 1);
      const a = wheel === 0 ? Math.PI / 4 : -Math.PI / 4;
      g.lineBetween(
        x - Math.cos(a) * rr * 0.5 * squash,
        y - Math.sin(a) * rr * 0.5,
        x + Math.cos(a) * rr * 0.5 * squash,
        y + Math.sin(a) * rr * 0.5,
      );
    }
  }

  if (v.star) {
    for (const fc of longSides) {
      if (!fc.visible) continue;
      const c = orientedFacePoint(fc, 0.5, z0 + v.bodyH * 0.62, s);
      drawStar(g, c.x + ox, c.y + oy, (v.bodyH > 0.5 ? 13 : 7) * s, PALETTE.coinGold, 1.5 * s);
    }
  }

  // Cabin, a little toward the back.
  if (v.cabin !== null) {
    const cabin: OrientedBox = {
      cx: f.x * -0.08,
      cy: f.y * -0.08,
      halfL: L * 0.26,
      halfW: Wd / 2 - 0.05,
      z0: zTop,
      z1: zTop + 0.26,
      angle,
    };
    const cs = drawOrientedBlock(
      g,
      cabin,
      { color: v.body, top: lighten(v.cabin, 0.1), bevel: 3 },
      ox,
      oy,
      s,
    );
    for (const fc of cs) {
      if (!fc.visible) continue;
      drawOrientedWindow(g, fc, 0.1, 0.9, zTop + 0.06, zTop + 0.22, ox, oy, PALETTE.windowBlue, s);
    }
  }

  if (v.lightBar) {
    for (const { box, red } of lightBar(v, angle)) {
      const c = red ? PALETTE.fireRed : PALETTE.policeBlue;
      drawOrientedBlock(g, box, { color: darken(c, 0.35), bevel: 1 }, ox, oy, s);
    }
  }

  if (v.robberDriver) drawRobberDriver(g, ox, oy, s, roofOf(v), showsFront);
}

/** Pickles at the wheel of his open-top getaway car: striped body + masked head. */
function drawRobberDriver(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  s: number,
  roofZ: number,
  showsFront: boolean,
): void {
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
}

/** Every frame shares this box, so all headings and wheel frames have one size and origin. */
const FRAME_BOUNDS = [
  { x: -64, y: -96 },
  { x: 64, y: 36 },
];

function bodyParts(v: VehicleLook, dir8: number, wheel: 0 | 1): Part[] {
  return [
    { type: 'custom', bounds: FRAME_BOUNDS, draw: () => {} },
    {
      type: 'custom',
      bounds: [],
      draw: (g, ox, oy, s) => drawVehicle(g, ox, oy, s, v, dir8, wheel),
    },
  ];
}

function lightParts(v: VehicleLook, dir8: number, light: 1 | 2): Part[] {
  const angle = (dir8 * Math.PI) / 4;
  const z = roofOf(v);
  return [
    {
      type: 'custom',
      bounds: [
        { x: -34, y: -(z + 0.1) * 32 - 20 },
        { x: 34, y: -z * 32 + 20 },
      ],
      draw: (g, ox, oy, s) => {
        for (const { box, red } of lightBar(v, angle)) {
          const c = red ? PALETTE.fireRed : PALETTE.policeBlue;
          const on = (light === 1) === red;
          drawOrientedBlock(
            g,
            box,
            { color: on ? lighten(c, 0.35) : darken(c, 0.35), bevel: 1 },
            ox,
            oy,
            s,
          );
        }
        const c = project(0, 0, z + 0.1, s);
        g.fillStyle(light === 1 ? PALETTE.fireRed : PALETTE.policeBlue, 0.35);
        g.fillCircle(c.x + ox, c.y + oy, 15 * s);
      },
    },
  ];
}

/** Bake every frame of a vehicle look: 8 headings × 2 wheel frames, plus light-bar overlays. */
export function bakeVehicle(scene: Phaser.Scene, v: VehicleLook): BakedMeta[] {
  const metas: BakedMeta[] = [];
  for (let d = 0; d < VEHICLE_DIRS; d++) {
    for (const wheel of [0, 1] as const)
      metas.push(bakeParts(scene, vehicleFrameKey(v.name, d, wheel), bodyParts(v, d, wheel)));
    if (v.lightBar) {
      for (const light of [1, 2] as const)
        metas.push(bakeParts(scene, vehicleLightKey(v.name, d, light), lightParts(v, d, light)));
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
