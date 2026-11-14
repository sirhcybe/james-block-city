import type Phaser from 'phaser';
import { PALETTE } from '../config';
import type { BuildingDef } from '../content/schema';
import { darken, lighten } from './color';
import { bakeParts, type BakedMeta, type Part } from './blocks';
import type { BlockGeom } from './isoShapes';
import { facePoint, project } from './isoShapes';
import { drawIcon } from './icons';
import { drawCoin, drawDonut, drawStar } from './shapes2d';

function windowsOn(
  body: BlockGeom,
  floors: number,
  z0: number,
  opts: { tall?: boolean; doorAt?: number; door?: number },
): Part[] {
  const parts: Part[] = [];
  const zLo = opts.tall ? 0.18 : 0.3;
  const zHi = opts.tall ? 0.82 : 0.8;
  for (const face of ['left', 'right'] as const) {
    const span = face === 'left' ? body.w : body.d;
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < span; i++) {
        if (f === 0 && face === 'left' && opts.doorAt === i) {
          parts.push({
            type: 'window',
            block: body,
            face,
            u0: i + 0.3,
            u1: i + 0.7,
            z0: z0,
            z1: z0 + 0.62,
            color: opts.door ?? PALETTE.coinGold,
          });
          continue;
        }
        parts.push({
          type: 'window',
          block: body,
          face,
          u0: i + 0.2,
          u1: i + 0.8,
          z0: z0 + f + zLo,
          z1: z0 + f + zHi,
        });
      }
    }
  }
  return parts;
}

function houseParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const roofH = 0.3;
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - roofH };
  return [
    { type: 'block', ...body, color: PALETTE.buildingWhite },
    ...windowsOn(body, Math.floor(body.h), 0, { doorAt: Math.floor((b.w - 1) / 2), door: accent }),
    { type: 'block', w: b.w, d: b.d, h: roofH, gz: body.h, color: accent },
  ];
}

function towerParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const roofH = 0.3;
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - roofH };
  return [
    { type: 'block', ...body, color: PALETTE.buildingWhite },
    ...windowsOn(body, Math.floor(body.h), 0, { tall: true, doorAt: 0, door: accent }),
    { type: 'block', w: b.w, d: b.d, h: roofH, gz: body.h, color: accent },
    {
      type: 'block',
      gx: b.w / 2 - 0.35,
      gy: b.d / 2 - 0.35,
      gz: b.h,
      w: 0.7,
      d: 0.7,
      h: 0.45,
      color: darken(accent, 0.05),
    },
  ];
}

function cityHallParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const baseH = b.h - 1;
  const body: BlockGeom = { w: b.w, d: b.d, h: baseH };
  const upper: BlockGeom = { gx: 0.5, gy: 0.5, gz: baseH + 0.25, w: b.w - 1, d: b.d - 1, h: 0.75 };
  return [
    // Steps.
    {
      type: 'block',
      gx: -0.1,
      gy: -0.1,
      w: b.w + 0.2,
      d: b.d + 0.2,
      h: 0.15,
      color: PALETTE.sidewalk,
    },
    { type: 'block', ...body, gz: 0.15, h: baseH - 0.15, color: PALETTE.buildingWhite },
    ...windowsOn({ ...body, gz: 0.15, h: baseH - 0.15 }, 2, 0, {
      tall: true,
      doorAt: Math.floor(b.w / 2),
      door: accent,
    }),
    { type: 'block', w: b.w, d: b.d, h: 0.25, gz: baseH, color: accent },
    { type: 'block', ...upper, color: PALETTE.buildingWhite },
    ...windowsOn(upper, 0, 0, {}),
    { type: 'block', ...upper, gz: upper.gz! + upper.h, h: 0.2, color: accent },
    // Flag pole + flag on top (picture, no text).
    {
      type: 'custom',
      bounds: [
        { x: (b.w - b.d) * 16, y: (b.w + b.d) * 8 - (b.h + 1.2) * 32 - 4 },
        { x: (b.w - b.d) * 16 + 30, y: (b.w + b.d) * 8 - b.h * 32 },
      ],
      draw: (g, ox, oy, s) => {
        const top = project(b.w / 2, b.d / 2, b.h + 1.2, s);
        const bottom = project(b.w / 2, b.d / 2, b.h + 0.2, s);
        g.lineStyle(3 * s, PALETTE.outline, 1);
        g.lineBetween(top.x + ox, top.y + oy, bottom.x + ox, bottom.y + oy);
        g.fillStyle(PALETTE.fireRed, 1);
        g.lineStyle(2 * s, PALETTE.outline, 1);
        const fx = top.x + ox;
        const fy = top.y + oy;
        g.beginPath();
        g.moveTo(fx, fy);
        g.lineTo(fx + 26 * s, fy + 7 * s);
        g.lineTo(fx, fy + 15 * s);
        g.closePath();
        g.fillPath();
        g.strokePath();
      },
    },
  ];
}

