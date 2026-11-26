import type Phaser from 'phaser';
import { PALETTE } from '../config';
import type { BuildingDef } from '../content/schema';
import type { Vec2 } from '../iso/projection';
import { darken, lighten } from './color';
import type { Part } from './blocks';
import { facePoint, project, type BlockGeom } from './isoShapes';
import { drawIcon, type IconName } from './icons';

/**
 * Parkside's buildings (spec 010): family homes, the school, the playground, the community
 * garden and the shop street. Same look rules as the rest of the city: flat-topped blocks, three
 * shaded faces, the 2 px outline, nothing sticking outside its footprint.
 */

type G = Phaser.GameObjects.Graphics;
const OL = PALETTE.outline;
const WHITE = PALETTE.buildingWhite;
const STEP = 0xd9dce3;
const WOOD = 0xb9834d;
const SOIL = 0x6b4a2f;
const BRICK = 0xc96f4a;

type Face = 'left' | 'right';

/** Evenly spaced windows along one face of a block (one per tile), between heights z0 and z1. */
function windowRow(
  body: BlockGeom,
  face: Face,
  z0: number,
  z1: number,
  opts: { width?: number; skip?: (k: number) => boolean } = {},
): Part[] {
  const span = face === 'left' ? body.w : body.d;
  const n = Math.max(1, Math.round(span));
  const half = (opts.width ?? 0.56) / 2;
  const parts: Part[] = [];
  for (let k = 0; k < n; k++) {
    if (opts.skip?.(k)) continue;
    const c = ((k + 0.5) * span) / n;
    parts.push({ type: 'window', block: body, face, u0: c - half, u1: c + half, z0, z1 });
  }
  return parts;
}

/** The middle of the first window slot on the left face (where a door goes). */
function firstSlot(body: BlockGeom): number {
  return (0.5 * body.w) / Math.max(1, Math.round(body.w));
}

function custom(bounds: Vec2[], draw: (g: G, ox: number, oy: number, s: number) => void): Part {
  return { type: 'custom', bounds, draw };
}

/** A thick coloured rod with the outline round it, between two grid points (x, y, z). */
function rod(
  g: G,
  ox: number,
  oy: number,
  s: number,
  a: [number, number, number],
  b: [number, number, number],
  w: number,
  color: number,
): void {
  const p = project(a[0], a[1], a[2], s);
  const q = project(b[0], b[1], b[2], s);
  g.lineStyle((w + 3) * s, OL, 1);
  g.lineBetween(p.x + ox, p.y + oy, q.x + ox, q.y + oy);
  g.lineStyle(w * s, color, 1);
  g.lineBetween(p.x + ox, p.y + oy, q.x + ox, q.y + oy);
}

/** A sign on a short pole above the middle of the roof: a white plate with a picture. */
function roofSign(b: BuildingDef, icon: IconName, plate: boolean): Part {
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  return custom(
    [
      { x: top.x - 34, y: top.y - 72 },
      { x: top.x + 34, y: top.y + 4 },
    ],
    (g, ox, oy, s) => {
      const c = project(b.w / 2, b.d / 2, b.h, s);
      const x = c.x + ox;
      const y = c.y + oy;
      g.lineStyle(4 * s, OL, 1);
      g.lineBetween(x, y, x, y - 22 * s);
      if (plate) {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x, y - 40 * s, 21 * s);
        g.lineStyle(3 * s, OL, 1);
        g.strokeCircle(x, y - 40 * s, 21 * s);
        g.lineStyle(2 * s, PALETTE[b.color], 1);
        g.strokeCircle(x, y - 40 * s, 17.5 * s);
        drawIcon(g, icon, x, y - 40 * s, 13 * s, s * 0.8);
      } else drawIcon(g, icon, x, y - 42 * s, 24 * s, s);
    },
  );
}

