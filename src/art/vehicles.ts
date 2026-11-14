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
import type { Vec2 } from '../iso/projection';
import { drawRiderBust, LOOKS, type CharacterLook } from './characters';
import {
  convexHull,
  orientedAxes,
  orientedFacePoint,
  project,
  type OrientedBox,
  type OrientedFace,
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
  /** Wheel radius in block units (default by size). */
  wheelR?: number;
}

export type RiderName = 'pickles' | 'smudge' | 'cop';

/** Who the riders are: the same looks as the people on foot. */
const RIDER_LOOKS: Record<RiderName, CharacterLook> = {
  pickles: LOOKS.pickles!,
  smudge: LOOKS.smudge!,
  cop: LOOKS.player!,
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
  cabinAt: -0.3,
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
  wheelR: 0.13,
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
  if (v.width < 0.4) return v.bodyH < 0.18 ? 0.3 : (v.wheelR ?? 0.2) + 0.16;
  return (v.rotor ? 0.2 : 0.12) + v.bodyH + (v.cabin !== null ? 0.26 : 0);
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

type G = Phaser.GameObjects.Graphics;

const TYRE = 0x3a3d4a;
const HUB = 0xc9ced8;
const TRIM = 0x4a4e5c;

function fillPts(g: G, pts: Vec2[], ox: number, oy: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x + ox, p.y + oy) : g.lineTo(p.x + ox, p.y + oy)));
  g.closePath();
  g.fillPath();
}

function strokePts(g: G, pts: Vec2[], ox: number, oy: number, w: number, closed = true): void {
  g.lineStyle(w, PALETTE.outline, 1);
  g.beginPath();
  pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x + ox, p.y + oy) : g.lineTo(p.x + ox, p.y + oy)));
  if (closed) g.closePath();
  g.strokePath();
}

/** Wheel radius (block units) for a look. */
function wheelR(v: VehicleLook): number {
  if (v.wheelR !== undefined) return v.wheelR;
  return v.bodyH > 0.4 ? 0.22 : 0.2;
}

/**
 * A wheel: a disc standing in the plane of travel, so it leans with the side of the car like the
 * windows do. `c` is the middle of the tyre on the ground (grid), `n` the outward direction
 * across the car. The hub and spokes show when the outer face looks at the camera.
 */
function drawWheel(
  g: G,
  ox: number,
  oy: number,
  s: number,
  c: Vec2,
  f: Vec2,
  n: Vec2,
  rz: number,
  width: number,
  spoke: 0 | 1,
): void {
  // Keep the wheel round on screen whichever way the car points (a tile is longer across the
  // screen than toward it).
  const along = project(f.x, f.y, 0, 1);
  const rt = (rz * 32 * 1.05) / Math.max(30, Math.hypot(along.x, along.y));
  const disc = (off: number, k: number, steps = 18): Vec2[] => {
    const pts: Vec2[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push(
        project(
          c.x + n.x * off + f.x * rt * k * Math.cos(a),
          c.y + n.y * off + f.y * rt * k * Math.cos(a),
          rz + rz * k * Math.sin(a),
          s,
        ),
      );
    }
    return pts;
  };
  const facing = n.x + n.y;
  const tyre = convexHull([...disc(width / 2, 1), ...disc(-width / 2, 1)]);
  fillPts(g, tyre, ox, oy, TYRE);
  strokePts(g, tyre, ox, oy, 1.6 * s);
  if (Math.abs(facing) < 0.05) return; // edge-on: just the tread
  const out = facing > 0 ? width / 2 : -width / 2;
  const face = disc(out, 1);
  strokePts(g, face, ox, oy, 1 * s);
  const rim = disc(out, 0.58);
  fillPts(g, rim, ox, oy, HUB);
  strokePts(g, rim, ox, oy, 1 * s);
  // Two spokes that turn a quarter between the two frames, and a hub cap.
  g.lineStyle(1.2 * s, PALETTE.outline, 1);
  for (const q of [0, 1]) {
    const a = (spoke * Math.PI) / 4 + (q * Math.PI) / 2;
    const tip = (sign: number) =>
      project(
        c.x + n.x * out + f.x * rt * 0.5 * Math.cos(a) * sign,
        c.y + n.y * out + f.y * rt * 0.5 * Math.cos(a) * sign,
        rz + rz * 0.5 * Math.sin(a) * sign,
        s,
      );
    const a0 = tip(1);
    const a1 = tip(-1);
    g.lineBetween(a0.x + ox, a0.y + oy, a1.x + ox, a1.y + oy);
  }
  fillPts(g, disc(out, 0.2, 10), ox, oy, PALETTE.outline);
}