function fountainParts(b: BuildingDef): Part[] {
  const cx = b.w / 2;
  const cy = b.d / 2;
  return [
    {
      type: 'block',
      w: b.w,
      d: b.d,
      h: b.h,
      color: PALETTE.buildingWhite,
      top: PALETTE.water,
      bevel: 7,
    },
    {
      type: 'block',
      gx: cx - 0.25,
      gy: cy - 0.25,
      gz: b.h,
      w: 0.5,
      d: 0.5,
      h: 0.6,
      color: PALETTE.buildingWhite,
    },
    {
      type: 'block',
      gx: cx - 0.4,
      gy: cy - 0.4,
      gz: b.h + 0.6,
      w: 0.8,
      d: 0.8,
      h: 0.15,
      color: PALETTE.buildingWhite,
      top: lighten(PALETTE.water, 0.2),
      bevel: 3,
    },
    {
      type: 'custom',
      bounds: [
        { x: -40, y: (b.w + b.d) * 8 - (b.h + 2) * 32 },
        { x: 40, y: (b.w + b.d) * 8 },
      ],
      draw: (g, ox, oy, s) => {
        const spout = project(cx, cy, b.h + 0.75, s);
        const drops: [number, number, number][] = [
          [0, -38, 7],
          [-14, -26, 5],
          [14, -26, 5],
          [-24, -8, 4],
          [24, -8, 4],
          [-6, -52, 4],
          [8, -48, 3],
        ];
        for (const [dx, dy, r] of drops) {
          g.fillStyle(lighten(PALETTE.water, 0.45), 1);
          g.lineStyle(1.5 * s, darken(PALETTE.water, 0.25), 1);
          g.fillCircle(spout.x + ox + dx * s, spout.y + oy + dy * s, r * s);
          g.strokeCircle(spout.x + ox + dx * s, spout.y + oy + dy * s, r * s);
        }
      },
    },
  ];
}

function treeParts(b: BuildingDef): Part[] {
  const leaf = PALETTE[b.color];
  return [
    { type: 'block', gx: 0.38, gy: 0.38, w: 0.24, d: 0.24, h: 0.7, color: PALETTE.trunk, bevel: 1 },
    { type: 'block', gx: 0.1, gy: 0.1, gz: 0.55, w: 0.8, d: 0.8, h: 0.95, color: leaf, bevel: 6 },
    {
      type: 'block',
      gx: 0.25,
      gy: 0.25,
      gz: 1.5,
      w: 0.5,
      d: 0.5,
      h: 0.45,
      color: lighten(leaf, 0.08),
      bevel: 4,
    },
  ];
}

function policeParts(b: BuildingDef): Part[] {
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - 0.3 };
  return [
    ...houseParts(b),
    // Rooftop light bar: red + blue.
    {
      type: 'block',
      gx: b.w / 2 - 0.4,
      gy: b.d / 2 - 0.15,
      gz: b.h,
      w: 0.4,
      d: 0.3,
      h: 0.22,
      color: PALETTE.fireRed,
      bevel: 2,
    },
    {
      type: 'block',
      gx: b.w / 2,
      gy: b.d / 2 - 0.15,
      gz: b.h,
      w: 0.4,
      d: 0.3,
      h: 0.22,
      color: PALETTE.policeBlue,
      bevel: 2,
    },
    // Big gold star badge on the front (picture sign, no words).
    {
      type: 'custom',
      bounds: [],
      draw: (g, ox, oy, s) => {
        const c = facePoint(body, 'left', b.w * 0.5, body.h - 0.55, s);
        drawStar(g, c.x + ox, c.y + oy, 15 * s, PALETTE.coinGold, 2 * s);
      },
    },
  ];
}