/** A striped awning over the shop front, fixed to the wall and sloping out and down. */
function awning(body: BlockGeom, d: number, color: number): Part {
  return custom([], (g, ox, oy, s) => {
    const hi = (u: number) => facePoint(body, 'left', u, 1.0, s);
    const lo = (u: number) => project(u, d, 0.82, s);
    const n = Math.round(body.w * 4);
    const pts = (a: Vec2, b: Vec2, c: Vec2, e: Vec2) =>
      [a, b, c, e].map((p) => ({ x: p.x + ox, y: p.y + oy }));
    for (let i = 0; i < n; i++) {
      const u0 = 0.06 + (i / n) * (body.w - 0.12);
      const u1 = 0.06 + ((i + 1) / n) * (body.w - 0.12);
      g.fillStyle(i % 2 ? 0xffffff : color, 1);
      g.fillPoints(pts(hi(u0), hi(u1), lo(u1), lo(u0)), true);
    }
    g.lineStyle(2 * s, OL, 1);
    g.strokePoints(pts(hi(0.06), hi(body.w - 0.06), lo(body.w - 0.06), lo(0.06)), true);
  });
}

/**
 * A family home: two floors, a door with a little porch roof and a step, a roof that overhangs
 * on every side, and a brick chimney at the back.
 */
export function homeParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const bodyH = Math.min(1.75, b.h - 0.45);
  const body: BlockGeom = { w: b.w, d: b.d - 0.22, h: bodyH };
  const door = firstSlot(body);
  return [
    { type: 'block', ...body, color: WHITE },
    {
      type: 'window',
      block: body,
      face: 'left',
      u0: door - 0.21,
      u1: door + 0.21,
      z0: 0,
      z1: 0.66,
      color: accent,
      door: true,
    },
    ...windowRow(body, 'left', 0.26, 0.68, { skip: (k) => k === 0 }),
    ...windowRow(body, 'right', 0.26, 0.68),
    ...windowRow(body, 'left', 1.0, 1.44),
    ...windowRow(body, 'right', 1.0, 1.44),
    // Window boxes under the ground-floor windows on the front.
    ...windowRow(body, 'left', 0, 0, { skip: (k) => k === 0 }).map((p): Part => {
      const w = p as Extract<Part, { type: 'window' }>;
      return {
        type: 'block',
        gx: w.u0 - 0.04,
        gy: body.d,
        gz: 0.14,
        w: w.u1 - w.u0 + 0.08,
        d: 0.12,
        h: 0.1,
        color: accent,
        bevel: 1,
        outline: 1.5,
      };
    }),
    {
      type: 'block',
      gx: door - 0.36,
      gy: body.d,
      gz: 0.74,
      w: 0.72,
      d: 0.2,
      h: 0.07,
      color: accent,
    },
    {
      type: 'block',
      gx: door - 0.33,
      gy: body.d,
      w: 0.66,
      d: 0.18,
      h: 0.05,
      color: STEP,
      bevel: 1,
    },
    {
      type: 'block',
      gx: -0.1,
      gy: -0.1,
      gz: bodyH,
      w: b.w + 0.2,
      d: body.d + 0.2,
      h: 0.22,
      color: accent,
      bevel: 3,
    },
    {
      type: 'block',
      gx: b.w - 0.62,
      gy: 0.2,
      gz: bodyH + 0.22,
      w: 0.3,
      d: 0.3,
      h: 0.36,
      color: BRICK,
      bevel: 2,
    },
    {
      type: 'block',
      gx: b.w - 0.66,
      gy: 0.16,
      gz: bodyH + 0.58,
      w: 0.38,
      d: 0.38,
      h: 0.07,
      color: darken(BRICK, 0.35),
      bevel: 1,
    },
  ];
}