/** A flat quad on an oriented face (u along it, z up), with an optional thin outline. */
function faceRect(
  g: G,
  fc: OrientedFace,
  u0: number,
  u1: number,
  z0: number,
  z1: number,
  ox: number,
  oy: number,
  s: number,
  color: number,
  line = 0,
): void {
  const pts = [
    orientedFacePoint(fc, u0, z0, s),
    orientedFacePoint(fc, u1, z0, s),
    orientedFacePoint(fc, u1, z1, s),
    orientedFacePoint(fc, u0, z1, s),
  ];
  fillPts(g, pts, ox, oy, darken(color, 0.12 * fc.shade));
  if (line > 0) strokePts(g, pts, ox, oy, line * s);
}

function faceLine(
  g: G,
  fc: OrientedFace,
  u0: number,
  z0: number,
  u1: number,
  z1: number,
  ox: number,
  oy: number,
  s: number,
  w = 1,
  color: number = PALETTE.outline,
  alpha = 0.85,
): void {
  const a = orientedFacePoint(fc, u0, z0, s);
  const b = orientedFacePoint(fc, u1, z1, s);
  g.lineStyle(w * s, color, alpha);
  g.lineBetween(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
}

interface Geo {
  angle: number;
  f: Vec2;
  r: Vec2;
  L: number;
  Wd: number;
  z0: number;
  zTop: number;
  /** The front of the vehicle looks toward the camera. */
  showsFront: boolean;
}

function geoOf(v: VehicleLook, dir8: number): Geo {
  const angle = (dir8 * Math.PI) / 4;
  const { f, r } = orientedAxes(angle);
  const z0 = v.rotor ? 0.2 : 0.12;
  return {
    angle,
    f,
    r,
    L: v.length,
    Wd: v.width,
    z0,
    zTop: z0 + v.bodyH,
    showsFront: f.x + f.y > 1e-3,
  };
}

const isBike = (v: VehicleLook) => v.width < 0.4;
/** Open-top: the rider sits in a cockpit with a little windscreen in front. */
const isOpenTop = (v: VehicleLook) => v.cabin === null && !isBike(v) && v.bodyH < 0.7;

/** Wheels of a car or truck on one side (`side` = ±1 along the across axis). */
function sideWheels(
  g: G,
  ox: number,
  oy: number,
  s: number,
  v: VehicleLook,
  q: Geo,
  side: number,
  wheel: 0 | 1,
): void {
  const n = { x: q.r.x * side, y: q.r.y * side };
  const w = 0.12;
  for (const along of [-0.3, 0.3]) {
    const c = {
      x: q.f.x * q.L * along + n.x * (q.Wd / 2 - w / 2 + 0.03),
      y: q.f.y * q.L * along + n.y * (q.Wd / 2 - w / 2 + 0.03),
    };
    drawWheel(g, ox, oy, s, c, q.f, n, wheelR(v), w, wheel);
  }
}

/** Dark arches over the wheels and a door on a long side of the chassis. */
function sideDetail(
  g: G,
  ox: number,
  oy: number,
  s: number,
  v: VehicleLook,
  q: Geo,
  fc: OrientedFace,
): void {
  const rz = wheelR(v);
  const along = project(q.f.x, q.f.y, 0, 1);
  const rt = (rz * 32 * 1.05) / Math.max(30, Math.hypot(along.x, along.y));
  // Wheel positions as u along this face (it runs the length of the vehicle, either way round).
  const flip = fc.side === 'left' ? 1 : -1;
  for (const a of [-0.3, 0.3]) {
    const u = 0.5 + a * flip;
    const ru = (rt * 1.22) / q.L;
    const pts: Vec2[] = [orientedFacePoint(fc, u - ru, q.z0, s)];
    for (let i = 0; i <= 10; i++) {
      const t = Math.PI - (i / 10) * Math.PI;
      pts.push(
        orientedFacePoint(
          fc,
          u + ru * Math.cos(t),
          Math.min(q.zTop - 0.03, rz + rz * 1.22 * Math.sin(t)),
          s,
        ),
      );
    }
    pts.push(orientedFacePoint(fc, u + ru, q.z0, s));
    fillPts(g, pts, ox, oy, darken(v.body, 0.5));
    strokePts(g, pts, ox, oy, 1 * s, false);
  }
}

/** Everything under and behind the rider: wheels, chassis, cabin, roof kit. */
function drawVehicleBase(
  g: G,
  ox: number,
  oy: number,
  s: number,
  v: VehicleLook,
  dir8: number,
  wheel: 0 | 1,
): void {
  const q = geoOf(v, dir8);
  const { f, r, L, Wd, z0, zTop, angle } = q;
  if (isBike(v)) {
    drawBikeBase(g, ox, oy, s, v, q, wheel);
    return;
  }

  // Far-side wheels first: the chassis hides all but the bottom of them. Seen dead-on from the
  // front or back, both sides count as far.
  const farSides = [-1, 1].filter((side) => (r.x + r.y) * side < 0.05);
  const nearSides = [-1, 1].filter((side) => (r.x + r.y) * side >= 0.05);
  if (v.rotor) drawSkids(g, ox, oy, s, q);
  else for (const side of farSides) sideWheels(g, ox, oy, s, v, q, side, wheel);

  const chassis: OrientedBox = { cx: 0, cy: 0, halfL: L / 2, halfW: Wd / 2, z0, z1: zTop, angle };
  const sides = drawOrientedBlock(g, chassis, { color: v.body, bevel: 3 }, ox, oy, s);
  const bySide = (k: OrientedSide) => sides.find((fc) => fc.side === k)!;
  const longSides = [bySide('left'), bySide('right')];
  const tall = v.bodyH > 0.7;

  for (const fc of longSides) {
    if (!fc.visible) continue;
    if (!v.rotor) sideDetail(g, ox, oy, s, v, q, fc);
    if (v.stripe !== undefined) {
      const zs = tall ? z0 + v.bodyH * 0.3 : z0 + v.bodyH * 0.52;
      faceRect(g, fc, 0, 1, zs, zs + (tall ? 0.14 : 0.1), ox, oy, s, v.stripe);
    }
    // Door: a seam down the middle and a handle.
    if (!v.rotor) {
      faceLine(g, fc, 0.5, z0 + 0.06, 0.5, zTop - 0.03, ox, oy, s, 1);
      const hz = z0 + v.bodyH * (tall ? 0.5 : 0.8);
      const front = fc.side === 'left' ? 1 : -1;
      faceLine(
        g,
        fc,
        0.5 + front * 0.05,
        hz,
        0.5 + front * 0.11,
        hz,
        ox,
        oy,
        s,
        1.6,
        PALETTE.outline,
        1,
      );
    }
    if (tall) {
      // Van: a side window near the front.
      const front = fc.side === 'left' ? 1 : -1;
      const u0 = 0.5 + front * 0.2;
      const u1 = 0.5 + front * 0.42;
      drawOrientedWindow(
        g,
        fc,
        Math.min(u0, u1),
        Math.max(u0, u1),
        z0 + v.bodyH * 0.58,
        zTop - 0.1,
        ox,
        oy,
        PALETTE.windowBlue,
        s,
      );
    }
    if (v.rotor) {
      // Helicopter: a round-ish side window.
      drawOrientedWindow(
        g,
        fc,
        0.25,
        0.75,
        z0 + v.bodyH * 0.4,
        zTop - 0.08,
        ox,
        oy,
        PALETTE.windowBlue,
        s,
      );
    }
  }

  // Front: bumper, grille, head lights. Back: bumper, tail lights (whichever we can see).
  for (const k of ['front', 'back'] as const) {
    const fc = bySide(k);
    if (!fc.visible) continue;
    const lz0 = z0 + v.bodyH * (tall ? 0.16 : 0.42);
    const lz1 = lz0 + (tall ? 0.16 : v.bodyH * 0.36);
    if (!v.rotor) faceRect(g, fc, 0, 1, z0, z0 + 0.07, ox, oy, s, TRIM);
    if (k === 'front' && !v.rotor) faceRect(g, fc, 0.34, 0.66, lz0, lz1, ox, oy, s, TRIM, 1);
    if (k === 'front' && v.rotor)
      drawOrientedWindow(
        g,
        fc,
        0.12,
        0.88,
        z0 + v.bodyH * 0.3,
        zTop - 0.06,
        ox,
        oy,
        PALETTE.windowBlue,
        s,
      );
    if (!v.rotor) {
      const color = k === 'front' ? 0xfff1a8 : PALETTE.fireRed;
      for (const u of [0.08, 0.74])
        drawOrientedWindow(g, fc, u, u + 0.18, lz0, lz1, ox, oy, color, s, false);
    }
    if (tall) {
      if (k === 'front')
        drawOrientedWindow(
          g,
          fc,
          0.1,
          0.9,
          z0 + v.bodyH * 0.58,
          zTop - 0.1,
          ox,
          oy,
          PALETTE.windowBlue,
          s,
        );
      else {
        // Back doors with two little windows.
        faceLine(g, fc, 0.5, z0 + 0.08, 0.5, zTop - 0.04, ox, oy, s, 1);
        for (const u of [0.14, 0.56])
          drawOrientedWindow(
            g,
            fc,
            u,
            u + 0.3,
            z0 + v.bodyH * 0.6,
            zTop - 0.12,
            ox,
            oy,
            PALETTE.windowBlue,
            s,
            false,
          );
      }
    }
  }

  if (v.star) {
    for (const fc of longSides) {
      if (!fc.visible) continue;
      const back = fc.side === 'left' ? -1 : 1;
      const c = orientedFacePoint(
        fc,
        tall ? 0.5 + back * 0.12 : 0.5 + back * 0.01,
        z0 + v.bodyH * (tall ? 0.62 : 0.58),
        s,
      );
      drawStar(g, c.x + ox, c.y + oy, (tall ? 10 : 5.5) * s, PALETTE.coinGold, 1.5 * s);
    }
  }

  if (!v.rotor) for (const side of nearSides) sideWheels(g, ox, oy, s, v, q, side, wheel);

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
      const long = fc.side === 'left' || fc.side === 'right';
      if (long && cabin.halfL > 0.28) {
        // Two side windows with a pillar between them.
        drawOrientedWindow(
          g,
          fc,
          0.08,
          0.47,
          zTop + 0.06,
          zTop + 0.22,
          ox,
          oy,
          PALETTE.windowBlue,
          s,
        );
        drawOrientedWindow(
          g,
          fc,
          0.53,
          0.92,
          zTop + 0.06,
          zTop + 0.22,
          ox,
          oy,
          PALETTE.windowBlue,
          s,
          false,
        );
      } else {
        drawOrientedWindow(
          g,
          fc,
          0.1,
          0.9,
          zTop + 0.06,
          zTop + 0.22,
          ox,
          oy,
          PALETTE.windowBlue,
          s,
        );
      }
    }
  }

  if (v.ladder) {
    // Two grey rails with rungs, lying along the back of the roof.
    const back = -L * 0.18;
    const rail = (side: number): OrientedBox => ({
      cx: f.x * back + r.x * side * 0.13,
      cy: f.y * back + r.y * side * 0.13,
      halfL: L * 0.32,
      halfW: 0.035,
      z0: zTop,
      z1: zTop + 0.12,
      angle,
    });
    // Far rail, rungs, near rail: so the rungs tuck between the rails.
    const order = [-1, 1].sort((a, b) => (r.x + r.y) * a - (r.x + r.y) * b);
    drawOrientedBlock(g, rail(order[0]!), { color: 0xc9ced8, bevel: 1 }, ox, oy, s);
    const rungs = [-2, -1, 0, 1, 2].sort((a, b) => (f.x + f.y) * a - (f.x + f.y) * b);
    for (const k of rungs) {
      const u = back + k * L * 0.12;
      const rung: OrientedBox = {
        cx: f.x * u,
        cy: f.y * u,
        halfL: 0.025,
        halfW: 0.13,
        z0: zTop + 0.06,
        z1: zTop + 0.11,
        angle,
      };
      drawOrientedBlock(g, rung, { color: 0xe4e7ee, bevel: 0, outline: 1.4 }, ox, oy, s);
    }
    drawOrientedBlock(g, rail(order[1]!), { color: 0xc9ced8, bevel: 1 }, ox, oy, s);
  }

  if (v.drum !== undefined) {
    // Mixing drum: a fat block with two stripes, and a small hopper at the very back.
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
    const hopper: OrientedBox = {
      cx: f.x * (back - L * 0.2),
      cy: f.y * (back - L * 0.2),
      halfL: L * 0.06,
      halfW: Wd / 2 - 0.2,
      z0: zTop + 0.42,
      z1: zTop + 0.54,
      angle,
    };
    const drawDrum = () => {
      const ds = drawOrientedBlock(
        g,
        drum,
        { color: 0xf4f6fa, top: 0xe4e7ee, bevel: 6 },
        ox,
        oy,
        s,
      );
      for (const fc of ds) {
        if (!fc.visible) continue;
        for (const zb of [0.08, 0.26])
          faceRect(g, fc, 0, 1, zTop + zb, zTop + zb + 0.08, ox, oy, s, v.drum!);
      }
    };
    drawDrum();
    drawOrientedBlock(g, hopper, { color: TRIM, bevel: 1 }, ox, oy, s);
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
    const fin: OrientedBox = {
      cx: -f.x * L * 1.0,
      cy: -f.y * L * 1.0,
      halfL: 0.08,
      halfW: 0.05,
      z0: z0 + v.bodyH * 0.6,
      z1: z0 + v.bodyH * 1.2,
      angle,
    };
    // When the tail points at the camera it must cover the body, so it is drawn here, after it.
    drawOrientedBlock(g, tail, { color: v.body, bevel: 1 }, ox, oy, s);
    drawOrientedBlock(g, fin, { color: PALETTE.coinGold, bevel: 1 }, ox, oy, s);
  }

  if (isOpenTop(v)) {
    // The cockpit: a dark well in the top with a seat back behind the rider.
    const well = [
      [0.2, -1],
      [0.2, 1],
      [-0.3, 1],
      [-0.3, -1],
    ].map(([a, b]) =>
      project(
        f.x * L * a! + r.x * (Wd / 2 - 0.1) * b!,
        f.y * L * a! + r.y * (Wd / 2 - 0.1) * b!,
        zTop,
        s,
      ),
    );
    fillPts(g, well, ox, oy, darken(v.body, 0.45));
    strokePts(g, well, ox, oy, 1.2 * s);
    if (q.showsFront)
      drawOrientedBlock(g, seatBack(q), { color: darken(v.body, 0.25), bevel: 1 }, ox, oy, s);
    else drawWindscreen(g, ox, oy, s, q);
  }
}

