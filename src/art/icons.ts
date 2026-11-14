import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import { drawCoin, drawDonut, drawStar } from './shapes2d';

/**
 * Flat picture icons drawn into a Graphics at (x, y) with radius-ish size r (px at scale s already
 * applied by the caller: pass r already multiplied). Shared by bubbles, the mission board, the
 * shop, the HUD and minigames, so one picture always means one thing. No words, ever.
 */
export type IconName =
  | 'star'
  | 'donut'
  | 'duck'
  | 'puppy'
  | 'sock'
  | 'rubberDuck'
  | 'flag'
  | 'scooter'
  | 'bike'
  | 'padlock'
  | 'net'
  | 'badge'
  | 'coin'
  | 'feather'
  | 'trafficLight'
  | 'magnifier'
  | 'cap'
  | 'twoRobbers'
  | 'flame'
  | 'kitten'
  | 'toaster'
  | 'ladder'
  | 'hose'
  | 'helmet'
  | 'hardHat'
  | 'brick'
  | 'mixer'
  | 'blaster'
  | 'lighthouse'
  | 'boat'
  | 'bridge'
  | 'dock'
  | 'firework'
  | 'grill'
  | 'cake'
  | 'parrot'
  | 'tower'
  | 'window'
  | 'crane'
  | 'grid'
  | 'bucket'
  | 'uniforms'
  | 'balloon'
  | 'pizza'
  | 'wrench'
  | 'teddy'
  | 'flower'
  | 'iceCream'
  | 'letter'
  | 'fish'
  | 'book'
  | 'present'
  | 'apple'
  | 'shell'
  | 'bed'
  | 'table'
  | 'lamp'
  | 'cushion'
  | 'bookshelf'
  | 'tv'
  | 'computer'
  | 'fishTank'
  | 'chefHat'
  | 'pirateHat'
  | 'duckHat'
  | 'car'
  | 'paint'
  | 'heart'
  | 'home'
  | 'gear'
  | 'hammer'
  | 'trowel'
  | 'retry';

type G = Phaser.GameObjects.Graphics;
type Pt = readonly [number, number];
const OL = PALETTE.outline;
const STEEL = 0xc9ced8;
const DARK = 0x4a4e5c;

/**
 * One pen for every icon (spec 009). All coordinates are in units of the icon's half-size `r`,
 * centred on the icon, and the outline is always the same share of `r`, so an icon is the same
 * drawing at every size. Every shape gets the outline; nothing is left without one.
 */
class Pen {
  /** Outline width in px. */
  readonly ow: number;
  constructor(
    readonly g: G,
    readonly x: number,
    readonly y: number,
    readonly r: number,
    s: number,
  ) {
    this.ow = Math.max(r * 0.11, 1 * s);
  }
  /** Half the outline, in units of r: inset inner details by this so they tuck under the line. */
  get pad(): number {
    return this.ow / this.r / 2;
  }
  X(dx: number): number {
    return this.x + dx * this.r;
  }
  Y(dy: number): number {
    return this.y + dy * this.r;
  }
  private line(k = 1): void {
    this.g.lineStyle(this.ow * k, OL, 1);
  }
  /** A closed shape. `k` scales the outline (0 = none). */
  poly(pts: readonly Pt[], fill: number, k = 1): void {
    const p = pts.map(([dx, dy]) => ({ x: this.X(dx), y: this.Y(dy) }));
    this.g.fillStyle(fill, 1);
    this.g.fillPoints(p, true);
    if (k > 0) {
      this.line(k);
      this.g.strokePoints(p, true);
    }
  }
  rect(dx: number, dy: number, w: number, h: number, fill: number, rad = 0, k = 1): void {
    const r = this.r;
    const rr = Math.min(rad, w / 2, h / 2) * r;
    this.g.fillStyle(fill, 1);
    if (rr > 0) this.g.fillRoundedRect(this.X(dx), this.Y(dy), w * r, h * r, rr);
    else this.g.fillRect(this.X(dx), this.Y(dy), w * r, h * r);
    if (k > 0) {
      this.line(k);
      if (rr > 0) this.g.strokeRoundedRect(this.X(dx), this.Y(dy), w * r, h * r, rr);
      else this.g.strokeRect(this.X(dx), this.Y(dy), w * r, h * r);
    }
  }
  circle(dx: number, dy: number, rad: number, fill: number, k = 1, alpha = 1): void {
    this.g.fillStyle(fill, alpha);
    this.g.fillCircle(this.X(dx), this.Y(dy), rad * this.r);
    if (k > 0) {
      this.line(k);
      this.g.strokeCircle(this.X(dx), this.Y(dy), rad * this.r);
    }
  }
  ellipse(dx: number, dy: number, w: number, h: number, fill: number, k = 1): void {
    this.g.fillStyle(fill, 1);
    this.g.fillEllipse(this.X(dx), this.Y(dy), w * this.r, h * this.r);
    if (k > 0) {
      this.line(k);
      this.g.strokeEllipse(this.X(dx), this.Y(dy), w * this.r, h * this.r);
    }
  }
  /** A plain line (outline colour by default). `w` is in units of r. */
  seg(x0: number, y0: number, x1: number, y1: number, w?: number, color: number = OL): void {
    this.g.lineStyle(w === undefined ? this.ow : w * this.r, color, 1);
    this.g.lineBetween(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1));
  }
  /** A thick coloured line with the outline round it (a rod, a pole, a handle). */
  bar(x0: number, y0: number, x1: number, y1: number, w: number, color: number): void {
    this.seg(x0, y0, x1, y1, w + (this.ow * 2) / this.r);
    this.seg(x0, y0, x1, y1, w, color);
  }
  /** Several rods drawn as one outlined shape (outline pass for all, then the colour). */
  bars(
    list: readonly (readonly [number, number, number, number])[],
    w: number,
    color: number,
  ): void {
    for (const [a, b, c, d] of list) this.seg(a, b, c, d, w + (this.ow * 2) / this.r);
    for (const [a, b, c, d] of list) this.seg(a, b, c, d, w, color);
  }
  /** A thick coloured arc with the outline round it. */
  arcBar(
    dx: number,
    dy: number,
    rad: number,
    a0: number,
    a1: number,
    w: number,
    color: number,
  ): void {
    for (const [width, c] of [
      [w * this.r + this.ow * 2, OL],
      [w * this.r, color],
    ] as const) {
      this.g.lineStyle(width, c, 1);
      this.g.beginPath();
      this.g.arc(this.X(dx), this.Y(dy), rad * this.r, a0, a1, false);
      this.g.strokePath();
    }
  }
  /** A thin curved line (a smile, a wing). */
  arc(
    dx: number,
    dy: number,
    rad: number,
    a0: number,
    a1: number,
    color: number = OL,
    k = 0.8,
  ): void {
    this.g.lineStyle(this.ow * k, color, 1);
    this.g.beginPath();
    this.g.arc(this.X(dx), this.Y(dy), rad * this.r, a0, a1, false);
    this.g.strokePath();
  }
  /** Circles drawn as one outlined blob (a cloud, a heart, a flower). */
  blob(list: readonly (readonly [number, number, number])[], fill: number): void {
    const pad = this.ow / this.r;
    for (const [dx, dy, rad] of list) this.circle(dx, dy, rad + pad, OL, 0);
    for (const [dx, dy, rad] of list) this.circle(dx, dy, rad, fill, 0);
  }
  /** A dot with no outline (an eye, a button). */
  dot(dx: number, dy: number, rad: number, color: number = OL, alpha = 1): void {
    this.circle(dx, dy, rad, color, 0, alpha);
  }
  /** A pen for a smaller picture inside this one. */
  sub(dx: number, dy: number, k: number): Pen {
    return new Pen(this.g, this.X(dx), this.Y(dy), this.r * k, 0);
  }
}