/** A little shop: a door, a big display window, an awning, and a sign on the roof. */
function shopFront(b: BuildingDef, icon: IconName, plate: boolean): Part[] {
  const accent = PALETTE[b.color];
  const roofH = 0.28;
  const body: BlockGeom = { w: b.w, d: b.d - 0.25, h: b.h - roofH };
  const door = firstSlot(body);
  return [
    { type: 'block', ...body, color: WHITE },
    {
      type: 'window',
      block: body,
      face: 'left',
      u0: door - 0.2,
      u1: door + 0.2,
      z0: 0,
      z1: 0.68,
      color: accent,
      door: true,
    },
    {
      type: 'window',
      block: body,
      face: 'left',
      u0: door + 0.4,
      u1: b.w - 0.18,
      z0: 0.18,
      z1: 0.74,
    },
    ...windowRow(body, 'right', 0.24, 0.7),
    ...windowRow(body, 'left', 1.06, 1.46),
    ...windowRow(body, 'right', 1.06, 1.46),
    awning(body, b.d - 0.02, accent),
    {
      type: 'block',
      gx: -0.06,
      gy: -0.06,
      gz: body.h,
      w: b.w + 0.12,
      d: body.d + 0.12,
      h: roofH,
      color: accent,
      bevel: 3,
    },
    roofSign(b, icon, plate),
  ];
}

/** The ice cream shop: a giant cone on the roof. */
export function iceCreamParts(b: BuildingDef): Part[] {
  return shopFront(b, 'iceCream', false);
}

/** The pet shop: a puppy on a round sign. */
export function petShopParts(b: BuildingDef): Part[] {
  return shopFront(b, 'puppy', true);
}

/** The library: a porch of white columns on steps, a deep roof, and a book sign. */
export function libraryParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const porch = 0.55;
  const colH = 1.8;
  const body: BlockGeom = { w: b.w, d: b.d - porch, h: colH };
  const parts: Part[] = [
    { type: 'block', ...body, color: WHITE },
    {
      type: 'window',
      block: body,
      face: 'left',
      u0: b.w / 2 - 0.28,
      u1: b.w / 2 + 0.28,
      z0: 0.12,
      z1: 0.98,
      color: accent,
      door: true,
    },
    ...windowRow(body, 'right', 0.3, 0.86, { width: 0.42 }),
    ...windowRow(body, 'right', 1.1, 1.55, { width: 0.42 }),
    ...windowRow(body, 'left', 1.12, 1.56, { width: 0.4 }),
    // Steps, then the columns standing on them.
    { type: 'block', gx: 0, gy: body.d, w: b.w, d: porch, h: 0.07, color: STEP, bevel: 1 },
    {
      type: 'block',
      gx: 0.08,
      gy: body.d,
      gz: 0.07,
      w: b.w - 0.16,
      d: porch - 0.1,
      h: 0.06,
      color: STEP,
      bevel: 1,
    },
  ];
  const n = Math.max(3, Math.round(b.w * 1.5));
  for (let i = 0; i < n; i++) {
    const x = 0.14 + (i * (b.w - 0.42)) / (n - 1);
    parts.push({
      type: 'block',
      gx: x,
      gy: body.d + porch - 0.34,
      gz: 0.13,
      w: 0.14,
      d: 0.14,
      h: colH - 0.13,
      color: 0xeef0f5,
      bevel: 1,
      outline: 1.5,
    });
  }
  parts.push(
    {
      type: 'block',
      gx: -0.08,
      gy: -0.08,
      gz: colH,
      w: b.w + 0.16,
      d: b.d + 0.06,
      h: 0.16,
      color: WHITE,
      bevel: 2,
    },
    {
      type: 'block',
      gx: -0.02,
      gy: -0.02,
      gz: colH + 0.16,
      w: b.w + 0.04,
      d: b.d - 0.06,
      h: 0.2,
      color: accent,
      bevel: 3,
    },
    roofSign({ ...b, h: colH + 0.36, d: b.d - 0.08 }, 'book', true),
  );
  return parts;
}

/**
 * The school: two floors of big windows, a double door under a canopy, a rainbow band under the
 * roof, and a bell tower with a clock and a flag.
 */