function donutShopParts(b: BuildingDef): Part[] {
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  return [
    ...houseParts(b),
    {
      type: 'custom',
      bounds: [
        { x: top.x - 34, y: top.y - 62 },
        { x: top.x + 34, y: top.y + 4 },
      ],
      draw: (g, ox, oy, s) => {
        const c = project(b.w / 2, b.d / 2, b.h, s);
        g.lineStyle(4 * s, PALETTE.outline, 1);
        g.lineBetween(c.x + ox, c.y + oy, c.x + ox, c.y + oy - 20 * s);
        drawDonut(g, c.x + ox, c.y + oy - 34 * s, 26 * s, s);
      },
    },
  ];
}

/** Where the robbers sit behind Time-Out Tower's big window (offset from the building origin). */
export function timeoutWindowPoint(b: BuildingDef, slot: number): { x: number; y: number } {
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - 0.3 };
  return facePoint(body, 'left', 0.55 + slot * 0.75, 0.3, 1);
}

/**
 * Time-Out Tower: a tall white tower with a big ground-floor window (the robbers sit in the corner
 * behind it) and a sand-timer sign on the roof. Nothing scary: it's a "time-out", not a jail.
 */
function timeoutParts(b: BuildingDef): Part[] {
  const roofH = 0.3;
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - roofH };
  const parts: Part[] = [{ type: 'block', ...body, color: PALETTE.buildingWhite }];
  parts.push({
    type: 'window',
    block: body,
    face: 'left',
    u0: 0.15,
    u1: b.w - 0.15,
    z0: 0.15,
    z1: 1.35,
    color: 0xbfe6fa,
  });
  for (let f = 2; f < Math.floor(body.h); f++) {
    for (const face of ['left', 'right'] as const) {
      const span = face === 'left' ? b.w : b.d;
      for (let i = 0; i < span; i++)
        parts.push({
          type: 'window',
          block: body,
          face,
          u0: i + 0.25,
          u1: i + 0.75,
          z0: f + 0.3,
          z1: f + 0.8,
        });
    }
  }
  parts.push({
    type: 'window',
    block: body,
    face: 'right',
    u0: 0.6,
    u1: 1.4,
    z0: 0,
    z1: 0.9,
    color: PALETTE.policeBlue,
  });
  parts.push({ type: 'block', w: b.w, d: b.d, h: roofH, gz: body.h, color: PALETTE.policeBlue });
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  parts.push({
    type: 'custom',
    bounds: [
      { x: top.x - 30, y: top.y - 70 },
      { x: top.x + 30, y: top.y + 4 },
    ],
    draw: (g, ox, oy, sc) => {
      // A sand timer: two triangles in a frame.
      const c = project(b.w / 2, b.d / 2, b.h, sc);
      const x = c.x + ox;
      const y = c.y + oy - 36 * sc;
      g.lineStyle(3 * sc, PALETTE.outline, 1);
      g.fillStyle(PALETTE.trunk, 1);
      g.fillRect(x - 18 * sc, y - 30 * sc, 36 * sc, 6 * sc);
      g.fillRect(x - 18 * sc, y + 24 * sc, 36 * sc, 6 * sc);
      g.strokeRect(x - 18 * sc, y - 30 * sc, 36 * sc, 6 * sc);
      g.strokeRect(x - 18 * sc, y + 24 * sc, 36 * sc, 6 * sc);
      const glass = [
        { x: x - 13 * sc, y: y - 24 * sc },
        { x: x + 13 * sc, y: y - 24 * sc },
        { x: x, y: y },
        { x: x + 13 * sc, y: y + 24 * sc },
        { x: x - 13 * sc, y: y + 24 * sc },
        { x: x, y: y },
      ];
      g.fillStyle(0xe8f6ff, 1);
      g.fillPoints(glass, true);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillTriangle(x - 8 * sc, y + 22 * sc, x + 8 * sc, y + 22 * sc, x, y + 10 * sc);
      g.fillTriangle(x - 6 * sc, y - 14 * sc, x + 6 * sc, y - 14 * sc, x, y - 4 * sc);
      g.strokePoints(glass, true);
      g.lineStyle(3 * sc, PALETTE.outline, 1);
      g.lineBetween(x, y + 30 * sc, x, y + 40 * sc);
    },
  });
  return parts;
}

