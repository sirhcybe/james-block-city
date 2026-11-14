import Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Vec2 } from '../iso/projection';
import { darken, lighten, mix } from './color';
import {
  blockFaces,
  boundsOf,
  facePoint,
  orientedBoxFaces,
  orientedFacePoint,
  type BlockGeom,
  type OrientedBox,
  type OrientedFace,
} from './isoShapes';
import { bakeGraphics, type Ctx } from './bake';
import { WT } from './renderScale';

export interface BlockStyle {
  color: number;
  /** Override the top face color (default: color lightened 15%). */
  top?: number;
  /** Bevel band size in logical px (default 4). */
  bevel?: number;
  /** Outline width in logical px (default 2). */
  outline?: number;
}

export type BlockOpts = BlockGeom & BlockStyle;

/** Where a baked texture's grid origin (grid point 0,0,0 of the object) sits, normalized. */
export interface BakedMeta {
  key: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

const baked = new Map<string, BakedMeta>();

export function blockTextureKey(o: BlockOpts): string {
  return `block:${o.w}x${o.d}x${o.h}@${o.gx ?? 0},${o.gy ?? 0},${o.gz ?? 0}:${o.color.toString(16)}:${(o.top ?? -1).toString(16)}:${o.bevel ?? 4}:${o.outline ?? 2}`;
}

function poly(g: Phaser.GameObjects.Graphics, pts: Vec2[], ox: number, oy: number): void {
  g.beginPath();
  g.moveTo(pts[0]!.x + ox, pts[0]!.y + oy);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x + ox, pts[i]!.y + oy);
  g.closePath();
}

function fillPoly(
  g: Phaser.GameObjects.Graphics,
  pts: Vec2[],
  ox: number,
  oy: number,
  color: number,
): void {
  g.fillStyle(color, 1);
  poly(g, pts, ox, oy);
  g.fillPath();
}

function strokePoly(
  g: Phaser.GameObjects.Graphics,
  pts: Vec2[],
  ox: number,
  oy: number,
  width: number,
  color = PALETTE.outline,
  alpha = 1,
): void {
  g.lineStyle(width, color, alpha);
  poly(g, pts, ox, oy);
  g.strokePath();
}