/** The part of a circle between two heights, as a polygon (a mask band, a hair cap). */
function band(cx: number, cy: number, rad: number, y0: number, y1: number): Pt[] {
  const pts: Pt[] = [];
  const at = (yy: number, sign: number): Pt => {
    const d = Math.max(-rad, Math.min(rad, yy - cy));
    return [cx + sign * Math.sqrt(Math.max(0, rad * rad - d * d)), cy + d];
  };
  const n = 8;
  for (let i = 0; i <= n; i++) pts.push(at(y0 + ((y1 - y0) * i) / n, 1));
  for (let i = n; i >= 0; i--) pts.push(at(y0 + ((y1 - y0) * i) / n, -1));
  return pts;
}

/** A leaf or feather outline: pointed at both ends, `wid` across, turned to `angle`. */
function leaf(cx: number, cy: number, len: number, wid: number, angle: number): Pt[] {
  const pts: Pt[] = [];
  const n = 10;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const at = (t: number, sign: number): Pt => {
    const u = (t - 0.5) * len;
    const v = Math.sin(Math.PI * t) * (wid / 2) * sign;
    return [cx + u * ca - v * sa, cy + u * sa + v * ca];
  };
  for (let i = 0; i <= n; i++) pts.push(at(i / n, 1));
  for (let i = n - 1; i >= 1; i--) pts.push(at(i / n, -1));
  return pts;
}

/** Part of an ellipse outline as points (angles in radians, clockwise on screen). */
function ellipseArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  n = 12,
): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

function tyre(p: Pen, dx: number, dy: number, rad: number): void {
  p.circle(dx, dy, rad, 0x3a3d4a);
  p.circle(dx, dy, rad * 0.45, STEEL, 0.6);
}

function duckShape(p: Pen, color: number): void {
  // Tail and beak go behind the body and head.
  p.poly(
    [
      [-0.66, 0.08],
      [-0.9, -0.3],
      [-0.42, -0.1],
    ],
    color,
  );
  p.poly(
    [
      [0.72, -0.5],
      [1.14, -0.33],
      [0.72, -0.14],
    ],
    PALETTE.coneOrange,
  );
  p.ellipse(-0.1, 0.27, 1.5, 1.0, color);
  p.circle(0.35, -0.35, 0.45, color);
  p.arc(-0.22, 0.14, 0.36, Math.PI * 0.12, Math.PI * 0.88, darken(color, 0.25));
  p.dot(0.48, -0.44, 0.09);
  p.dot(0.45, -0.47, 0.03, 0xffffff);
}

function puppy(p: Pen): void {
  const fur = 0xd9a066;
  p.circle(0, 0, 0.75, fur);
  for (const i of [-1, 1]) p.ellipse(i * 0.72, -0.02, 0.38, 0.86, darken(fur, 0.35));
  p.ellipse(0, 0.3, 0.72, 0.48, 0xfff3e0, 0);
  p.ellipse(0.03, 0.5, 0.2, 0.22, PALETTE.donutPink, 0.6);
  p.dot(0, 0.18, 0.12);
  for (const i of [-1, 1]) {
    p.dot(i * 0.28, -0.13, 0.1);
    p.dot(i * 0.28 - 0.03, -0.16, 0.035, 0xffffff);
  }
  p.arc(-0.12, 0.26, 0.12, Math.PI * 0.1, Math.PI * 0.9, OL, 0.6);
  p.arc(0.12, 0.26, 0.12, Math.PI * 0.1, Math.PI * 0.9, OL, 0.6);
}

function sock(p: Pen): void {
  const shape: Pt[] = [
    [-0.36, -0.9],
    [0.26, -0.9],
    [0.26, 0.18],
    [0.72, 0.3],
    [0.88, 0.5],
    [0.84, 0.78],
    [0.6, 0.88],
    [-0.36, 0.88],
  ];
  const d = p.pad;
  p.poly(shape, 0xffffff);
  // Cuff, a stripe and the toe, tucked inside the outline.
  p.rect(-0.36 + d, -0.9 + d, 0.62 - d * 2, 0.24, PALETTE.fireRed, 0, 0);
  p.rect(-0.36 + d, -0.42, 0.62 - d * 2, 0.18, PALETTE.fireRed, 0, 0);
  p.poly(
    [
      [0.54, 0.26 + d * 1.6],
      [0.7 - d, 0.3 + d * 1.4],
      [0.88 - d * 1.3, 0.5],
      [0.84 - d, 0.78 - d],
      [0.6, 0.88 - d],
      [0.54, 0.88 - d],
    ],
    PALETTE.fireRed,
    0,
  );
}

function flag(p: Pen, color: number): void {
  p.poly(
    [
      [-0.5, -0.95],
      [0.82, -0.56],
      [-0.5, -0.14],
    ],
    color,
  );
  p.seg(-0.5, 1, -0.5, -0.95, 0.16);
  p.dot(-0.5, -0.98, 0.12);
}

function bike(p: Pen, color: number, scooter: boolean): void {
  if (scooter) {
    p.bars(
      [
        [-0.6, 0.5, 0.58, 0.5],
        [0.6, 0.5, 0.44, -0.68],
      ],
      0.15,
      color,
    );
    tyre(p, -0.62, 0.66, 0.24);
    tyre(p, 0.62, 0.66, 0.24);
    p.bar(0.2, -0.7, 0.66, -0.7, 0.12, DARK);
    return;
  }
  tyre(p, -0.6, 0.48, 0.38);
  tyre(p, 0.6, 0.48, 0.38);
  p.bars(
    [
      [-0.6, 0.48, -0.08, -0.16],
      [-0.08, -0.16, 0.6, 0.48],
      [-0.08, -0.16, 0.42, -0.52],
    ],
    0.13,
    color,
  );
  p.bar(0.24, -0.56, 0.62, -0.56, 0.1, DARK);
  p.rect(-0.4, -0.36, 0.44, 0.15, DARK, 0.07);
  p.circle(0.44, -0.76, 0.11, PALETTE.fireRed, 0.7);
}

function padlock(p: Pen): void {
  const d = p.pad;
  p.arcBar(0, -0.15, 0.42, Math.PI, 0, 0.2, 0x8a8fa0);
  p.rect(-0.66, -0.15, 1.32, 1.0, PALETTE.coinGold, 0.16);
  p.rect(-0.66 + d, 0.56, 1.32 - d * 2, 0.29 - d, darken(PALETTE.coinGold, 0.14), 0.1, 0);
  p.dot(0, 0.24, 0.14);
  p.seg(0, 0.26, 0, 0.54, 0.11);
}

function net(p: Pen): void {
  const { g, x, y, r } = p;
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(x, y, r);
  g.lineStyle(Math.max(1, r * 0.06), 0xffffff, 1);
  for (let i = -2; i <= 2; i++) {
    const k = (i / 2.5) * r;
    const h = Math.sqrt(Math.max(0, r * r - k * k)) * 0.96;
    g.lineBetween(x + k, y - h, x + k, y + h);
    g.lineBetween(x - h, y + k, x + h, y + k);
  }
  g.lineStyle(r * 0.1 + p.ow, OL, 1);
  g.strokeCircle(x, y, r * 0.95);
  g.lineStyle(r * 0.1, PALETTE.coneOrange, 1);
  g.strokeCircle(x, y, r * 0.95);
}

function badge(p: Pen, color: number = PALETTE.coinGold): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? 0.82 : 1;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  p.poly(pts, color);
  drawStar(p.g, p.x, p.y, p.r * 0.5, lighten(color, 0.45), p.ow * 0.7);
}