function seatBack(q: Geo): OrientedBox {
  return {
    cx: -q.f.x * q.L * 0.27,
    cy: -q.f.y * q.L * 0.27,
    halfL: 0.03,
    halfW: q.Wd / 2 - 0.12,
    z0: q.zTop,
    z1: q.zTop + 0.16,
    angle: q.angle,
  };
}

function drawWindscreen(g: G, ox: number, oy: number, s: number, q: Geo): void {
  const box: OrientedBox = {
    cx: q.f.x * q.L * 0.2,
    cy: q.f.y * q.L * 0.2,
    halfL: 0.02,
    halfW: q.Wd / 2 - 0.1,
    z0: q.zTop,
    z1: q.zTop + 0.2,
    angle: q.angle,
  };
  drawOrientedBlock(
    g,
    box,
    { color: PALETTE.windowBlue, top: lighten(PALETTE.windowBlue, 0.3), bevel: 0 },
    ox,
    oy,
    s,
  );
}

/** Things that sit in front of the rider (drawn after them). */
function drawVehicleFront(
  g: G,
  ox: number,
  oy: number,
  s: number,
  v: VehicleLook,
  dir8: number,
  wheel: 0 | 1,
): void {
  const q = geoOf(v, dir8);
  if (isBike(v)) {
    if (q.showsFront) drawHandlebars(g, ox, oy, s, v, q);
    return;
  }
  if (isOpenTop(v)) {
    if (q.showsFront) drawWindscreen(g, ox, oy, s, q);
    else drawOrientedBlock(g, seatBack(q), { color: darken(v.body, 0.25), bevel: 1 }, ox, oy, s);
  }
  if (v.rotor) {
    // Mast, then two blades crossing, turned 45° between the two frames so the rotor spins.
    const rz = roofOf(v) + 0.34;
    const mast: OrientedBox = {
      cx: 0,
      cy: 0,
      halfL: 0.04,
      halfW: 0.04,
      z0: q.zTop,
      z1: rz,
      angle: q.angle,
    };
    drawOrientedBlock(g, mast, { color: TRIM, bevel: 0, outline: 1.4 }, ox, oy, s);
    for (const k of [0, 1]) {
      const blade: OrientedBox = {
        cx: 0,
        cy: 0,
        halfL: 0.95,
        halfW: 0.05,
        z0: rz,
        z1: rz + 0.04,
        angle: q.angle + (wheel === 0 ? 0 : Math.PI / 4) + (k * Math.PI) / 2,
      };
      drawOrientedBlock(g, blade, { color: 0x5a5f6b, bevel: 0, outline: 1.4 }, ox, oy, s);
    }
    const hub: OrientedBox = {
      cx: 0,
      cy: 0,
      halfL: 0.08,
      halfW: 0.08,
      z0: rz + 0.04,
      z1: rz + 0.1,
      angle: q.angle,
    };
    drawOrientedBlock(g, hub, { color: PALETTE.coinGold, bevel: 1, outline: 1.4 }, ox, oy, s);
  }
}