function strokeLine(
  g: Phaser.GameObjects.Graphics,
  a: Vec2,
  b: Vec2,
  ox: number,
  oy: number,
): void {
  g.beginPath();
  g.moveTo(a.x + ox, a.y + oy);
  g.lineTo(b.x + ox, b.y + oy);
  g.strokePath();
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Draw one smooth, flat-topped iso block: three shaded faces (top +15%, left = base, right −20%),
 * a soft bevel band along the top edges, and a dark outline. No studs, ever.
 * (ox, oy) is where grid point (0,0,0) lands in the graphics; s is the pixel scale.
 */
export function drawIsoBlock(
  g: Phaser.GameObjects.Graphics,
  o: BlockOpts,
  ox: number,
  oy: number,
  s = WT,
): void {
  const f = blockFaces(o, s);
  const base = o.color;
  const topC = o.top ?? lighten(base, 0.15);
  const rightC = darken(base, 0.2);
  const bevel = (o.bevel ?? 4) * s;
  const outline = (o.outline ?? 2) * s;

  fillPoly(g, f.left, ox, oy, base);
  fillPoly(g, f.right, ox, oy, rightC);
  fillPoly(g, f.top, ox, oy, topC);

  // Soft bevel: a lighter band just under the front top edges, and a highlight on the front edge.
  const [, S0, , W1] = f.left;
  const [, , E1, S1] = f.right;
  const bl = Math.min(bevel, (o.h * 32 * s) / 3);
  const down = (p: Vec2) => ({ x: p.x, y: p.y + bl });
  fillPoly(g, [W1!, S1!, down(S1!), down(W1!)], ox, oy, mix(base, topC, 0.55));
  fillPoly(g, [S1!, E1!, down(E1!), down(S1!)], ox, oy, mix(rightC, topC, 0.45));
  // Top-face inner rim to suggest a rounded edge.
  const N1 = f.top[0]!;
  const inset = (p: Vec2, c: Vec2, d: number) => {
    const len = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    return { x: p.x + ((c.x - p.x) / len) * d, y: p.y + ((c.y - p.y) / len) * d };
  };
  const centre = lerp(N1, S1!, 0.5);
  const rim = f.top.map((p) => inset(p, centre, bevel * 0.9));
  g.lineStyle(Math.max(1, s), lighten(topC, 0.35), 0.9);
  poly(g, rim, ox, oy);
  g.strokePath();

  // Inner edges (thinner) then the thick silhouette outline.
  g.lineStyle(Math.max(1, outline * 0.5), PALETTE.outline, 0.85);
  strokeLine(g, W1!, S1!, ox, oy);
  strokeLine(g, S1!, E1!, ox, oy);
  strokeLine(g, S0!, S1!, ox, oy);
  strokePoly(g, f.silhouette, ox, oy, outline);
}

/**
 * Draw a block turned to any angle (vehicles in 8 directions). Same look as drawIsoBlock: flat
 * shaded faces (sides shade from base to −20% as they turn toward +gx), a lighter top with a
 * rounded-edge rim, and the thick outline. Returns the faces so details can be drawn on them.
 */
export function drawOrientedBlock(
  g: Phaser.GameObjects.Graphics,
  o: OrientedBox,
  style: BlockStyle,
  ox: number,
  oy: number,
  s = WT,
): OrientedFace[] {
  const f = orientedBoxFaces(o, s);
  const base = style.color;
  const topC = style.top ?? lighten(base, 0.15);
  const outline = (style.outline ?? 2) * s;
  const bevel = (style.bevel ?? 4) * s;
  const visible = f.sides.filter((fc) => fc.visible);
  for (const fc of visible) fillPoly(g, fc.pts, ox, oy, darken(base, 0.2 * fc.shade));
  fillPoly(g, f.top, ox, oy, topC);
  // Top-face rim, inset toward the centre, suggests the soft rounded edge.
  const c = lerp(f.top[0]!, f.top[2]!, 0.5);
  const rim = f.top.map((p) => {
    const len = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    const d = Math.min(bevel * 0.9, len * 0.4);
    return { x: p.x + ((c.x - p.x) / len) * d, y: p.y + ((c.y - p.y) / len) * d };
  });
  g.lineStyle(Math.max(1, s), lighten(topC, 0.35), 0.9);
  poly(g, rim, ox, oy);
  g.strokePath();
  for (const fc of visible)
    strokePoly(g, fc.pts, ox, oy, Math.max(1, outline * 0.5), PALETTE.outline, 0.85);
  strokePoly(g, f.silhouette, ox, oy, outline);
  return f.sides;
}

/** A window or light (flat quad) on an oriented block's face. */
export function drawOrientedWindow(
  g: Phaser.GameObjects.Graphics,
  fc: OrientedFace,
  u0: number,
  u1: number,
  z0: number,
  z1: number,
  ox: number,
  oy: number,
  color: number = PALETTE.windowBlue,
  s = WT,
  glint = true,
): void {
  const pts = [
    orientedFacePoint(fc, u0, z0, s),
    orientedFacePoint(fc, u1, z0, s),
    orientedFacePoint(fc, u1, z1, s),
    orientedFacePoint(fc, u0, z1, s),
  ];
  fillPoly(g, pts, ox, oy, darken(color, 0.12 * fc.shade));
  if (glint) {
    g.lineStyle(Math.max(1, 1.5 * s), 0xffffff, 0.75);
    strokeLine(
      g,
      orientedFacePoint(fc, u0 + (u1 - u0) * 0.2, z1 - (z1 - z0) * 0.25, s),
      orientedFacePoint(fc, u0 + (u1 - u0) * 0.45, z1 - (z1 - z0) * 0.15, s),
      ox,
      oy,
    );
  }
  strokePoly(g, pts, ox, oy, Math.max(1, 1.5 * s));
}

/**
 * A window (flat parallelogram) on a block's vertical face: glass with a soft reflection, an
 * outline, and a sill under the bigger ones. With `door` it is a door: a panel, a knob, a step.
 */
export function drawWindow(
  g: Phaser.GameObjects.Graphics,
  b: BlockGeom,
  face: 'left' | 'right',
  u0: number,
  u1: number,
  z0: number,
  z1: number,
  ox: number,
  oy: number,
  color: number = PALETTE.windowBlue,
  s = WT,
  door = false,
): void {
  const at = (u: number, z: number) => facePoint(b, face, u, z, s);
  const pts = [at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)];
  const base = face === 'right' ? darken(color, 0.12) : color;
  const du = u1 - u0;
  const dz = z1 - z0;
  fillPoly(g, pts, ox, oy, base);
  if (door) {
    // Inset panel, a knob on the opening side, and a step at the foot.
    fillPoly(
      g,
      [
        at(u0 + du * 0.18, z0 + dz * 0.12),
        at(u1 - du * 0.18, z0 + dz * 0.12),
        at(u1 - du * 0.18, z1 - dz * 0.14),
        at(u0 + du * 0.18, z1 - dz * 0.14),
      ],
      ox,
      oy,
      lighten(base, 0.22),
    );
    strokePoly(g, pts, ox, oy, Math.max(1, 1.5 * s));
    const k = at(u1 - du * 0.28, z0 + dz * 0.45);
    g.fillStyle(PALETTE.outline, 1);
    g.fillCircle(k.x + ox, k.y + oy, Math.max(1, 1.3 * s));
    const step = [at(u0 - du * 0.12, z0), at(u1 + du * 0.12, z0)];
    g.lineStyle(Math.max(1, 2.4 * s), 0xb9bfcb, 1);
    strokeLine(g, step[0]!, step[1]!, ox, oy);
    return;
  }
  // Reflection: a lighter band across the upper corner of the glass.
  fillPoly(
    g,
    [at(u0, z1), at(u0 + du * 0.55, z1), at(u0, z1 - dz * 0.55)],
    ox,
    oy,
    lighten(base, 0.28),
  );
  g.lineStyle(Math.max(1, 1.5 * s), 0xffffff, 0.8);
  strokeLine(g, at(u0 + du * 0.2, z1 - dz * 0.25), at(u0 + du * 0.45, z1 - dz * 0.15), ox, oy);
  strokePoly(g, pts, ox, oy, Math.max(1, 1.5 * s));
  if (du >= 0.45 && dz >= 0.4) {
    // Sill: a pale ledge just under the window, a touch wider than it.
    g.lineStyle(Math.max(1, 2.2 * s), 0xb9bfcb, 1);
    strokeLine(g, at(u0 - 0.04, z0 - 0.045), at(u1 + 0.04, z0 - 0.045), ox, oy);
  }
}