function flame(p: Pen, face: boolean): void {
  p.poly(
    [
      [0.05, -1],
      [0.3, -0.55],
      [0.56, -0.2],
      [0.7, 0.2],
      [0.62, 0.56],
      [0.34, 0.86],
      [-0.34, 0.86],
      [-0.62, 0.56],
      [-0.7, 0.2],
      [-0.62, -0.1],
      [-0.5, -0.44],
      [-0.3, -0.14],
      [-0.16, -0.52],
    ],
    PALETTE.coneOrange,
  );
  p.poly(
    [
      [0.02, -0.3],
      [0.3, 0.14],
      [0.4, 0.46],
      [0.24, 0.74],
      [-0.24, 0.74],
      [-0.4, 0.46],
      [-0.26, 0.1],
    ],
    PALETTE.coinGold,
    0,
  );
  if (face) {
    for (const i of [-1, 1]) {
      p.dot(i * 0.17, 0.4, 0.075);
      p.seg(i * 0.3, 0.2, i * 0.07, 0.28, 0.07);
    }
    p.arc(0, 0.72, 0.12, Math.PI * 1.15, Math.PI * 1.85, OL, 0.7);
  }
}

function kitten(p: Pen): void {
  const fur = 0xff9f45;
  for (const i of [-1, 1]) {
    p.poly(
      [
        [i * 0.7, -0.22],
        [i * 0.6, -0.96],
        [i * 0.14, -0.6],
      ],
      fur,
    );
    p.poly(
      [
        [i * 0.57, -0.42],
        [i * 0.55, -0.74],
        [i * 0.35, -0.57],
      ],
      PALETTE.donutPink,
      0,
    );
  }
  p.circle(0, 0, 0.72, fur);
  p.ellipse(0, 0.3, 0.6, 0.4, lighten(fur, 0.55), 0);
  for (const i of [-1, 1]) {
    p.dot(i * 0.27, -0.08, 0.095);
    p.dot(i * 0.27 - 0.03, -0.11, 0.03, 0xffffff);
    p.seg(i * 0.3, 0.24, i * 0.66, 0.16, 0.045);
    p.seg(i * 0.3, 0.32, i * 0.64, 0.36, 0.045);
    p.arc(i * 0.09, 0.28, 0.09, Math.PI * 0.1, Math.PI * 0.9, OL, 0.55);
  }
  p.poly(
    [
      [-0.09, 0.12],
      [0.09, 0.12],
      [0, 0.23],
    ],
    PALETTE.donutPink,
    0.5,
  );
}

function block(p: Pen, color: number): void {
  const top: Pt[] = [
    [0, -0.55],
    [0.8, -0.15],
    [0, 0.25],
    [-0.8, -0.15],
  ];
  const left: Pt[] = [top[3]!, top[2]!, [0, 0.85], [-0.8, 0.45]];
  const right: Pt[] = [top[2]!, top[1]!, [0.8, 0.45], [0, 0.85]];
  p.poly(top, lighten(color, 0.15), 0);
  p.poly(left, darken(color, 0.1), 0);
  p.poly(right, darken(color, 0.26), 0);
  p.seg(-0.8, -0.15, 0, 0.25, undefined);
  p.seg(0, 0.25, 0.8, -0.15, undefined);
  p.seg(0, 0.25, 0, 0.85, undefined);
  p.g.lineStyle(p.ow, OL, 1);
  p.g.strokePoints(
    (
      [
        [0, -0.55],
        [0.8, -0.15],
        [0.8, 0.45],
        [0, 0.85],
        [-0.8, 0.45],
        [-0.8, -0.15],
      ] as Pt[]
    ).map(([dx, dy]) => ({ x: p.X(dx), y: p.Y(dy) })),
    true,
  );
}

/** A little robber: striped shirt, round head, mask band that stays inside the head. */
function miniRobber(p: Pen, cx: number): void {
  const d = p.pad;
  p.rect(cx - 0.34, 0.05, 0.68, 0.78, 0xffffff, 0.16);
  for (const dy of [0.28, 0.52]) p.rect(cx - 0.34 + d, dy, 0.68 - d * 2, 0.12, OL, 0, 0);
  const hy = -0.3;
  const hr = 0.34;
  p.circle(cx, hy, hr, PALETTE.skin);
  // Hair and mask are slices of a slightly smaller circle, so they sit inside the outline.
  p.poly(band(cx, hy, hr - d, hy - hr, hy - 0.2), 0x6b4226, 0);
  p.poly(band(cx, hy, hr - d, hy - 0.12, hy + 0.06), OL, 0);
  for (const i of [-1, 1]) p.dot(cx + i * 0.13, hy - 0.03, 0.06, 0xffffff);
  p.arc(cx, hy + 0.1, 0.12, Math.PI * 0.15, Math.PI * 0.85, OL, 0.6);
}