/** The Shop: a house with a striped awning and a big coin sign (picture only). */
function shopParts(b: BuildingDef): Part[] {
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - 0.3 };
  return [
    ...houseParts(b),
    {
      type: 'custom',
      bounds: [
        { x: top.x - 40, y: top.y - 70 },
        { x: top.x + 40, y: top.y + 4 },
      ],
      draw: (g, ox, oy, sc) => {
        // Awning stripes over the door side.
        for (let i = 0; i < b.w * 4; i++) {
          const u0 = i / 4;
          const a = facePoint(body, 'left', u0, 1.0, sc);
          const bb = facePoint(body, 'left', u0 + 0.25, 1.0, sc);
          const c2 = facePoint(body, 'left', u0 + 0.25, 0.85, sc);
          const d2 = facePoint(body, 'left', u0, 0.85, sc);
          g.fillStyle(i % 2 ? 0xffffff : PALETTE.fireRed, 1);
          g.fillPoints(
            [a, bb, { x: c2.x, y: c2.y + 8 * sc }, { x: d2.x, y: d2.y + 8 * sc }].map((p) => ({
              x: p.x + ox,
              y: p.y + oy,
            })),
            true,
          );
        }
        const c = project(b.w / 2, b.d / 2, b.h, sc);
        g.lineStyle(4 * sc, PALETTE.outline, 1);
        g.lineBetween(c.x + ox, c.y + oy, c.x + ox, c.y + oy - 22 * sc);
        drawCoin(g, c.x + ox, c.y + oy - 40 * sc, 22 * sc, sc);
      },
    },
  ];
}

/** Skyscraper Heights tower: like a tower, with a helipad (a big H on a circle) on the tallest. */
function skyscraperParts(b: BuildingDef): Part[] {
  const accent = PALETTE[b.color];
  const roofH = 0.3;
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - roofH };
  const parts: Part[] = [
    { type: 'block', ...body, color: PALETTE.buildingWhite },
    ...windowsOn(body, Math.floor(body.h), 0, { tall: true, doorAt: 0, door: accent }),
    { type: 'block', w: b.w, d: b.d, h: roofH, gz: body.h, color: accent },
  ];
  if (b.h >= 12) {
    const top = project(b.w / 2, b.d / 2, b.h, 1);
    parts.push({
      type: 'custom',
      bounds: [
        { x: top.x - 50, y: top.y - 30 },
        { x: top.x + 50, y: top.y + 30 },
      ],
      draw: (g, ox, oy, sc) => {
        const c = project(b.w / 2, b.d / 2, b.h, sc);
        g.fillStyle(0x3a3d4a, 1);
        g.fillEllipse(c.x + ox, c.y + oy, 70 * sc, 35 * sc);
        g.lineStyle(3 * sc, PALETTE.coinGold, 1);
        g.strokeEllipse(c.x + ox, c.y + oy, 60 * sc, 30 * sc);
        g.lineStyle(5 * sc, 0xffffff, 1);
        const x = c.x + ox;
        const y = c.y + oy;
        g.lineBetween(x - 10 * sc, y - 8 * sc, x - 10 * sc, y + 8 * sc);
        g.lineBetween(x + 10 * sc, y - 8 * sc, x + 10 * sc, y + 8 * sc);
        g.lineBetween(x - 10 * sc, y, x + 10 * sc, y);
      },
    });
  } else {
    parts.push({
      type: 'block',
      gx: b.w / 2 - 0.35,
      gy: b.d / 2 - 0.35,
      gz: b.h,
      w: 0.7,
      d: 0.7,
      h: 0.45,
      color: darken(accent, 0.05),
    });
  }
  return parts;
}

