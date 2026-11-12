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
  /** Who sits on top in the open (robbers in open-top cars, anyone riding a bike/scooter). */
  rider?: RiderName;
  stripe?: number;
  /** Where the cabin sits along the length (− = back, + = front). Default −0.08. */
  cabinAt?: number;
  /** Cabin length as a share of the vehicle length (default 0.52). */
  cabinLen?: number;
  /** A fire ladder lying along the roof (fire truck). */
  ladder?: boolean;
  /** A big striped mixing drum on the back (cement mixer). */
  drum?: number;
  /** A helicopter: tail boom and a rotor that turns between wheel frames (spec 007). */
  rotor?: boolean;
}

export type RiderName = 'pickles' | 'smudge' | 'cop';

interface RiderStyle {
  shirt: number;
  stripes: boolean;
  mask: boolean;
  hair: number;
  cap: boolean;
}

const RIDERS: Record<RiderName, RiderStyle> = {
  pickles: { shirt: 0xffffff, stripes: true, mask: true, hair: 0xd9822b, cap: false },
  smudge: { shirt: 0xffffff, stripes: true, mask: true, hair: 0x2b1d14, cap: false },
  cop: { shirt: PALETTE.policeBlue, stripes: false, mask: false, hair: 0x6b4226, cap: true },
};

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
  rider: 'pickles',
};

/** Smudge's getaway car (Double Trouble): same wobbly car, teal, with Smudge at the wheel. */
export const GETAWAY_CAR_2: VehicleLook = {
  ...GETAWAY_CAR,
  name: 'getaway-car-2',
  body: PALETTE.harborTeal,
  rider: 'smudge',
};

/** The police bike (spec 003): narrow, quick, with a little light bar on the back rack. */
export const POLICE_BIKE: VehicleLook = {
  name: 'police-bike',
  body: PALETTE.policeBlue,
  cabin: null,
  length: 0.9,
  width: 0.22,
  bodyH: 0.2,
  lightBar: true,
  star: false,
};
export const POLICE_BIKE_RIDDEN: VehicleLook = {
  ...POLICE_BIKE,
  name: 'police-bike-ridden',
  rider: 'cop',
};

/** Smudge's purple scooter (Rooftop Run). */
export const SCOOTER: VehicleLook = {
  name: 'scooter',
  body: PALETTE.getawayPurple,
  cabin: null,
  length: 0.85,
  width: 0.24,
  bodyH: 0.14,
  lightBar: false,
  star: false,
  rider: 'smudge',
};
export const SCOOTER_EMPTY: VehicleLook = { ...SCOOTER, name: 'scooter-empty', rider: undefined };