/** A C-shaped spanner head: a disc with a slot cut toward `dir`. */
function spannerHead(cx: number, cy: number, rad: number, dir: number, slot: number): Pt[] {
  const th = Math.asin(slot / rad);
  const pts: Pt[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = dir + th + ((Math.PI * 2 - th * 2) * i) / n;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const px = -Math.sin(dir);
  const py = Math.cos(dir);
  const back = rad * 0.15;
  pts.push([cx - px * slot - Math.cos(dir) * back, cy - py * slot - Math.sin(dir) * back]);
  pts.push([cx + px * slot - Math.cos(dir) * back, cy + py * slot - Math.sin(dir) * back]);
  return pts;
}

/** Draw a named icon centred on (x, y) with half-size r. */
export function drawIcon(g: G, name: IconName, x: number, y: number, r: number, s: number): void {
  const p = new Pen(g, x, y, r, s);
  switch (name) {
    case 'star':
      drawStar(g, x, y + r * 0.04, r, PALETTE.coinGold, p.ow);
      return;
    case 'donut':
      drawDonut(g, x, y, r * 0.84, s, p.ow);
      return;
    case 'duck':
      duckShape(p.sub(-0.25, -0.04, 0.7), 0xffd23f);
      duckShape(p.sub(0.55, 0.42, 0.38), 0xfff08a);
      return;
    case 'rubberDuck':
      duckShape(p.sub(-0.05, 0, 0.85), 0xffd23f);
      return;
    case 'puppy':
      puppy(p);
      return;
    case 'sock':
      sock(p);
      return;
    case 'flag':
      flag(p, PALETTE.fireRed);
      return;
    case 'scooter':
      bike(p, PALETTE.getawayPurple, true);
      return;
    case 'bike':
      bike(p, PALETTE.policeBlue, false);
      return;
    case 'padlock':
      padlock(p);
      return;
    case 'net':
      net(p);
      return;
    case 'badge':
      badge(p);
      return;
    case 'coin':
      drawCoin(g, x, y, r, s, p.ow);
      return;
    case 'feather': {
      const a = -Math.PI / 2 + 0.35;
      p.seg(-0.22, 0.62, -0.36, 1.0, 0.07);
      p.poly(leaf(0.02, -0.1, 1.75, 0.62, a), 0x7ec8f2);
      p.seg(-0.24, 0.66, 0.3, -0.88, 0.05);
      for (const t of [-0.5, -0.1, 0.3]) {
        const cx = 0.02 + Math.cos(a) * t * 0.9;
        const cy = -0.1 + Math.sin(a) * t * 0.9;
        p.seg(cx, cy, cx - 0.2, cy - 0.02, 0.04, darken(0x7ec8f2, 0.3));
        p.seg(cx, cy, cx + 0.14, cy - 0.16, 0.04, darken(0x7ec8f2, 0.3));
      }
      return;
    }
    case 'trafficLight': {
      p.rect(-0.38, -1, 0.76, 2, 0x3a3d4a, 0.22);
      [PALETTE.fireRed, PALETTE.coinGold, PALETTE.grass].forEach((c, i) => {
        p.circle(0, -0.62 + i * 0.62, 0.22, c, 0.6);
        p.dot(-0.07, -0.69 + i * 0.62, 0.06, 0xffffff, 0.7);
      });
      return;
    }
    case 'magnifier': {
      p.bar(0.3, 0.3, 0.8, 0.8, 0.2, 0x9c6b3f);
      p.circle(-0.15, -0.15, 0.6, STEEL);
      p.circle(-0.15, -0.15, 0.44, 0xbfe6fa, 0.6);
      p.arc(-0.15, -0.15, 0.3, Math.PI * 1.1, Math.PI * 1.45, 0xffffff, 0.9);
      return;
    }
    case 'cap': {
      // Peak behind, then the crown, the band and the badge.
      const d = p.pad;
      p.poly(ellipseArc(0.04, 0.2, 0.9, 0.26, 0, Math.PI), 0x1d2b4f);
      const crown = { tl: 0.34 * r, tr: 0.34 * r, bl: 0.06 * r, br: 0.06 * r };
      g.fillStyle(PALETTE.policeBlue, 1);
      g.fillRoundedRect(p.X(-0.78), p.Y(-0.68), 1.56 * r, 0.9 * r, crown);
      g.lineStyle(p.ow, OL, 1);
      g.strokeRoundedRect(p.X(-0.78), p.Y(-0.68), 1.56 * r, 0.9 * r, crown);
      p.rect(-0.78 + d, 0.0, 1.56 - d * 2, 0.22 - d, 0x1d2b4f, 0, 0);
      p.rect(-0.56, -0.6 + d, 1.12, 0.1, lighten(PALETTE.policeBlue, 0.22), 0.05, 0);
      drawStar(g, x, p.Y(-0.28), r * 0.24, PALETTE.coinGold, p.ow * 0.6);
      return;
    }
    case 'twoRobbers':
      miniRobber(p, -0.44);
      miniRobber(p, 0.44);
      return;
    case 'flame':
      flame(p, true);
      return;
    case 'kitten':
      kitten(p);
      return;
    case 'toaster': {
      for (const dx of [-0.56, 0.1]) p.rect(dx, -0.88, 0.46, 0.7, PALETTE.dough, 0.12);
      for (const dx of [-0.56, 0.1])
        p.rect(dx + 0.07, -0.8, 0.32, 0.3, lighten(PALETTE.dough, 0.35), 0.08, 0);
      p.rect(-0.82, -0.36, 1.64, 1.04, STEEL, 0.24);
      p.rect(-0.66, -0.24, 1.32, 0.1, 0x8a8fa0, 0.05, 0);
      p.bar(0.9, 0.0, 0.9, 0.2, 0.1, DARK);
      for (const dx of [-0.6, 0.38]) p.rect(dx, 0.68, 0.22, 0.12, DARK, 0.04);
      return;
    }
    case 'ladder': {
      const list: [number, number, number, number][] = [
        [-0.36, 0.95, -0.36, -0.95],
        [0.36, 0.95, 0.36, -0.95],
      ];
      for (let i = 0; i < 5; i++) list.push([-0.36, -0.76 + i * 0.38, 0.36, -0.76 + i * 0.38]);
      p.bars(list, 0.13, STEEL);
      return;
    }
    case 'hose': {
      p.arcBar(-0.2, 0.15, 0.55, Math.PI * 0.3, Math.PI * 1.65, 0.2, PALETTE.fireRed);
      p.bar(0.04, -0.36, 0.4, -0.47, 0.22, STEEL);
      p.bar(0.46, -0.49, 0.56, -0.52, 0.3, PALETTE.coinGold);
      for (const [dx, dy, rr] of [
        [0.8, -0.62, 0.09],
        [0.92, -0.38, 0.07],
        [0.86, -0.86, 0.07],
      ] as const)
        p.circle(dx, dy, rr, 0x7ec8f2, 0.6);
      return;
    }
    case 'helmet': {
      // Brim behind, then the dome with a ridge and a gold shield.
      p.rect(-0.98, 0.1, 2.06, 0.28, PALETTE.fireRed, 0.14);
      p.poly(ellipseArc(0, 0.22, 0.76, 0.86, Math.PI, Math.PI * 2), PALETTE.fireRed);
      p.rect(-0.08, -0.6, 0.16, 0.3, darken(PALETTE.fireRed, 0.2), 0.08, 0);
      p.poly(
        [
          [-0.2, -0.26],
          [0.2, -0.26],
          [0.2, 0.0],
          [0, 0.14],
          [-0.2, 0.0],
        ],
        PALETTE.coinGold,
        0.6,
      );
      return;
    }
    case 'hardHat': {
      p.poly(ellipseArc(0, 0.2, 0.76, 0.86, Math.PI, Math.PI * 2), PALETTE.builderYellow);
      p.rect(-0.09, -0.62, 0.18, 0.8, lighten(PALETTE.builderYellow, 0.3), 0.09, 0.6);
      p.rect(-0.98, 0.12, 1.96, 0.26, PALETTE.builderYellow, 0.13);
      return;
    }
    case 'brick':
      block(p, PALETTE.builderYellow);
      return;
    case 'mixer': {
      p.rect(-0.92, 0.3, 1.8, 0.2, DARK, 0.06);
      tyre(p, -0.5, 0.62, 0.25);
      tyre(p, 0.56, 0.62, 0.25);
      p.rect(0.26, -0.32, 0.62, 0.66, PALETTE.builderYellow, 0.12);
      p.rect(0.46, -0.2, 0.3, 0.26, PALETTE.windowBlue, 0.05, 0.6);
      p.ellipse(-0.3, -0.1, 1.1, 0.82, 0xf4f6fa);
      p.seg(-0.5, -0.26, -0.3, 0.16, 0.1, PALETTE.coneOrange);
      p.seg(-0.2, -0.36, 0.0, 0.06, 0.1, PALETTE.coneOrange);
      return;
    }
    case 'blaster': {
      p.rect(-0.62, 0.16, 0.32, 0.56, darken(PALETTE.builderYellow, 0.12), 0.1);
      p.rect(-0.82, -0.34, 1.24, 0.62, PALETTE.builderYellow, 0.2);
      p.rect(0.3, -0.26, 0.2, 0.46, DARK, 0.06);
      p.rect(-0.6, -0.2, 0.5, 0.12, lighten(PALETTE.builderYellow, 0.45), 0.06, 0);
      block(p.sub(0.72, -0.1, 0.36), PALETTE.harborTeal);
      return;
    }
    case 'lighthouse': {
      const hw = (yy: number) => 0.3 + (0.16 * (yy + 0.5)) / 1.5;
      const slice = (y0: number, y1: number): Pt[] => [
        [-hw(y0), y0],
        [hw(y0), y0],
        [hw(y1), y1],
        [-hw(y1), y1],
      ];
      p.poly(slice(-0.5, 1), 0xffffff);
      const inset = (y0: number, y1: number): Pt[] => [
        [-hw(y0) + p.pad, y0],
        [hw(y0) - p.pad, y0],
        [hw(y1) - p.pad, y1],
        [-hw(y1) + p.pad, y1],
      ];
      p.poly(inset(-0.12, 0.16), PALETTE.fireRed, 0);
      p.poly(inset(0.46, 0.74), PALETTE.fireRed, 0);
      p.rect(-0.4, -0.58, 0.8, 0.12, DARK, 0.04);
      p.rect(-0.25, -0.88, 0.5, 0.32, PALETTE.coinGold);
      p.poly(
        [
          [-0.38, -0.86],
          [0.38, -0.86],
          [0, -1.12],
        ],
        PALETTE.fireRed,
      );
      return;
    }
    case 'boat': {
      p.seg(0, 0.12, 0, -0.98, 0.1);
      p.poly(
        [
          [0.08, -0.9],
          [0.78, 0],
          [0.08, 0],
        ],
        0xffffff,
      );
      p.poly(
        [
          [-0.06, -0.72],
          [-0.52, -0.04],
          [-0.06, -0.04],
        ],
        0xffe9a8,
      );
      p.poly(
        [
          [-1, 0.12],
          [1, 0.12],
          [0.66, 0.68],
          [-0.66, 0.68],
        ],
        PALETTE.fireRed,
      );
      p.seg(-0.78, 0.36, 0.78, 0.36, 0.07, 0xffffff);
      return;
    }
    case 'bridge': {
      // A stone arch over the water with a rail on top.
      p.rect(-1, 0.34, 2, 0.56, PALETTE.water, 0.1);
      p.seg(-0.3, 0.66, 0.3, 0.66, 0.05, 0xffffff);
      p.bars(
        [
          [-0.8, -0.5, 0.8, -0.5],
          [-0.6, -0.5, -0.6, -0.2],
          [0, -0.5, 0, -0.2],
          [0.6, -0.5, 0.6, -0.2],
        ],
        0.08,
        darken(PALETTE.trunk, 0.15),
      );
      p.poly(
        [
          [-1, -0.18],
          [1, -0.18],
          [1, 0.56],
          ...ellipseArc(0, 0.56, 0.6, 0.5, 0, -Math.PI, 12),
          [-1, 0.56],
        ],
        PALETTE.dough,
      );
      p.rect(-1 + p.pad, -0.18 + p.pad, 2 - p.pad * 2, 0.14, lighten(PALETTE.dough, 0.3), 0, 0);
      return;
    }
    case 'dock': {
      p.rect(-1, 0.06, 2, 0.84, PALETTE.water, 0.1);
      p.seg(0.5, 0.62, 0.8, 0.62, 0.05, 0xffffff);
      for (const px of [-0.78, -0.18, 0.42])
        p.rect(px, 0.02, 0.17, 0.72, darken(PALETTE.trunk, 0.2), 0.04);
      p.rect(-1, -0.24, 1.72, 0.32, PALETTE.trunk, 0.05);
      for (const px of [-0.58, -0.14, 0.3])
        p.seg(px, -0.2, px, 0.04, 0.045, darken(PALETTE.trunk, 0.3));
      return;
    }
    case 'firework': {
      const cols = [PALETTE.fireRed, PALETTE.coinGold, PALETTE.harborTeal, PALETTE.donutPink];
      const rays: [number, number, number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        rays.push([Math.cos(a) * 0.42, Math.sin(a) * 0.42, Math.cos(a) * 0.88, Math.sin(a) * 0.88]);
      }
      const pad = (p.ow * 2) / r;
      for (const [a, b, c, d] of rays) p.seg(a, b, c, d, 0.13 + pad);
      rays.forEach(([a, b, c, d], i) => p.seg(a, b, c, d, 0.13, cols[i % 4]!));
      drawStar(g, x, y, r * 0.32, PALETTE.coinGold, p.ow * 0.8);
      return;
    }
    case 'grill': {
      p.seg(-0.46, 0.3, -0.66, 0.96, 0.13);
      p.seg(0.46, 0.3, 0.66, 0.96, 0.13);
      p.poly(ellipseArc(0, -0.1, 0.8, 0.8, 0, Math.PI), 0x3a3d4a);
      for (const dx of [-0.32, 0.32]) p.ellipse(dx, -0.34, 0.5, 0.24, 0xa0522d, 0.7);
      p.rect(-0.88, -0.2, 1.76, 0.14, 0x8a8fa0, 0.07);
      return;
    }
    case 'cake': {
      p.rect(-0.8, -0.14, 1.6, 0.86, PALETTE.donutPink, 0.1);
      p.seg(-0.68, 0.3, 0.68, 0.3, 0.07, darken(PALETTE.donutPink, 0.18));
      for (const dx of [-0.46, 0, 0.46]) p.dot(dx, 0.0, 0.12, 0xffffff);
      p.rect(-0.84, -0.34, 1.68, 0.32, 0xffffff, 0.12);
      p.seg(0.02, -0.5, 0.12, -0.78, 0.05);
      p.circle(0, -0.5, 0.17, PALETTE.fireRed, 0.7);
      p.rect(-0.96, 0.72, 1.92, 0.12, STEEL, 0.06);
      return;
    }
    case 'parrot': {
      // Tail feathers behind, then body, wing, head, beak.
      p.poly(leaf(-0.12, 0.92, 0.5, 0.2, Math.PI / 2 + 0.3), PALETTE.policeBlue, 0.7);
      p.poly(leaf(0.1, 0.94, 0.5, 0.2, Math.PI / 2 - 0.2), PALETTE.fireRed, 0.7);
      p.ellipse(0, 0.22, 0.92, 1.3, PALETTE.grass);
      p.poly(leaf(-0.14, 0.3, 0.8, 0.4, Math.PI / 2 + 0.15), darken(PALETTE.grass, 0.25), 0.6);
      p.poly(
        [
          [0.28, -0.56],
          [0.7, -0.42],
          [0.5, -0.2],
          [0.28, -0.26],
        ],
        PALETTE.coinGold,
      );
      p.circle(0, -0.45, 0.42, PALETTE.fireRed);
      p.dot(0.12, -0.52, 0.12, 0xffffff);
      p.dot(0.15, -0.52, 0.065);
      return;
    }
    case 'tower': {
      p.rect(-0.3, -1, 0.6, 0.14, darken(PALETTE.harborTeal, 0.2), 0.03);
      p.rect(-0.48, -0.9, 0.96, 1.86, PALETTE.harborTeal, 0.05);
      p.rect(0.22, -0.84, 0.2, 1.74, darken(PALETTE.harborTeal, 0.14), 0, 0);
      for (let j = 0; j < 4; j++)
        for (const dx of [-0.32, 0.08])
          p.rect(dx, -0.76 + j * 0.4, 0.24, 0.24, PALETTE.windowBlue, 0.03, 0.5);
      p.rect(-0.12, 0.72, 0.24, 0.24, 0x1d5f8a, 0.03, 0.5);
      return;
    }
    case 'window': {
      p.rect(-0.8, -0.8, 1.6, 1.6, 0xffffff, 0.08);
      for (const dx of [-0.66, 0.06])
        for (const dy of [-0.66, 0.06]) {
          p.rect(dx, dy, 0.6, 0.6, PALETTE.windowBlue, 0.04, 0.6);
          p.seg(dx + 0.12, dy + 0.3, dx + 0.3, dy + 0.12, 0.05, 0xffffff);
        }
      p.rect(-0.92, 0.78, 1.84, 0.18, STEEL, 0.06);
      return;
    }
    case 'crane': {
      p.rect(-0.8, 0.82, 0.6, 0.16, DARK, 0.05);
      p.seg(0.6, -0.7, 0.6, -0.1, 0.05);
      p.bars(
        [
          [-0.5, 0.86, -0.5, -0.76],
          [-0.9, -0.76, 0.9, -0.76],
          [-0.5, -0.36, -0.1, -0.76],
        ],
        0.15,
        PALETTE.builderYellow,
      );
      p.rect(-0.98, -0.74, 0.3, 0.3, STEEL, 0.05);
      block(p.sub(0.6, 0.16, 0.32), PALETTE.harborTeal);
      return;
    }
    case 'grid': {
      const cols = [PALETTE.fireRed, PALETTE.builderYellow, PALETTE.harborTeal, 0xffffff];
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++)
          p.rect(-0.8 + i * 0.8, -0.8 + j * 0.8, 0.8, 0.8, cols[i + j * 2]!, 0, 0);
      p.seg(0, -0.8, 0, 0.8);
      p.seg(-0.8, 0, 0.8, 0);
      g.lineStyle(p.ow, OL, 1);
      g.strokeRoundedRect(p.X(-0.8), p.Y(-0.8), 1.6 * r, 1.6 * r, 0.06 * r);
      return;
    }
    case 'bucket': {
      p.arc(0, -0.5, 0.62, Math.PI * 1.08, Math.PI * 1.92, OL, 1);
      p.poly(
        [
          [-0.72, -0.5],
          [0.72, -0.5],
          [0.52, 0.82],
          [-0.52, 0.82],
        ],
        0xb8bcc8,
      );
      p.poly(
        [
          [0.3, -0.5],
          [0.72, -0.5],
          [0.52, 0.82],
          [0.24, 0.82],
        ],
        darken(0xb8bcc8, 0.12),
        0,
      );
      p.ellipse(0, -0.5, 1.44, 0.36, 0x8a8fa0);
      return;
    }
    case 'uniforms': {
      p.bar(-0.96, -0.72, 0.96, -0.72, 0.08, DARK);
      [PALETTE.policeBlue, PALETTE.fireRed, PALETTE.builderYellow].forEach((c, i) => {
        const cx = (i - 1) * 0.62;
        p.seg(cx, -0.72, cx, -0.5, 0.05);
        const k = 0.8;
        p.poly(
          (
            [
              [-0.3, -0.45],
              [-0.12, -0.52],
              [0, -0.42],
              [0.12, -0.52],
              [0.3, -0.45],
              [0.37, -0.18],
              [0.25, -0.12],
              [0.23, 0.72],
              [-0.23, 0.72],
              [-0.25, -0.12],
              [-0.37, -0.18],
            ] as Pt[]
          ).map(([dx, dy]): Pt => [cx + dx * k, dy]),
          c,
        );
      });
      return;
    }
    case 'balloon': {
      const g2 = p.g;
      g2.lineStyle(p.ow * 0.7, OL, 1);
      g2.beginPath();
      g2.moveTo(p.X(0), p.Y(0.5));
      g2.lineTo(p.X(0.1), p.Y(0.68));
      g2.lineTo(p.X(-0.04), p.Y(0.84));
      g2.lineTo(p.X(0.08), p.Y(1.0));
      g2.strokePath();
      p.poly(
        [
          [-0.1, 0.56],
          [0.1, 0.56],
          [0, 0.4],
        ],
        PALETTE.fireRed,
      );
      p.ellipse(0, -0.22, 1.12, 1.34, PALETTE.fireRed);
      p.ellipse(-0.2, -0.5, 0.2, 0.32, 0xffffff, 0);
      return;
    }
    case 'pizza': {
      p.poly(
        [
          [-0.78, -0.52],
          [0.78, -0.52],
          [0, 0.92],
        ],
        PALETTE.coinGold,
      );
      for (const [dx, dy] of [
        [-0.28, -0.18],
        [0.3, -0.14],
        [0, 0.3],
      ] as const)
        p.circle(dx, dy, 0.13, PALETTE.fireRed, 0.6);
      p.dot(0.02, -0.2, 0.05, 0x4fb544);
      p.dot(-0.12, 0.06, 0.05, 0x4fb544);
      p.bar(-0.8, -0.6, 0.8, -0.6, 0.2, PALETTE.dough);
      return;
    }
    case 'wrench': {
      const a = -Math.PI / 4;
      p.bar(-0.66, 0.66, 0.22, -0.22, 0.24, STEEL);
      p.poly(spannerHead(0.46, -0.46, 0.42, a, 0.16), STEEL);
      p.circle(-0.66, 0.66, 0.2, STEEL);
      p.dot(-0.66, 0.66, 0.08);
      return;
    }
    case 'teddy': {
      const fur = 0xb8794a;
      const pale = 0xf3d2a8;
      for (const i of [-1, 1]) {
        p.circle(i * 0.42, -0.64, 0.21, fur);
        p.dot(i * 0.42, -0.64, 0.1, pale);
        p.circle(i * 0.32, 0.78, 0.2, fur);
      }
      p.ellipse(0, 0.38, 1.06, 1.0, fur);
      for (const i of [-1, 1]) p.circle(i * 0.52, 0.24, 0.17, fur);
      p.ellipse(0, 0.46, 0.54, 0.5, pale, 0);
      p.circle(0, -0.3, 0.5, fur);
      p.ellipse(0, -0.16, 0.44, 0.32, pale, 0);
      for (const i of [-1, 1]) p.dot(i * 0.18, -0.4, 0.07);
      p.dot(0, -0.22, 0.08);
      p.arc(0, -0.16, 0.1, Math.PI * 0.15, Math.PI * 0.85, OL, 0.5);
      return;
    }
    case 'flower': {
      const heads: [number, number, number][] = [
        [-0.55, -0.3, PALETTE.donutPink],
        [0, -0.52, PALETTE.fireRed],
        [0.55, -0.3, PALETTE.coinGold],
      ];
      p.bars(
        heads.map(([hx, hy]) => [0, 0.95, hx * 0.9, hy + 0.2] as const),
        0.09,
        0x2f8a3a,
      );
      p.poly(leaf(0.2, 0.52, 0.5, 0.24, -0.5), 0x4fb544, 0.7);
      for (const [hx, hy, c] of heads) {
        const petals: [number, number, number][] = [];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          petals.push([hx + Math.cos(a) * 0.19, hy + Math.sin(a) * 0.19, 0.15]);
        }
        p.blob(petals, c);
        p.circle(hx, hy, 0.11, 0xffffff, 0.5);
      }
      return;
    }
    case 'iceCream': {
      p.poly(
        [
          [-0.42, -0.05],
          [0.42, -0.05],
          [0, 1.0],
        ],
        PALETTE.dough,
      );
      p.seg(-0.14, 0.05, 0.1, 0.55, 0.045, darken(PALETTE.dough, 0.25));
      p.seg(0.14, 0.05, -0.1, 0.55, 0.045, darken(PALETTE.dough, 0.25));
      p.blob(
        [
          [0, -0.4, 0.48],
          [-0.3, -0.04, 0.14],
          [0, 0.0, 0.14],
          [0.3, -0.04, 0.14],
        ],
        PALETTE.donutPink,
      );
      p.ellipse(-0.18, -0.58, 0.18, 0.12, 0xffffff, 0);
      p.circle(0.06, -0.86, 0.12, PALETTE.fireRed, 0.7);
      return;
    }
    case 'letter': {
      p.rect(-0.86, -0.56, 1.72, 1.12, 0xffffff, 0.08);
      p.seg(-0.8, 0.5, -0.2, -0.02, 0.05, 0xb8bcc8);
      p.seg(0.8, 0.5, 0.2, -0.02, 0.05, 0xb8bcc8);
      const g2 = p.g;
      g2.lineStyle(p.ow * 0.8, OL, 1);
      g2.beginPath();
      g2.moveTo(p.X(-0.82), p.Y(-0.5));
      g2.lineTo(p.X(0), p.Y(0.12));
      g2.lineTo(p.X(0.82), p.Y(-0.5));
      g2.strokePath();
      p.circle(0, 0.12, 0.15, PALETTE.fireRed, 0.7);
      return;
    }
    case 'fish': {
      p.poly(
        [
          [0.46, 0],
          [0.96, -0.42],
          [0.86, 0],
          [0.96, 0.42],
        ],
        PALETTE.coneOrange,
      );
      p.poly(
        [
          [-0.2, -0.36],
          [0.1, -0.62],
          [0.22, -0.3],
        ],
        darken(PALETTE.coneOrange, 0.12),
      );
      p.ellipse(-0.12, 0, 1.4, 0.82, PALETTE.coneOrange);
      p.arc(-0.1, 0, 0.3, -Math.PI * 0.35, Math.PI * 0.35, lighten(PALETTE.coneOrange, 0.5), 0.9);
      p.arc(0.14, 0, 0.3, -Math.PI * 0.3, Math.PI * 0.3, lighten(PALETTE.coneOrange, 0.5), 0.9);
      p.dot(-0.48, -0.08, 0.11, 0xffffff);
      p.dot(-0.5, -0.08, 0.06);
      p.arc(-0.66, 0.1, 0.12, Math.PI * 0.05, Math.PI * 0.6, OL, 0.6);
      return;
    }
    case 'book': {
      const d = p.pad;
      p.rect(-0.66, -0.82, 1.32, 1.64, PALETTE.policeBlue, 0.1);
      p.rect(-0.66 + d, -0.82 + d, 0.2, 1.64 - d * 2, darken(PALETTE.policeBlue, 0.25), 0.04, 0);
      p.rect(0.4, -0.72, 0.14, 1.44, 0xffffff, 0.03, 0);
      drawStar(g, p.X(0), p.Y(-0.06), r * 0.3, PALETTE.coinGold, p.ow * 0.6);
      return;
    }
    case 'present': {
      const d = p.pad;
      for (const i of [-1, 1]) p.ellipse(i * 0.28, -0.62, 0.5, 0.34, PALETTE.fireRed);
      p.rect(-0.74, -0.2, 1.48, 1.0, PALETTE.harborTeal, 0.06);
      p.rect(-0.13, -0.2, 0.26, 1.0 - d, PALETTE.fireRed, 0, 0);
      p.rect(-0.84, -0.46, 1.68, 0.3, lighten(PALETTE.harborTeal, 0.2), 0.06);
      p.rect(-0.13, -0.46 + d, 0.26, 0.3 - d * 2, PALETTE.fireRed, 0, 0);
      p.circle(0, -0.5, 0.13, PALETTE.fireRed, 0.7);
      return;
    }
    case 'apple': {
      p.bar(0.02, -0.4, 0.12, -0.82, 0.09, 0x6b4226);
      p.poly(leaf(0.4, -0.66, 0.5, 0.24, -0.25), PALETTE.grass, 0.7);
      p.blob(
        [
          [-0.25, 0.12, 0.55],
          [0.25, 0.12, 0.55],
        ],
        PALETTE.fireRed,
      );
      p.ellipse(-0.42, -0.08, 0.18, 0.28, 0xffffff, 0);
      return;
    }
    case 'shell': {
      const fan = ellipseArc(0, 0.5, 0.92, 1.1, Math.PI, Math.PI * 2, 14);
      p.poly(
        [
          [-0.26, 0.5],
          [-0.2, 0.78],
          [0.2, 0.78],
          [0.26, 0.5],
        ],
        darken(0xffd9c2, 0.12),
      );
      p.poly(fan, 0xffd9c2);
      for (const a of [-0.62, -0.32, 0, 0.32, 0.62])
        p.seg(a * 0.12, 0.44, a, -0.3 + Math.abs(a) * 0.5, 0.05, darken(0xffd9c2, 0.3));
      return;
    }
    case 'bed': {
      p.rect(-0.94, -0.62, 0.24, 1.4, PALETTE.trunk, 0.06);
      p.rect(0.76, -0.1, 0.18, 0.88, PALETTE.trunk, 0.06);
      p.rect(-0.72, 0.2, 1.5, 0.24, darken(PALETTE.trunk, 0.15), 0.04);
      p.rect(-0.72, -0.12, 1.5, 0.34, 0xffffff, 0.08);
      p.rect(-0.66, -0.4, 0.5, 0.3, 0xffffff, 0.12);
      p.rect(-0.1, -0.2, 0.88, 0.46, PALETTE.policeBlue, 0.1);
      p.seg(0.0, -0.06, 0.66, -0.06, 0.06, lighten(PALETTE.policeBlue, 0.35));
      return;
    }
    case 'table': {
      for (const dx of [-0.76, 0.6]) p.rect(dx, 0, 0.16, 0.86, darken(PALETTE.dough, 0.2), 0.04);
      p.rect(-0.7, 0.0, 1.4, 0.16, darken(PALETTE.dough, 0.1), 0.03);
      p.rect(-0.92, -0.28, 1.84, 0.28, PALETTE.dough, 0.08);
      return;
    }
    case 'lamp': {
      p.bar(0, -0.1, 0, 0.74, 0.1, 0x8a8fa0);
      p.poly(ellipseArc(0, 0.9, 0.44, 0.24, Math.PI, Math.PI * 2), DARK);
      p.poly(
        [
          [-0.3, -0.92],
          [0.3, -0.92],
          [0.58, -0.08],
          [-0.58, -0.08],
        ],
        PALETTE.coinGold,
      );
      p.poly(
        [
          [-0.26, -0.84],
          [-0.06, -0.84],
          [-0.22, -0.16],
          [-0.46, -0.16],
        ],
        lighten(PALETTE.coinGold, 0.4),
        0,
      );
      return;
    }
    case 'cushion': {
      for (const [dx, dy, c] of [
        [-0.34, -0.06, PALETTE.donutPink],
        [0.3, 0.1, PALETTE.harborTeal],
      ] as const) {
        p.rect(dx - 0.46, dy - 0.4, 0.92, 0.8, c, 0.26);
        p.rect(dx - 0.3, dy - 0.26, 0.4, 0.14, lighten(c, 0.4), 0.07, 0);
        p.dot(dx, dy + 0.04, 0.07, darken(c, 0.3));
      }
      return;
    }
    case 'bookshelf': {
      p.rect(-0.74, -0.92, 1.48, 1.84, PALETTE.trunk, 0.06);
      p.rect(-0.62, -0.8, 1.24, 1.6, darken(PALETTE.trunk, 0.3), 0, 0);
      const cols = [PALETTE.fireRed, PALETTE.policeBlue, PALETTE.coinGold, PALETTE.grass];
      for (let row = 0; row < 3; row++) {
        const floor = -0.3 + row * 0.55;
        for (let i = 0; i < 4; i++) {
          const h = 0.34 + ((i + row) % 3) * 0.05;
          p.rect(-0.58 + i * 0.29, floor - h, 0.24, h, cols[(i + row) % 4]!, 0.02, 0.5);
        }
        if (row < 2) p.rect(-0.62, floor, 1.24, 0.09, PALETTE.trunk, 0, 0);
      }
      return;
    }
    case 'tv': {
      p.rect(-0.12, 0.44, 0.24, 0.22, DARK, 0, 0.8);
      p.rect(-0.42, 0.62, 0.84, 0.14, DARK, 0.06);
      p.rect(-0.92, -0.7, 1.84, 1.2, 0x3a3d4a, 0.14);
      p.rect(-0.78, -0.57, 1.56, 0.94, PALETTE.windowBlue, 0.08, 0.5);
      drawStar(g, p.X(0), p.Y(-0.08), r * 0.26, PALETTE.coinGold, p.ow * 0.6);
      return;
    }
    case 'computer': {
      p.rect(-0.1, 0.24, 0.2, 0.26, STEEL, 0, 0.8);
      p.rect(-0.78, -0.82, 1.56, 1.1, 0xd9dce3, 0.1);
      p.rect(-0.64, -0.69, 1.28, 0.8, PALETTE.harborTeal, 0.05, 0.5);
      p.seg(-0.5, -0.5, -0.2, -0.5, 0.06, 0xffffff);
      p.seg(-0.5, -0.32, 0.1, -0.32, 0.06, 0xffffff);
      p.rect(-0.9, 0.46, 1.8, 0.34, 0xd9dce3, 0.08);
      for (const dx of [-0.6, -0.2, 0.2, 0.6]) p.dot(dx, 0.63, 0.06, 0x8a8fa0);
      return;
    }
    case 'fishTank': {
      p.rect(-0.9, -0.62, 1.8, 1.3, 0x9fd8f5, 0.06);
      p.rect(-0.84, 0.44, 1.68, 0.2, PALETTE.sand, 0, 0);
      p.rect(-0.9, -0.62, 1.8, 0.14, DARK, 0.04, 0);
      p.bar(0.5, 0.44, 0.44, 0.0, 0.07, 0x4fb544);
      p.bar(0.62, 0.44, 0.68, 0.12, 0.07, 0x4fb544);
      p.poly(
        [
          [-0.02, 0.04],
          [0.24, -0.14],
          [0.24, 0.22],
        ],
        PALETTE.coneOrange,
        0.6,
      );
      p.ellipse(-0.22, 0.04, 0.54, 0.32, PALETTE.coneOrange, 0.6);
      p.dot(-0.36, 0.0, 0.045);
      p.circle(-0.62, -0.26, 0.07, 0xffffff, 0.4);
      p.circle(-0.5, -0.4, 0.045, 0xffffff, 0.4);
      g.lineStyle(p.ow, OL, 1);
      g.strokeRoundedRect(p.X(-0.9), p.Y(-0.62), 1.8 * r, 1.3 * r, 0.06 * r);
      return;
    }
    case 'chefHat': {
      p.blob(
        [
          [-0.36, -0.26, 0.38],
          [0.36, -0.26, 0.38],
          [0, -0.52, 0.42],
        ],
        0xffffff,
      );
      p.arc(0.36, -0.26, 0.22, -0.3, 1.2, 0xd5d9e2, 0.8);
      p.rect(-0.56, -0.04, 1.12, 0.62, 0xffffff, 0.1);
      for (const dx of [-0.26, 0, 0.26]) p.seg(dx, 0.12, dx, 0.42, 0.05, 0xd5d9e2);
      return;
    }
    case 'pirateHat': {
      const top = ellipseArc(0, 0.3, 1.0, 1.0, Math.PI, Math.PI * 2, 14);
      const under = ellipseArc(0, 0.3, 1.0, 0.36, 0, -Math.PI, 10).map(([a, b]): Pt => [a, b]);
      p.poly([...top, ...under.slice(1, -1)], 0x3a3d52);
      p.arc(0, 0.86, 1.02, Math.PI * 1.22, Math.PI * 1.78, 0xffffff, 0.7);
      p.dot(0, -0.34, 0.17, 0xffffff);
      for (const i of [-1, 1]) p.dot(i * 0.06, -0.36, 0.04);
      p.bars(
        [
          [-0.2, -0.1, 0.2, 0.06],
          [0.2, -0.1, -0.2, 0.06],
        ],
        0.06,
        0xffffff,
      );
      return;
    }
    case 'duckHat':
      duckShape(p.sub(-0.05, 0.08, 0.8), 0xffd23f);
      return;
    case 'car': {
      p.rect(-0.52, -0.6, 1.04, 0.6, PALETTE.donutPink, 0.22);
      p.rect(-0.92, -0.14, 1.84, 0.58, PALETTE.donutPink, 0.2);
      for (const dx of [-0.4, 0.06]) p.rect(dx, -0.48, 0.34, 0.3, PALETTE.windowBlue, 0.06, 0.6);
      p.circle(0.84, 0.06, 0.09, 0xfff1a8, 0.6);
      tyre(p, -0.5, 0.46, 0.25);
      tyre(p, 0.5, 0.46, 0.25);
      return;
    }
    case 'paint': {
      p.arc(0, -0.2, 0.62, Math.PI * 1.1, Math.PI * 1.9, OL, 1);
      p.rect(-0.62, -0.2, 1.24, 0.98, 0xb8bcc8, 0.08);
      p.rect(0.3, -0.14, 0.26, 0.86, darken(0xb8bcc8, 0.12), 0, 0);
      const cs = [PALETTE.fireRed, PALETTE.harborTeal, PALETTE.getawayPurple, PALETTE.donutPink];
      cs.forEach((c, i) => p.circle(-0.45 + i * 0.3, -0.26, 0.17, c, 0.7));
      p.rect(-0.7, -0.2, 1.4, 0.16, 0x8a8fa0, 0.06);
      return;
    }
    case 'heart': {
      const pad = p.ow / r;
      p.poly(
        [
          [-0.72 - pad, -0.02],
          [0.72 + pad, -0.02],
          [0, 0.82 + pad * 1.3],
        ],
        OL,
        0,
      );
      p.circle(-0.33, -0.2, 0.42 + pad, OL, 0);
      p.circle(0.33, -0.2, 0.42 + pad, OL, 0);
      p.poly(
        [
          [-0.7, -0.02],
          [0.7, -0.02],
          [0, 0.8],
        ],
        PALETTE.fireRed,
        0,
      );
      p.circle(-0.33, -0.2, 0.42, PALETTE.fireRed, 0);
      p.circle(0.33, -0.2, 0.42, PALETTE.fireRed, 0);
      p.ellipse(-0.42, -0.34, 0.2, 0.16, 0xffffff, 0);
      return;
    }
    case 'home': {
      p.rect(0.3, -0.78, 0.2, 0.4, darken(PALETTE.fireRed, 0.2), 0.03);
      p.rect(-0.6, -0.12, 1.2, 0.94, PALETTE.coinGold, 0.04);
      p.poly(
        [
          [-0.88, -0.06],
          [0.88, -0.06],
          [0, -0.88],
        ],
        PALETTE.fireRed,
      );
      p.rect(-0.16, 0.3, 0.32, 0.52, PALETTE.trunk, 0.04, 0.7);
      p.rect(0.26, 0.14, 0.24, 0.24, PALETTE.windowBlue, 0.03, 0.6);
      p.dot(0.08, 0.58, 0.035);
      return;
    }
    case 'gear': {
      const pts: Pt[] = [];
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const w = Math.PI / teeth;
        for (const [da, rr] of [
          [-w * 0.55, 0.68],
          [-w * 0.34, 0.92],
          [w * 0.34, 0.92],
          [w * 0.55, 0.68],
        ] as const)
          pts.push([Math.cos(a + da) * rr, Math.sin(a + da) * rr]);
      }
      p.poly(pts, 0xa0a6b4);
      p.circle(0, 0, 0.27, 0xffffff, 0.8);
      return;
    }
    case 'hammer': {
      // Wooden handle, chunky steel head set square across it.
      p.bar(-0.6, 0.72, 0.16, -0.24, 0.2, 0xc98a4b);
      p.poly(
        [
          [-0.12, -0.74],
          [0.34, -0.98],
          [0.84, -0.36],
          [0.38, -0.12],
        ],
        STEEL,
      );
      p.poly(
        [
          [0.5, -0.5],
          [0.84, -0.36],
          [0.38, -0.12],
          [0.2, -0.34],
        ],
        darken(STEEL, 0.14),
        0,
      );
      g.lineStyle(p.ow, OL, 1);
      g.strokePoints(
        (
          [
            [-0.12, -0.74],
            [0.34, -0.98],
            [0.84, -0.36],
            [0.38, -0.12],
          ] as Pt[]
        ).map(([dx, dy]) => ({ x: p.X(dx), y: p.Y(dy) })),
        true,
      );
      return;
    }
    case 'trowel': {
      // Red handle, a pointed steel blade with a dab of mortar.
      p.bar(-0.24, 0.1, -0.02, -0.1, 0.09, DARK);
      p.bar(-0.82, 0.62, -0.3, 0.14, 0.2, PALETTE.fireRed);
      p.poly(
        [
          [-0.42, -0.16],
          [0.06, 0.32],
          [0.88, -0.82],
        ],
        STEEL,
      );
      p.ellipse(0.16, -0.2, 0.34, 0.26, 0x8a8fa0, 0);
      return;
    }
    case 'retry': {
      // A round "go again" arrow.
      p.arcBar(0, 0.06, 0.6, -Math.PI * 0.3, Math.PI * 1.15, 0.22, 0xffffff);
      p.poly(
        [
          [0.14, -0.94],
          [0.8, -0.56],
          [0.18, -0.14],
        ],
        0xffffff,
      );
      return;
    }
  }
}