/** Fire station: red, a big garage door, a bell and a flame badge sign. */
function fireStationParts(b: BuildingDef): Part[] {
  const body: BlockGeom = { w: b.w, d: b.d, h: b.h - 0.3 };
  return [
    { type: 'block', ...body, color: PALETTE.fireRed },
    {
      type: 'window',
      block: body,
      face: 'left',
      u0: 0.2,
      u1: b.w - 0.2,
      z0: 0,
      z1: 1.2,
      color: 0xd9dce3,
    },
    { type: 'window', block: body, face: 'right', u0: 0.4, u1: 0.9, z0: 1.4, z1: 1.9 },
    { type: 'window', block: body, face: 'right', u0: 1.1, u1: 1.6, z0: 1.4, z1: 1.9 },
    { type: 'block', w: b.w, d: b.d, h: 0.3, gz: body.h, color: PALETTE.buildingWhite },
    {
      type: 'custom',
      bounds: [],
      draw: (g, ox, oy, sc) => {
        // Garage door stripes.
        for (let k = 1; k < 4; k++) {
          const a = facePoint(body, 'left', 0.2, k * 0.3, sc);
          const bb = facePoint(body, 'left', b.w - 0.2, k * 0.3, sc);
          g.lineStyle(2 * sc, 0xa0a6b4, 1);
          g.lineBetween(a.x + ox, a.y + oy, bb.x + ox, bb.y + oy);
        }
        // A flame sign over the door.
        const c = facePoint(body, 'left', b.w * 0.5, body.h - 0.45, sc);
        g.fillStyle(PALETTE.coinGold, 1);
        g.fillCircle(c.x + ox, c.y + oy, 14 * sc);
        g.lineStyle(2 * sc, PALETTE.outline, 1);
        g.strokeCircle(c.x + ox, c.y + oy, 14 * sc);
        g.fillStyle(PALETTE.fireRed, 1);
        g.fillTriangle(
          c.x + ox - 7 * sc,
          c.y + oy + 7 * sc,
          c.x + ox + 7 * sc,
          c.y + oy + 7 * sc,
          c.x + ox,
          c.y + oy - 10 * sc,
        );
      },
    },
    // Bell on the roof.
    {
      type: 'block',
      gx: b.w / 2 - 0.15,
      gy: b.d / 2 - 0.15,
      gz: b.h,
      w: 0.3,
      d: 0.3,
      h: 0.35,
      color: PALETTE.coinGold,
      bevel: 2,
    },
  ];
}

/** Builder build spots (spec 005): a brick wall. */
function wallParts(b: BuildingDef): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < b.w * 2; i++) {
    for (let row = 0; row < 2; row++) {
      const off = row % 2 ? 0.25 : 0;
      const gx = Math.min(b.w - 0.5, i * 0.5 + off);
      parts.push({
        type: 'block',
        gx,
        gy: 0.3,
        gz: row * (b.h / 2),
        w: 0.48,
        d: 0.4,
        h: b.h / 2 - 0.02,
        color: (i + row) % 2 ? PALETTE[b.color] : darken(PALETTE[b.color], 0.12),
        bevel: 1,
      });
    }
  }
  return parts;
}

/** Wooden dock on posts over the water. */
function dockParts(b: BuildingDef): Part[] {
  const parts: Part[] = [];
  for (const [x, y] of [
    [0.1, 0.1],
    [b.w - 0.3, 0.1],
    [0.1, b.d - 0.3],
    [b.w - 0.3, b.d - 0.3],
  ] as const)
    parts.push({ type: 'block', gx: x, gy: y, gz: -0.5, w: 0.2, d: 0.2, h: 0.6, color: 0x7a5230 });
  for (let i = 0; i < b.w * 2; i++)
    parts.push({
      type: 'block',
      gx: i * 0.5,
      gy: 0,
      gz: 0.1,
      w: 0.46,
      d: b.d,
      h: b.h,
      color: i % 2 ? PALETTE.trunk : lighten(PALETTE.trunk, 0.1),
      bevel: 1,
    });
  return parts;
}