/** Helicopter landing skids: two rails under the body on short struts. */
function drawSkids(g: G, ox: number, oy: number, s: number, q: Geo): void {
  const order = [-1, 1].sort((a, b) => (q.r.x + q.r.y) * a - (q.r.x + q.r.y) * b);
  for (const side of order) {
    const at = (along: number) => ({
      cx: q.f.x * q.L * along + q.r.x * side * (q.Wd / 2 - 0.06),
      cy: q.f.y * q.L * along + q.r.y * side * (q.Wd / 2 - 0.06),
    });
    for (const along of [-0.25, 0.25])
      drawOrientedBlock(
        g,
        { ...at(along), halfL: 0.03, halfW: 0.03, z0: 0.05, z1: q.z0 + 0.02, angle: q.angle },
        { color: TRIM, bevel: 0, outline: 1.4 },
        ox,
        oy,
        s,
      );
    drawOrientedBlock(
      g,
      { ...at(0), halfL: q.L * 0.55, halfW: 0.035, z0: 0, z1: 0.06, angle: q.angle },
      { color: TRIM, bevel: 0, outline: 1.6 },
      ox,
      oy,
      s,
    );
  }
}

/** Two wheels in line, a slim frame, a seat (and a light rack on the police bike). */
function drawBikeBase(
  g: G,
  ox: number,
  oy: number,
  s: number,
  v: VehicleLook,
  q: Geo,
  wheel: 0 | 1,
): void {
  const { f, r, L, angle } = q;
  const rz = wheelR(v);
  // The wheel's face looks toward whichever side the camera sees.
  const side = r.x + r.y >= 0 ? 1 : -1;
  const n = { x: r.x * side, y: r.y * side };
  const wheels = [-0.36, 0.36].sort((a, b) => (f.x + f.y) * a - (f.x + f.y) * b);
  const scooter = v.bodyH < 0.18;
  const frame: OrientedBox = {
    cx: 0,
    cy: 0,
    halfL: L * (scooter ? 0.34 : 0.3),
    halfW: scooter ? 0.09 : 0.06,
    z0: scooter ? rz * 0.9 : rz * 1.0,
    z1: scooter ? rz * 0.9 + 0.07 : rz + 0.16,
    angle,
  };
  drawWheel(
    g,
    ox,
    oy,
    s,
    { x: f.x * L * wheels[0]!, y: f.y * L * wheels[0]! },
    f,
    n,
    rz,
    0.08,
    wheel,
  );
  drawOrientedBlock(g, frame, { color: v.body, bevel: 1 }, ox, oy, s);
  drawWheel(
    g,
    ox,
    oy,
    s,
    { x: f.x * L * wheels[1]!, y: f.y * L * wheels[1]! },
    f,
    n,
    rz,
    0.08,
    wheel,
  );
  if (!scooter) {
    // Seat, toward the back.
    drawOrientedBlock(
      g,
      {
        cx: -f.x * L * 0.12,
        cy: -f.y * L * 0.12,
        halfL: L * 0.16,
        halfW: 0.075,
        z0: frame.z1,
        z1: frame.z1 + 0.06,
        angle,
      },
      { color: 0x2b2d42, top: 0x4a4e5c, bevel: 1, outline: 1.4 },
      ox,
      oy,
      s,
    );
  }
  if (v.lightBar) {
    for (const { box, red } of lightBar(v, angle)) {
      const c = red ? PALETTE.fireRed : PALETTE.policeBlue;
      drawOrientedBlock(g, box, { color: darken(c, 0.35), bevel: 1 }, ox, oy, s);
    }
  }
  if (!q.showsFront) drawHandlebars(g, ox, oy, s, v, q);
}