/** Ambient traffic cars: plain, friendly colours. */
export const TRAFFIC_CARS: VehicleLook[] = [
  PALETTE.fireRed,
  PALETTE.builderYellow,
  PALETTE.harborTeal,
].map((body, i) => ({
  name: `traffic-${i}`,
  body,
  cabin: lighten(body, 0.3),
  length: 1.2,
  width: 0.7,
  bodyH: 0.36,
  lightBar: false,
  star: false,
}));

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
  const back = v.cabinAt ?? -0.08;
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
    const at = v.cabinAt ?? -0.08;
    const cabin: OrientedBox = {
      cx: f.x * at,
      cy: f.y * at,
      halfL: (L * (v.cabinLen ?? 0.52)) / 2,
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

  if (v.ladder) {
    // Two grey rails with rungs, lying along the back of the roof.
    const { r } = orientedAxes(angle);
    const back = -L * 0.18;
    for (const side of [-1, 1]) {
      const rail: OrientedBox = {
        cx: f.x * back + r.x * side * 0.13,
        cy: f.y * back + r.y * side * 0.13,
        halfL: L * 0.32,
        halfW: 0.035,
        z0: zTop,
        z1: zTop + 0.12,
        angle,
      };
      drawOrientedBlock(g, rail, { color: 0xc9ced8, bevel: 1 }, ox, oy, s);
    }
    for (let k = -2; k <= 2; k++) {
      const u = back + k * L * 0.12;
      const rung: OrientedBox = {
        cx: f.x * u,
        cy: f.y * u,
        halfL: 0.025,
        halfW: 0.13,
        z0: zTop + 0.08,
        z1: zTop + 0.12,
        angle,
      };
      drawOrientedBlock(g, rung, { color: 0xe4e7ee, bevel: 0 }, ox, oy, s);
    }
  }

  if (v.drum !== undefined) {
    // Mixing drum: a stack of boxes that read as a fat barrel, with a stripe.
    const back = -L * 0.2;
    const drum: OrientedBox = {
      cx: f.x * back,
      cy: f.y * back,
      halfL: L * 0.26,
      halfW: Wd / 2 - 0.08,
      z0: zTop,
      z1: zTop + 0.42,
      angle,
    };
    const ds = drawOrientedBlock(g, drum, { color: 0xf4f6fa, top: 0xe4e7ee, bevel: 6 }, ox, oy, s);
    for (const fc of ds) {
      if (!fc.visible) continue;
      drawOrientedWindow(g, fc, 0.1, 0.9, zTop + 0.14, zTop + 0.26, ox, oy, v.drum, s, false);
    }
  }

  if (v.lightBar) {
    for (const { box, red } of lightBar(v, angle)) {
      const c = red ? PALETTE.fireRed : PALETTE.policeBlue;
      drawOrientedBlock(g, box, { color: darken(c, 0.35), bevel: 1 }, ox, oy, s);
    }
  }

  if (v.rotor) {
    // Tail boom behind, with a little fin.
    const tail: OrientedBox = {
      cx: -f.x * L * 0.75,
      cy: -f.y * L * 0.75,
      halfL: L * 0.32,
      halfW: 0.07,
      z0: z0 + v.bodyH * 0.5,
      z1: z0 + v.bodyH * 0.75,
      angle,
    };
    drawOrientedBlock(g, tail, { color: v.body, bevel: 1 }, ox, oy, s);
    const fin: OrientedBox = {
      cx: -f.x * L * 1.0,
      cy: -f.y * L * 1.0,
      halfL: 0.08,
      halfW: 0.05,
      z0: z0 + v.bodyH * 0.6,
      z1: z0 + v.bodyH * 1.2,
      angle,
    };
    drawOrientedBlock(g, fin, { color: PALETTE.coinGold, bevel: 1 }, ox, oy, s);
    // Rotor: two blades crossing, turned 45° between the two frames so it spins.
    const rz = roofOf(v) + 0.32;
    for (const k of [0, 1]) {
      const blade: OrientedBox = {
        cx: 0,
        cy: 0,
        halfL: 0.95,
        halfW: 0.05,
        z0: rz,
        z1: rz + 0.04,
        angle: angle + (wheel === 0 ? 0 : Math.PI / 4) + (k * Math.PI) / 2,
      };
      drawOrientedBlock(g, blade, { color: 0x3a3d4a, bevel: 0 }, ox, oy, s);
    }
  }

  if (v.rider)
    drawRider(g, ox, oy, s, roofOf(v) - (v.width < 0.4 ? 0.02 : 0), showsFront, RIDERS[v.rider]);
}