export function schoolParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const bodyH = 2.0;
  const roofH = 0.24;
  const body: BlockGeom = { w: b.w, d: b.d - 0.25, h: bodyH };
  const mid = b.w / 2;
  const n = Math.round(b.w);
  const middle = (k: number) => Math.abs((k + 0.5) * (b.w / n) - mid) < 0.6;
  const roofTop = bodyH + roofH;
  const tw = 0.86;
  const tx = mid - tw / 2;
  const ty = body.d / 2 - tw / 2;
  const baseTop = roofTop + 0.5;
  const capTop = baseTop + 0.46 + 0.12;
  const rainbow = [PALETTE.fireRed, PALETTE.coinGold, PALETTE.grass, PALETTE.policeBlue];
  const post = (i: number, j: number): Part => ({
    type: 'block',
    gx: tx + 0.04 + i * (tw - 0.2),
    gy: ty + 0.04 + j * (tw - 0.2),
    gz: baseTop,
    w: 0.12,
    d: 0.12,
    h: 0.46,
    color: WHITE,
    bevel: 1,
    outline: 1.5,
  });
  const flagAt = project(mid, body.d / 2, capTop, 1);
  return [
    { type: 'block', ...body, color: WHITE },
    {
      type: 'window',
      block: body,
      face: 'left',
      u0: mid - 0.42,
      u1: mid + 0.42,
      z0: 0,
      z1: 0.78,
      color: accent,
      door: true,
    },
    ...windowRow(body, 'left', 0.28, 0.82, { width: 0.62, skip: middle }),
    ...windowRow(body, 'left', 1.1, 1.64, { width: 0.62 }),
    ...windowRow(body, 'right', 0.28, 0.82, { width: 0.62 }),
    ...windowRow(body, 'right', 1.1, 1.64, { width: 0.62 }),
    // Rainbow band under the roof, on both faces we can see.
    custom([], (g, ox, oy, s) => {
      for (const face of ['left', 'right'] as const) {
        const span = face === 'left' ? body.w : body.d;
        const k = Math.round(span * 2);
        for (let i = 0; i < k; i++) {
          const u0 = (i / k) * span;
          const u1 = ((i + 1) / k) * span;
          const q = [
            facePoint(body, face, u0, 1.76, s),
            facePoint(body, face, u1, 1.76, s),
            facePoint(body, face, u1, 1.92, s),
            facePoint(body, face, u0, 1.92, s),
          ].map((p) => ({ x: p.x + ox, y: p.y + oy }));
          const c = rainbow[i % rainbow.length]!;
          g.fillStyle(face === 'right' ? darken(c, 0.15) : c, 1);
          g.fillPoints(q, true);
        }
        const a0 = facePoint(body, face, 0, 1.76, s);
        const a1 = facePoint(body, face, span, 1.76, s);
        const b0 = facePoint(body, face, 0, 1.92, s);
        const b1 = facePoint(body, face, span, 1.92, s);
        g.lineStyle(1.2 * s, OL, 0.85);
        g.lineBetween(a0.x + ox, a0.y + oy, a1.x + ox, a1.y + oy);
        g.lineBetween(b0.x + ox, b0.y + oy, b1.x + ox, b1.y + oy);
      }
    }),
    // The front steps and the canopy over the doors.
    { type: 'block', gx: mid - 0.66, gy: body.d, w: 1.32, d: 0.24, h: 0.06, color: STEP, bevel: 1 },
    { type: 'block', gx: mid - 0.6, gy: body.d, gz: 0.86, w: 1.2, d: 0.22, h: 0.08, color: accent },
    {
      type: 'block',
      gx: -0.08,
      gy: -0.08,
      gz: bodyH,
      w: b.w + 0.16,
      d: body.d + 0.16,
      h: roofH,
      color: accent,
      bevel: 3,
    },
    // Bell tower: a base with a clock, four posts with the bell between them, a cap, a flag.
    { type: 'block', gx: tx, gy: ty, gz: roofTop, w: tw, d: tw, h: 0.5, color: WHITE },
    custom([], (g, ox, oy, s) => {
      const c = facePoint(
        { gx: tx, gy: ty, w: tw, d: tw, h: 0.5, gz: roofTop },
        'left',
        tw / 2,
        0.26,
        s,
      );
      const x = c.x + ox;
      const y = c.y + oy;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, 7 * s);
      g.lineStyle(2 * s, OL, 1);
      g.strokeCircle(x, y, 7 * s);
      g.lineStyle(1.6 * s, OL, 1);
      g.lineBetween(x, y, x, y - 4.5 * s);
      g.lineBetween(x, y, x + 3.5 * s, y + 1 * s);
      g.fillStyle(accent, 1);
      g.fillCircle(x, y, 1.4 * s);
    }),
    post(0, 0),
    custom([], (g, ox, oy, s) => {
      // The bell hangs from the cap: a gold dome flaring to a rim, with a clapper.
      const c = project(mid, body.d / 2, baseTop + 0.22, s);
      const x = c.x + ox;
      const y = c.y + oy;
      const r = 6.5 * s;
      const bell = [
        { x: x - 0.48 * r, y: y - 0.5 * r },
        { x: x - 0.3 * r, y: y - 0.85 * r },
        { x: x, y: y - 0.95 * r },
        { x: x + 0.3 * r, y: y - 0.85 * r },
        { x: x + 0.48 * r, y: y - 0.5 * r },
        { x: x + 0.62 * r, y: y + 0.35 * r },
        { x: x + 0.9 * r, y: y + 0.62 * r },
        { x: x - 0.9 * r, y: y + 0.62 * r },
        { x: x - 0.62 * r, y: y + 0.35 * r },
      ];
      g.lineStyle(1.5 * s, OL, 1);
      g.lineBetween(x, y - 0.95 * r, x, y - 1.6 * r);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillPoints(bell, true);
      g.strokePoints(bell, true);
      g.fillStyle(lighten(PALETTE.coinGold, 0.5), 1);
      g.fillEllipse(x - 0.25 * r, y - 0.35 * r, 0.22 * r, 0.6 * r);
      g.fillStyle(OL, 1);
      g.fillCircle(x, y + 0.78 * r, 0.22 * r);
    }),
    post(1, 0),
    post(0, 1),
    post(1, 1),
    {
      type: 'block',
      gx: tx - 0.06,
      gy: ty - 0.06,
      gz: baseTop + 0.46,
      w: tw + 0.12,
      d: tw + 0.12,
      h: 0.12,
      color: accent,
      bevel: 2,
    },
    custom(
      [
        { x: flagAt.x - 6, y: flagAt.y - 34 },
        { x: flagAt.x + 26, y: flagAt.y + 4 },
      ],
      (g, ox, oy, s) => {
        const c = project(mid, body.d / 2, capTop, s);
        const x = c.x + ox;
        const y = c.y + oy;
        const f = [
          { x, y: y - 28 * s },
          { x: x + 20 * s, y: y - 22 * s },
          { x, y: y - 15 * s },
        ];
        g.fillStyle(PALETTE.coinGold, 1);
        g.fillPoints(f, true);
        g.lineStyle(2 * s, OL, 1);
        g.strokePoints(f, true);
        g.lineStyle(3 * s, OL, 1);
        g.lineBetween(x, y, x, y - 29 * s);
      },
    ),
  ];
}