/** The steering post and handlebars of a bike or scooter (with a head light). */
function drawHandlebars(g: G, ox: number, oy: number, s: number, v: VehicleLook, q: Geo): void {
  const { f, L, angle } = q;
  const scooter = v.bodyH < 0.18;
  const top = scooter ? 0.62 : 0.56;
  const at = { cx: f.x * L * 0.34, cy: f.y * L * 0.34 };
  drawOrientedBlock(
    g,
    { ...at, halfL: 0.03, halfW: 0.03, z0: wheelR(v) * 1.2, z1: top, angle },
    { color: scooter ? v.body : TRIM, bevel: 0, outline: 1.4 },
    ox,
    oy,
    s,
  );
  drawOrientedBlock(
    g,
    { ...at, halfL: 0.035, halfW: 0.17, z0: top, z1: top + 0.06, angle },
    { color: 0x2b2d42, top: 0x4a4e5c, bevel: 0, outline: 1.4 },
    ox,
    oy,
    s,
  );
  if (!scooter && q.showsFront) {
    const c = project(f.x * (L * 0.34 + 0.05), f.y * (L * 0.34 + 0.05), top - 0.1, s);
    g.fillStyle(0xfff1a8, 1);
    g.fillCircle(c.x + ox, c.y + oy, 2.6 * s);
    g.lineStyle(1.2 * s, PALETTE.outline, 1);
    g.strokeCircle(c.x + ox, c.y + oy, 2.6 * s);
  }
}