/** Wooden bridge: like the dock, with rails. */
function bridgeParts(b: BuildingDef): Part[] {
  return [
    ...dockParts(b),
    { type: 'block', gx: 0, gy: 0, gz: b.h + 0.1, w: b.w, d: 0.1, h: 0.35, color: 0x7a5230 },
    {
      type: 'block',
      gx: 0,
      gy: b.d - 0.1,
      gz: b.h + 0.1,
      w: b.w,
      d: 0.1,
      h: 0.35,
      color: 0x7a5230,
    },
  ];
}

/** Lighthouse: a white tower with red stripes and a gold lamp room. */
function lighthouseParts(b: BuildingDef): Part[] {
  const parts: Part[] = [];
  const bands = Math.floor(b.h - 1);
  for (let i = 0; i < bands; i++)
    parts.push({
      type: 'block',
      gx: 0.1,
      gy: 0.1,
      gz: i,
      w: b.w - 0.2,
      d: b.d - 0.2,
      h: 1,
      color: i % 2 ? PALETTE.fireRed : PALETTE.buildingWhite,
    });
  parts.push({
    type: 'block',
    gx: 0,
    gy: 0,
    gz: bands,
    w: b.w,
    d: b.d,
    h: 0.15,
    color: PALETTE.outline,
  });
  parts.push({
    type: 'block',
    gx: 0.2,
    gy: 0.2,
    gz: bands + 0.15,
    w: b.w - 0.4,
    d: b.d - 0.4,
    h: 0.55,
    color: PALETTE.coinGold,
  });
  parts.push({
    type: 'block',
    gx: 0.15,
    gy: 0.15,
    gz: bands + 0.7,
    w: b.w - 0.3,
    d: b.d - 0.3,
    h: 0.25,
    color: PALETTE.fireRed,
  });
  return parts;
}

/** Boat shop: a teal house with a boat sign on the roof. */
function boatShopParts(b: BuildingDef): Part[] {
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  return [
    ...houseParts(b),
    {
      type: 'custom',
      bounds: [
        { x: top.x - 36, y: top.y - 60 },
        { x: top.x + 36, y: top.y + 4 },
      ],
      draw: (g, ox, oy, sc) => {
        const c = project(b.w / 2, b.d / 2, b.h, sc);
        g.lineStyle(4 * sc, PALETTE.outline, 1);
        g.lineBetween(c.x + ox, c.y + oy, c.x + ox, c.y + oy - 16 * sc);
        drawIcon(g, 'boat', c.x + ox, c.y + oy - 34 * sc, 22 * sc, sc);
      },
    },
  ];
}

/** The foreman's office: a yellow hut with a hard-hat sign. */
function officeParts(b: BuildingDef): Part[] {
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  return [
    ...houseParts(b),
    {
      type: 'custom',
      bounds: [
        { x: top.x - 30, y: top.y - 56 },
        { x: top.x + 30, y: top.y + 4 },
      ],
      draw: (g, ox, oy, sc) => {
        const c = project(b.w / 2, b.d / 2, b.h, sc);
        g.lineStyle(4 * sc, PALETTE.outline, 1);
        g.lineBetween(c.x + ox, c.y + oy, c.x + ox, c.y + oy - 14 * sc);
        drawIcon(g, 'hardHat', c.x + ox, c.y + oy - 30 * sc, 20 * sc, sc);
      },
    },
  ];
}

/** A tall yellow crane: mast, jib and a hanging block. */
function craneParts(b: BuildingDef): Part[] {
  return [
    { type: 'block', gx: 0.2, gy: 0.2, w: 0.6, d: 0.6, h: 0.3, color: 0x6e6e7a },
    {
      type: 'block',
      gx: 0.35,
      gy: 0.35,
      gz: 0.3,
      w: 0.3,
      d: 0.3,
      h: b.h - 0.3,
      color: PALETTE[b.color],
    },
    {
      type: 'block',
      gx: -1.2,
      gy: 0.35,
      gz: b.h,
      w: 2.6,
      d: 0.3,
      h: 0.25,
      color: PALETTE[b.color],
    },
    {
      type: 'block',
      gx: -1.0,
      gy: 0.3,
      gz: b.h - 1.6,
      w: 0.4,
      d: 0.4,
      h: 0.4,
      color: PALETTE.harborTeal,
      bevel: 2,
    },
  ];
}