/**
 * The playground: a sand play area with a climbing tower and a slide, and a swing set. Colours
 * for everything, so it reads as a playground from far away.
 */
export function playgroundParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const t0 = 0.22;
  const t1 = 1.02;
  const deck = 0.58;
  const roofZ = 1.08;
  const post = (x: number, y: number): Part => ({
    type: 'block',
    gx: x,
    gy: y,
    gz: 0.05,
    w: 0.1,
    d: 0.1,
    h: roofZ - 0.05,
    color: PALETTE.policeBlue,
    bevel: 1,
    outline: 1.5,
  });
  const sx0 = 1.55;
  const sx1 = b.w - 0.2;
  const sy = b.d / 2;
  const top = 1.18;
  const legs = (y: number) =>
    custom([], (g, ox, oy, s) => {
      for (const x of [sx0, sx1])
        rod(g, ox, oy, s, [x, sy, top], [x, y, 0.05], 3, PALETTE.harborTeal);
    });
  const seat = (x: number): Part[] => [
    custom([], (g, ox, oy, s) => {
      for (const dx of [-0.1, 0.1]) {
        const p = project(x + dx, sy, top, s);
        const q = project(x + dx, sy, 0.4, s);
        g.lineStyle(1.3 * s, OL, 1);
        g.lineBetween(p.x + ox, p.y + oy, q.x + ox, q.y + oy);
      }
    }),
    {
      type: 'block',
      gx: x - 0.15,
      gy: sy - 0.08,
      gz: 0.34,
      w: 0.3,
      d: 0.16,
      h: 0.05,
      color: PALETTE.fireRed,
      bevel: 0,
      outline: 1.5,
    },
  ];
  return [
    { type: 'block', w: b.w, d: b.d, h: 0.05, color: PALETTE.sand, bevel: 2 },
    // Climbing tower: back posts, deck, ladder, front posts, roof.
    post(t0, t0),
    post(t1 - 0.1, t0),
    post(t0, t1 - 0.1),
    {
      type: 'block',
      gx: t0,
      gy: t0,
      gz: deck,
      w: t1 - t0,
      d: t1 - t0,
      h: 0.08,
      color: PALETTE.harborTeal,
      bevel: 1,
    },
    custom([], (g, ox, oy, s) => {
      // Ladder up the right side of the tower.
      const x = t1 + 0.06;
      for (const y of [t0 + 0.15, t1 - 0.25])
        rod(g, ox, oy, s, [x, y, 0.05], [x, y, deck + 0.06], 2.5, 0xe4e7ee);
      for (let z = 0.16; z < deck; z += 0.13)
        rod(g, ox, oy, s, [x, t0 + 0.15, z], [x, t1 - 0.25, z], 2, 0xe4e7ee);
    }),
    post(t1 - 0.1, t1 - 0.1),
    {
      type: 'block',
      gx: t0 - 0.06,
      gy: t0 - 0.06,
      gz: roofZ,
      w: t1 - t0 + 0.12,
      d: t1 - t0 + 0.12,
      h: 0.1,
      color: PALETTE.fireRed,
      bevel: 2,
    },
    // The slide: from the front edge of the deck down to the sand.
    custom([], (g, ox, oy, s) => {
      const P = (x: number, y: number, z: number) => {
        const p = project(x, y, z, s);
        return { x: p.x + ox, y: p.y + oy };
      };
      const x0 = t0 + 0.14;
      const x1 = t1 - 0.14;
      const y1 = b.d - 0.12;
      const chute = [
        P(x0, t1, deck + 0.08),
        P(x1, t1, deck + 0.08),
        P(x1, y1, 0.1),
        P(x0, y1, 0.1),
      ];
      g.fillStyle(accent, 1);
      g.fillPoints(chute, true);
      g.fillStyle(lighten(accent, 0.35), 1);
      g.fillPoints(
        [
          P(x0 + 0.08, t1, deck + 0.08),
          P(x0 + 0.2, t1, deck + 0.08),
          P(x0 + 0.2, y1, 0.1),
          P(x0 + 0.08, y1, 0.1),
        ],
        true,
      );
      g.lineStyle(2 * s, OL, 1);
      g.strokePoints(chute, true);
      // Raised sides.
      for (const x of [x0, x1])
        rod(g, ox, oy, s, [x, t1, deck + 0.16], [x, y1, 0.18], 2.5, darken(accent, 0.2));
    }),
    // Swings: back legs, top bar, seats on chains, front legs.
    legs(sy - 0.42),
    custom([], (g, ox, oy, s) =>
      rod(g, ox, oy, s, [sx0, sy, top], [sx1, sy, top], 3.5, PALETTE.harborTeal),
    ),
    ...seat(sx0 + (sx1 - sx0) * 0.3),
    ...seat(sx0 + (sx1 - sx0) * 0.72),
    legs(sy + 0.42),
  ];
}