/** Where the rider's seat is (block units above the ground). */
function seatZ(v: VehicleLook): number {
  if (isBike(v)) return v.bodyH < 0.18 ? wheelR(v) * 0.9 + 0.3 : wheelR(v) + 0.22 + 0.1;
  return roofOf(v) - 0.1;
}

/** Every frame shares this box, so all headings and wheel frames have one size and origin. */
const FRAME_BOUNDS = [
  { x: -64, y: -96 },
  { x: 64, y: 36 },
];

function bodyParts(v: VehicleLook, dir8: number, wheel: 0 | 1): Part[] {
  const parts: Part[] = [
    { type: 'custom', bounds: FRAME_BOUNDS, draw: () => {} },
    {
      type: 'custom',
      bounds: [],
      draw: (g, ox, oy, s) => drawVehicleBase(g, ox, oy, s, v, dir8, wheel),
    },
  ];
  if (v.rider) {
    const q = geoOf(v, dir8);
    const look = RIDER_LOOKS[v.rider];
    const sx = q.f.x - q.f.y;
    parts.push({
      type: 'canvas',
      bounds: [],
      draw: (ctx, ox, oy, s) => {
        const c = project(0, 0, seatZ(v), s);
        // Riders are a little smaller than people on foot, so the vehicle stays the star.
        drawRiderBust(
          ctx,
          look,
          c.x + ox,
          c.y + oy,
          s * 0.8,
          q.showsFront,
          sx >= 0 ? 1 : -1,
          isBike(v),
        );
      },
    });
  }
  parts.push({
    type: 'custom',
    bounds: [],
    draw: (g, ox, oy, s) => drawVehicleFront(g, ox, oy, s, v, dir8, wheel),
  });
  return parts;
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