/** Someone sitting on top in the open: a Bandit Brother (stripes + mask) or a cop with a cap. */
function drawRider(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  s: number,
  roofZ: number,
  showsFront: boolean,
  r: RiderStyle,
): void {
  const c = project(0, 0, roofZ, s);
  const x = c.x + ox;
  const y = c.y + oy;
  g.lineStyle(2 * s, PALETTE.outline, 1);
  g.fillStyle(r.shirt, 1);
  g.fillRoundedRect(x - 9 * s, y - 16 * s, 18 * s, 15 * s, 5 * s);
  if (r.stripes) {
    g.fillStyle(PALETTE.robberBlack, 1);
    g.fillRect(x - 8 * s, y - 12 * s, 16 * s, 2.5 * s);
    g.fillRect(x - 8 * s, y - 7 * s, 16 * s, 2.5 * s);
  }
  g.strokeRoundedRect(x - 9 * s, y - 16 * s, 18 * s, 15 * s, 5 * s);
  g.fillStyle(PALETTE.skin, 1);
  g.fillCircle(x, y - 26 * s, 10 * s);
  g.fillStyle(r.hair, 1);
  g.slice(x, y - 26 * s, 10 * s, Math.PI * 1.05, Math.PI * 1.95, false);
  g.fillPath();
  g.strokeCircle(x, y - 26 * s, 10 * s);
  if (r.mask) {
    g.fillStyle(PALETTE.robberBlack, 1);
    g.fillRoundedRect(x - 9 * s, y - 29 * s, 18 * s, 6 * s, 2 * s);
  }
  if (r.cap) {
    g.fillStyle(PALETTE.policeBlue, 1);
    g.fillRoundedRect(x - 10 * s, y - 38 * s, 20 * s, 9 * s, 4 * s);
    g.strokeRoundedRect(x - 10 * s, y - 38 * s, 20 * s, 9 * s, 4 * s);
    g.fillStyle(PALETTE.outline, 1);
    g.fillRect(x - 11 * s, y - 30 * s, 22 * s, 3 * s);
    drawStar(g, x, y - 34 * s, 3 * s, PALETTE.coinGold, 1 * s);
  }
  if (showsFront) {
    g.fillStyle(r.mask ? 0xffffff : PALETTE.outline, 1);
    g.fillCircle(x - 3.5 * s, y - 26 * s, (r.mask ? 2 : 1.6) * s);
    g.fillCircle(x + 3.5 * s, y - 26 * s, (r.mask ? 2 : 1.6) * s);
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
        { x: -54, y: -(z + 0.1) * 32 - 34 },
        { x: 54, y: -z * 32 + 34 },
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
        const { f } = orientedAxes(angle);
        const at = v.cabinAt ?? 0;
        const c = project(f.x * at, f.y * at, z + 0.1, s);
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
  rider: undefined,
};
export const GETAWAY_EMPTY_2: VehicleLook = {
  ...GETAWAY_CAR_2,
  name: 'getaway-empty-2',
  rider: undefined,
};

/** The fire truck (spec 004): long, red, cabin at the front, ladder on the back. */
export const FIRE_TRUCK: VehicleLook = {
  name: 'fire-truck',
  body: PALETTE.fireRed,
  cabin: PALETTE.fireRed,
  length: 1.6,
  width: 0.78,
  bodyH: 0.42,
  lightBar: true,
  star: false,
  stripe: 0xffffff,
  cabinAt: 0.42,
  cabinLen: 0.32,
  ladder: true,
};

/** The cement mixer (spec 005): yellow, cabin in front, a striped drum on the back. */
export const MIXER_TRUCK: VehicleLook = {
  name: 'mixer-truck',
  body: PALETTE.builderYellow,
  cabin: PALETTE.builderYellow,
  length: 1.5,
  width: 0.78,
  bodyH: 0.38,
  lightBar: false,
  star: false,
  cabinAt: 0.42,
  cabinLen: 0.3,
  drum: PALETTE.coneOrange,
};

/** Your own car (spec 006): small and round. Paint ids → body colour. */
export const PAINTS: Record<string, number> = {
  'paint-red': PALETTE.fireRed,
  'paint-teal': PALETTE.harborTeal,
  'paint-purple': PALETTE.getawayPurple,
  'paint-pink': PALETTE.donutPink,
};
export const ownCarName = (paint: string | null) => (paint ? `own-car-${paint}` : 'own-car');
export const OWN_CARS: VehicleLook[] = [null, ...Object.keys(PAINTS)].map((paint) => ({
  name: ownCarName(paint),
  body: paint ? PAINTS[paint]! : PALETTE.buildingWhite,
  cabin: paint ? lighten(PAINTS[paint]!, 0.25) : PALETTE.windowBlue,
  length: 1.1,
  width: 0.7,
  bodyH: 0.34,
  lightBar: false,
  star: false,
  cabinLen: 0.6,
}));

/** The Bandit Brothers' getaway helicopter (spec 007 finale). */
export const HELICOPTER: VehicleLook = {
  name: 'helicopter',
  body: PALETTE.getawayPurple,
  cabin: null,
  length: 0.9,
  width: 0.7,
  bodyH: 0.5,
  lightBar: false,
  star: false,
  rider: 'pickles',
  rotor: true,
};
export const HELICOPTER_EMPTY: VehicleLook = {
  ...HELICOPTER,
  name: 'helicopter-empty',
  rider: undefined,
};

/** Every vehicle look baked at boot. */
export const ALL_VEHICLES: VehicleLook[] = [
  POLICE_CAR,
  GETAWAY_CAR,
  GETAWAY_EMPTY,
  GETAWAY_CAR_2,
  GETAWAY_EMPTY_2,
  POLICE_VAN,
  POLICE_BIKE,
  POLICE_BIKE_RIDDEN,
  SCOOTER,
  SCOOTER_EMPTY,
  FIRE_TRUCK,
  MIXER_TRUCK,
  ...OWN_CARS,
  HELICOPTER,
  HELICOPTER_EMPTY,
  ...TRAFFIC_CARS,
];