/** The Golden Block tower (spec 007 finale): stacked gold and white blocks, the Golden Block on top. */
function goldenTowerParts(b: BuildingDef): Part[] {
  const parts: Part[] = [];
  const levels = Math.floor(b.h - 1);
  for (let i = 0; i < levels; i++) {
    const inset = 0.08 * i;
    parts.push({
      type: 'block',
      gx: inset,
      gy: inset,
      gz: i,
      w: b.w - inset * 2,
      d: b.d - inset * 2,
      h: 1,
      color: i % 2 ? PALETTE.coinGold : PALETTE.buildingWhite,
      bevel: 3,
    });
  }
  const top = 0.08 * levels;
  parts.push({
    type: 'block',
    gx: b.w / 2 - 0.4,
    gy: b.d / 2 - 0.4,
    gz: levels,
    w: 0.8,
    d: 0.8,
    h: 0.8,
    color: lighten(PALETTE.coinGold, 0.1),
    bevel: 4,
  });
  void top;
  const c = project(b.w / 2, b.d / 2, levels + 0.8, 1);
  parts.push({
    type: 'custom',
    bounds: [
      { x: c.x - 40, y: c.y - 50 },
      { x: c.x + 40, y: c.y + 10 },
    ],
    draw: (g, ox, oy, sc) => {
      const p = project(b.w / 2, b.d / 2, levels + 0.8, sc);
      drawStar(g, p.x + ox, p.y + oy - 22 * sc, 16 * sc, 0xfff3b0, 2 * sc);
    },
  });
  return parts;
}

/** Your apartment (spec 006): a house with a big heart over the door. */
function apartmentParts(b: BuildingDef): Part[] {
  const top = project(b.w / 2, b.d / 2, b.h, 1);
  return [
    ...houseParts(b),
    {
      type: 'custom',
      bounds: [
        { x: top.x - 34, y: top.y - 64 },
        { x: top.x + 34, y: top.y + 4 },
      ],
      draw: (g, ox, oy, sc) => {
        const c = project(b.w / 2, b.d / 2, b.h, sc);
        g.lineStyle(4 * sc, PALETTE.outline, 1);
        g.lineBetween(c.x + ox, c.y + oy, c.x + ox, c.y + oy - 16 * sc);
        drawIcon(g, 'heart', c.x + ox, c.y + oy - 36 * sc, 22 * sc, sc);
      },
    },
  ];
}

/** Palm tree: a leaning trunk of stacked blocks and a star of fronds (spec 008 islands). */
function palmParts(b: BuildingDef): Part[] {
  const leaf = PALETTE[b.color];
  const parts: Part[] = [];
  for (let i = 0; i < 4; i++)
    parts.push({
      type: 'block',
      gx: 0.4 + i * 0.03,
      gy: 0.4 - i * 0.03,
      gz: i * 0.38,
      w: 0.2,
      d: 0.2,
      h: 0.4,
      color: i % 2 ? PALETTE.trunk : darken(PALETTE.trunk, 0.12),
      bevel: 1,
    });
  parts.push({
    type: 'custom',
    bounds: [
      { x: -40, y: -92 },
      { x: 44, y: -30 },
    ],
    draw: (g, ox, oy, s) => {
      const c = project(0.6, 0.4, 1.6, s);
      const x = c.x + ox;
      const y = c.y + oy;
      const frond = (dx: number, dy: number, color: number) => {
        const pts = [
          { x, y },
          { x: x + dx * 0.45 * s, y: y + (dy - 12) * s },
          { x: x + dx * s, y: y + dy * s },
          { x: x + dx * 0.5 * s, y: y + (dy * 0.5 + 5) * s },
        ];
        g.fillStyle(color, 1);
        g.fillPoints(pts, true);
        g.lineStyle(2 * s, PALETTE.outline, 1);
        g.strokePoints(pts, true);
      };
      frond(-34, 4, darken(leaf, 0.12));
      frond(36, 6, darken(leaf, 0.12));
      frond(-24, -14, leaf);
      frond(26, -12, leaf);
      frond(0, -22, lighten(leaf, 0.12));
      frond(4, 16, lighten(leaf, 0.06));
      g.fillStyle(0x8a5a2b, 1);
      g.fillCircle(x - 4 * s, y + 3 * s, 4 * s);
      g.fillCircle(x + 4 * s, y + 4 * s, 4 * s);
      g.lineStyle(1.5 * s, PALETTE.outline, 1);
      g.strokeCircle(x - 4 * s, y + 3 * s, 4 * s);
      g.strokeCircle(x + 4 * s, y + 4 * s, 4 * s);
    },
  });
  return parts;
}

