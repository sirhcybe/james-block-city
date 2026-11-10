import type Phaser from 'phaser';
import { PALETTE } from '../config';
import type { BuildingDef } from '../content/schema';
import { darken, lighten } from './color';
import { bakeParts, type BakedMeta, type Part } from './blocks';
import type { BlockGeom } from './isoShapes';
import { facePoint, project } from './isoShapes';
import { drawDonut, drawStar } from './shapes2d';

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
  }
}

export function buildingTextureKey(b: BuildingDef): string {
  return `bld:${b.kind}:${b.w}x${b.d}x${b.h}:${b.color}`;
}

/** Bake (once) and return the texture for a building definition. */
export function bakeBuilding(scene: Phaser.Scene, b: BuildingDef): BakedMeta {
  return bakeParts(scene, buildingTextureKey(b), buildingParts(b));
}