/**
 * The community garden: two raised wooden beds, carrots in the back one, round lettuces and a
 * few flowers in the front one.
 */
export function gardenParts(b: BuildingDef): Part[] {
  const bed = (y0: number): Part => ({
    type: 'block',
    gx: 0.12,
    gy: y0,
    w: b.w - 0.24,
    d: b.d / 2 - 0.24,
    h: 0.3,
    color: WOOD,
    top: SOIL,
    bevel: 2,
  });
  const y0 = 0.12;
  const y1 = b.d / 2 + 0.12;
  const mid = (y: number) => y + (b.d / 2 - 0.24) / 2;
  const along = (i: number, n: number) => 0.4 + (i * (b.w - 0.8)) / (n - 1);
  return [
    bed(y0),
    custom([], (g, ox, oy, s) => {
      // Carrots: leafy tops over orange shoulders.
      const n = Math.round(b.w * 2);
      for (let i = 0; i < n; i++) {
        const p = project(along(i, n), mid(y0), 0.3, s);
        const x = p.x + ox;
        const y = p.y + oy;
        for (const [dx, dy] of [
          [-3, -9],
          [0, -11],
          [3, -9],
        ] as const) {
          g.lineStyle(3.6 * s, OL, 1);
          g.lineBetween(x, y - 1 * s, x + dx * s, y + dy * s);
          g.lineStyle(1.8 * s, PALETTE.leaf, 1);
          g.lineBetween(x, y - 1 * s, x + dx * s, y + dy * s);
        }
        g.fillStyle(PALETTE.coneOrange, 1);
        g.fillEllipse(x, y, 7 * s, 4 * s);
        g.lineStyle(1.2 * s, OL, 1);
        g.strokeEllipse(x, y, 7 * s, 4 * s);
      }
    }),
    bed(y1),
    custom([], (g, ox, oy, s) => {
      // Lettuces, with a flower at each end.
      const n = Math.round(b.w * 1.6);
      for (let i = 0; i < n; i++) {
        const p = project(along(i, n), mid(y1), 0.3, s);
        const x = p.x + ox;
        const y = p.y + oy - 3 * s;
        const flower = i === 0 || i === n - 1;
        if (flower) {
          g.lineStyle(3 * s, OL, 1);
          g.lineBetween(x, y + 3 * s, x, y - 7 * s);
          g.lineStyle(1.5 * s, PALETTE.leaf, 1);
          g.lineBetween(x, y + 3 * s, x, y - 7 * s);
          g.fillStyle(OL, 1);
          g.fillCircle(x, y - 8 * s, 4.6 * s);
          g.fillStyle(i === 0 ? PALETTE.fireRed : PALETTE.coinGold, 1);
          g.fillCircle(x, y - 8 * s, 3.4 * s);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(x, y - 8 * s, 1.2 * s);
          continue;
        }
        g.fillStyle(darken(PALETTE.leaf, 0.08), 1);
        g.fillCircle(x, y, 5.5 * s);
        g.lineStyle(1.5 * s, OL, 1);
        g.strokeCircle(x, y, 5.5 * s);
        g.fillStyle(lighten(PALETTE.leaf, 0.35), 1);
        g.fillCircle(x - 1 * s, y - 1 * s, 2.6 * s);
      }
    }),
  ];
}