/** A smooth sea rock: three stacked grey blocks. */
function rockParts(b: BuildingDef): Part[] {
  const c = darken(PALETTE[b.color], 0.25);
  return [
    { type: 'block', gx: 0.08, gy: 0.12, w: 0.84, d: 0.76, h: b.h * 0.5, color: c, bevel: 6 },
    {
      type: 'block',
      gx: 0.2,
      gy: 0.22,
      gz: b.h * 0.5,
      w: 0.55,
      d: 0.5,
      h: b.h * 0.35,
      color: lighten(c, 0.08),
      bevel: 5,
    },
    {
      type: 'block',
      gx: 0.32,
      gy: 0.3,
      gz: b.h * 0.85,
      w: 0.28,
      d: 0.28,
      h: b.h * 0.2,
      color: lighten(c, 0.16),
      bevel: 3,
    },
  ];
}

/** A cargo barge: a low rusty hull with crates on deck (Barge Blaze). */
function bargeParts(b: BuildingDef): Part[] {
  const hull = 0x8d5a4a;
  return [
    {
      type: 'block',
      gx: 0.05,
      gy: 0.08,
      gz: -0.2,
      w: b.w - 0.1,
      d: b.d - 0.16,
      h: 0.5,
      color: hull,
    },
    {
      type: 'block',
      gx: 0.12,
      gy: 0.14,
      gz: 0.3,
      w: b.w - 0.24,
      d: b.d - 0.28,
      h: 0.08,
      color: lighten(hull, 0.25),
      bevel: 1,
    },
    {
      type: 'block',
      gx: 0.25,
      gy: 0.25,
      gz: 0.38,
      w: 0.5,
      d: 0.45,
      h: 0.4,
      color: PALETTE[b.color],
    },
    {
      type: 'block',
      gx: 0.9,
      gy: 0.28,
      gz: 0.38,
      w: 0.45,
      d: 0.4,
      h: 0.3,
      color: PALETTE.harborTeal,
    },
    { type: 'block', gx: 1.45, gy: 0.3, gz: 0.38, w: 0.35, d: 0.35, h: 0.55, color: 0xd9dce3 },
  ];
}

export function buildingParts(b: BuildingDef): Part[] {
  switch (b.kind) {
    case 'house':
      return houseParts(b);
    case 'tower':
      return towerParts(b);
    case 'cityhall':
      return cityHallParts(b);
    case 'fountain':
      return fountainParts(b);
    case 'tree':
      return treeParts(b);
    case 'police':
      return policeParts(b);
    case 'donutshop':
      return donutShopParts(b);
    case 'timeout':
      return timeoutParts(b);
    case 'shop':
      return shopParts(b);
    case 'skyscraper':
      return skyscraperParts(b);
    case 'firestation':
      return fireStationParts(b);
    case 'wall':
      return wallParts(b);
    case 'dock':
      return dockParts(b);
    case 'bridge':
      return bridgeParts(b);
    case 'lighthouse':
      return lighthouseParts(b);
    case 'boatshop':
      return boatShopParts(b);
    case 'office':
      return officeParts(b);
    case 'crane':
      return craneParts(b);
    case 'apartment':
      return apartmentParts(b);
    case 'goldentower':
      return goldenTowerParts(b);
    case 'palm':
      return palmParts(b);
    case 'rock':
      return rockParts(b);
    case 'barge':
      return bargeParts(b);
  }
}

export function buildingTextureKey(b: BuildingDef): string {
  return `bld:${b.kind}:${b.w}x${b.d}x${b.h}:${b.color}`;
}

/** Bake (once) and return the texture for a building definition. */
export function bakeBuilding(scene: Phaser.Scene, b: BuildingDef): BakedMeta {
  return bakeParts(scene, buildingTextureKey(b), buildingParts(b));
}