/** One drawable part of a composite object. */
export type Part =
  | ({ type: 'block' } & BlockOpts)
  | {
      type: 'window';
      block: BlockGeom;
      face: 'left' | 'right';
      u0: number;
      u1: number;
      z0: number;
      z1: number;
      color?: number;
      /** A door (panel, knob, step) instead of glass. */
      door?: boolean;
    }
  | {
      type: 'custom';
      bounds: Vec2[];
      draw: (g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: number) => void;
    }
  | {
      /** Drawn straight onto the 2D context (curves, clipping), in order with the other parts. */
      type: 'canvas';
      bounds: Vec2[];
      draw: (ctx: Ctx, ox: number, oy: number, s: number) => void;
    };

function partBounds(p: Part, s: number): Vec2[] {
  if (p.type === 'block') return blockFaces(p, s).silhouette;
  if (p.type === 'window') return [];
  return p.bounds.map((pt) => ({ x: pt.x * s, y: pt.y * s }));
}

/**
 * Bake a list of parts (drawn in order) into one texture, once per key. Returns where grid point
 * (0,0,0) sits in the texture so the sprite can be positioned with gridToScreen.
 */
export function bakeParts(scene: Phaser.Scene, key: string, parts: Part[], s = WT): BakedMeta {
  const cached = baked.get(key);
  if (cached && scene.textures.exists(key)) return cached;

  const pts = parts.flatMap((p) => partBounds(p, s));
  const bb = boundsOf(pts);
  const pad = Math.ceil(3 * s);
  const ox = Math.ceil(-bb.minX + pad);
  const oy = Math.ceil(-bb.minY + pad);
  const width = Math.ceil(bb.maxX - bb.minX + pad * 2);
  const height = Math.ceil(bb.maxY - bb.minY + pad * 2);

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const tex = bakeGraphics(scene, g, key, width, height);
  const ctx = tex.getContext();
  let pending = false;
  // Graphics commands are drawn when flushed, so flush before each canvas part to keep the order.
  const flush = () => {
    if (!pending) return;
    g.generateTexture(key, width, height);
    g.clear();
    pending = false;
  };
  for (const p of parts) {
    if (p.type === 'canvas') {
      flush();
      ctx.save();
      p.draw(ctx, ox, oy, s);
      ctx.restore();
      continue;
    }
    pending = true;
    if (p.type === 'block') drawIsoBlock(g, p, ox, oy, s);
    else if (p.type === 'window')
      drawWindow(g, p.block, p.face, p.u0, p.u1, p.z0, p.z1, ox, oy, p.color, s, p.door);
    else p.draw(g, ox, oy, s);
  }
  flush();
  tex.refresh();
  g.destroy();

  const meta: BakedMeta = { key, originX: ox / width, originY: oy / height, width, height };
  baked.set(key, meta);
  return meta;
}

/** Bake a single block. */
export function bakeBlock(scene: Phaser.Scene, o: BlockOpts): BakedMeta {
  return bakeParts(scene, blockTextureKey(o), [{ type: 'block', ...o }]);
}

export function getBaked(key: string): BakedMeta {
  const m = baked.get(key);
  if (!m) throw new Error(`texture ${key} was not baked`);
  return m;
}

/** Place a baked texture as an image whose grid origin sits at world point (x, y). */
export function addBakedImage(
  scene: Phaser.Scene,
  meta: BakedMeta,
  x: number,
  y: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, meta.key)
    .setOrigin(meta.originX, meta.originY)
    .setScale(1 / WT);
}
