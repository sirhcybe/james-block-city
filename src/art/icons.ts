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
  | 'gear';

type G = Phaser.GameObjects.Graphics;
const OL = PALETTE.outline;

function outline(g: G, s: number, w = 3): void {
  g.lineStyle(w * s, OL, 1);
}

function duckShape(g: G, x: number, y: number, r: number, s: number, color: number): void {
  outline(g, s);
  g.fillStyle(color, 1);
  g.fillEllipse(x - r * 0.1, y + r * 0.25, r * 1.5, r * 1.0);
  g.strokeEllipse(x - r * 0.1, y + r * 0.25, r * 1.5, r * 1.0);
  g.fillCircle(x + r * 0.35, y - r * 0.35, r * 0.45);
  g.strokeCircle(x + r * 0.35, y - r * 0.35, r * 0.45);
  g.fillStyle(PALETTE.coneOrange, 1);
  g.fillTriangle(x + r * 0.75, y - r * 0.4, x + r * 1.1, y - r * 0.25, x + r * 0.75, y - r * 0.1);
  g.fillStyle(OL, 1);
  g.fillCircle(x + r * 0.45, y - r * 0.45, Math.max(1.5 * s, r * 0.08));
  g.fillStyle(darken(color, 0.15), 1);
  g.fillEllipse(x - r * 0.25, y + r * 0.2, r * 0.7, r * 0.4);
}

function puppy(g: G, x: number, y: number, r: number, s: number): void {
  const fur = 0xd9a066;
  outline(g, s);
  g.fillStyle(fur, 1);
  g.fillCircle(x, y, r * 0.75);
  g.strokeCircle(x, y, r * 0.75);
  g.fillStyle(darken(fur, 0.35), 1);
  g.fillEllipse(x - r * 0.72, y - r * 0.05, r * 0.38, r * 0.85);
  g.fillEllipse(x + r * 0.72, y - r * 0.05, r * 0.38, r * 0.85);
  g.strokeEllipse(x - r * 0.72, y - r * 0.05, r * 0.38, r * 0.85);
  g.strokeEllipse(x + r * 0.72, y - r * 0.05, r * 0.38, r * 0.85);
  g.fillStyle(0xfff3e0, 1);
  g.fillEllipse(x, y + r * 0.3, r * 0.75, r * 0.5);
  g.fillStyle(OL, 1);
  g.fillCircle(x - r * 0.28, y - r * 0.12, r * 0.1);
  g.fillCircle(x + r * 0.28, y - r * 0.12, r * 0.1);
  g.fillCircle(x, y + r * 0.18, r * 0.13);
  g.fillStyle(PALETTE.donutPink, 1);
  g.fillEllipse(x + r * 0.05, y + r * 0.48, r * 0.2, r * 0.22);
}

function sock(g: G, x: number, y: number, r: number, s: number): void {
  outline(g, s);
  const pts = [
    { x: x - r * 0.35, y: y - r * 0.9 },
    { x: x + r * 0.25, y: y - r * 0.9 },
    { x: x + r * 0.25, y: y + r * 0.2 },
    { x: x + r * 0.85, y: y + r * 0.35 },
    { x: x + r * 0.85, y: y + r * 0.85 },
    { x: x - r * 0.35, y: y + r * 0.85 },
  ];
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts, true);
  g.fillStyle(PALETTE.fireRed, 1);
  g.fillRect(x - r * 0.35, y - r * 0.9, r * 0.6, r * 0.25);
  g.fillRect(x - r * 0.35, y - r * 0.4, r * 0.6, r * 0.2);
  g.strokePoints(pts, true);
}

function flag(g: G, x: number, y: number, r: number, s: number, color: number): void {
  outline(g, s);
  g.lineBetween(x - r * 0.5, y + r, x - r * 0.5, y - r);
  g.fillStyle(color, 1);
  const f = [
    { x: x - r * 0.5, y: y - r },
    { x: x + r * 0.8, y: y - r * 0.6 },
    { x: x - r * 0.5, y: y - r * 0.15 },
  ];
  g.fillPoints(f, true);
  g.strokePoints(f, true);
}

function wheel(g: G, x: number, y: number, r: number, s: number): void {
  g.fillStyle(OL, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xc9ced8, 1);
  g.fillCircle(x, y, r * 0.45);
  void s;
}

function bike(
  g: G,
  x: number,
  y: number,
  r: number,
  s: number,
  color: number,
  scooter: boolean,
): void {
  wheel(g, x - r * 0.6, y + r * 0.45, r * 0.38, s);
  wheel(g, x + r * 0.6, y + r * 0.45, r * 0.38, s);
  outline(g, s, 4);
  g.lineStyle(5 * s, color, 1);
  if (scooter) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - r * 0.7, y + r * 0.05, r * 1.3, r * 0.3, r * 0.1);
    g.lineBetween(x + r * 0.55, y + r * 0.2, x + r * 0.45, y - r * 0.75);
    g.lineBetween(x + r * 0.3, y - r * 0.75, x + r * 0.65, y - r * 0.75);
  } else {
    g.lineBetween(x - r * 0.6, y + r * 0.45, x - r * 0.05, y - r * 0.15);
    g.lineBetween(x - r * 0.05, y - r * 0.15, x + r * 0.6, y + r * 0.45);
    g.lineBetween(x - r * 0.05, y - r * 0.15, x + r * 0.4, y - r * 0.55);
    g.lineBetween(x + r * 0.25, y - r * 0.55, x + r * 0.6, y - r * 0.55);
    g.fillStyle(OL, 1);
    g.fillRoundedRect(x - r * 0.35, y - r * 0.32, r * 0.4, r * 0.14, r * 0.05);
    // Little light on the handlebars.
    g.fillStyle(PALETTE.fireRed, 1);
    g.fillCircle(x + r * 0.42, y - r * 0.72, r * 0.1);
  }
}

function padlock(g: G, x: number, y: number, r: number, s: number): void {
  outline(g, s, 4);
  g.lineStyle(6 * s, 0x8a8fa0, 1);
  g.beginPath();
  g.arc(x, y - r * 0.15, r * 0.42, Math.PI, 0, false);
  g.strokePath();
  g.fillStyle(PALETTE.coinGold, 1);
  g.fillRoundedRect(x - r * 0.65, y - r * 0.15, r * 1.3, r * 1.0, r * 0.15);
  outline(g, s);
  g.strokeRoundedRect(x - r * 0.65, y - r * 0.15, r * 1.3, r * 1.0, r * 0.15);
  g.fillStyle(OL, 1);
  g.fillCircle(x, y + r * 0.25, r * 0.13);
  g.fillRect(x - r * 0.05, y + r * 0.25, r * 0.1, r * 0.3);
}

function net(g: G, x: number, y: number, r: number, s: number): void {
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(x, y, r);
  g.lineStyle(2.5 * s, 0xffffff, 1);
  for (let i = -2; i <= 2; i++) {
    const k = (i / 2.5) * r;
    const h = Math.sqrt(Math.max(0, r * r - k * k));
    g.lineBetween(x + k, y - h, x + k, y + h);
    g.lineBetween(x - h, y + k, x + h, y + k);
  }
  g.lineStyle(4 * s, PALETTE.coneOrange, 1);
  g.strokeCircle(x, y, r);
}

function badge(g: G, x: number, y: number, r: number, s: number, color = PALETTE.coinGold): void {
  outline(g, s);
  g.fillStyle(color, 1);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.82 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
  drawStar(g, x, y, r * 0.5, lighten(color, 0.4), 2 * s);
}

function flame(g: G, x: number, y: number, r: number, s: number, face: boolean): void {
  outline(g, s);
  g.fillStyle(PALETTE.coneOrange, 1);
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.55, y - r * 0.1);
  g.lineTo(x + r * 0.7, y + r * 0.45);
  g.lineTo(x + r * 0.35, y + r * 0.85);
  g.lineTo(x - r * 0.35, y + r * 0.85);
  g.lineTo(x - r * 0.7, y + r * 0.45);
  g.lineTo(x - r * 0.45, y - r * 0.2);
  g.lineTo(x - r * 0.2, y + r * 0.05);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(PALETTE.coinGold, 1);
  g.fillEllipse(x, y + r * 0.45, r * 0.75, r * 0.65);
  if (face) {
    g.fillStyle(OL, 1);
    g.fillCircle(x - r * 0.18, y + r * 0.35, r * 0.07);
    g.fillCircle(x + r * 0.18, y + r * 0.35, r * 0.07);
    g.lineStyle(2 * s, OL, 1);
    g.lineBetween(x - r * 0.3, y + r * 0.2, x - r * 0.08, y + r * 0.27);
    g.lineBetween(x + r * 0.3, y + r * 0.2, x + r * 0.08, y + r * 0.27);
  }
}

function kitten(g: G, x: number, y: number, r: number, s: number): void {
  const fur = 0xff9f45;
  outline(g, s);
  g.fillStyle(fur, 1);
  g.fillTriangle(x - r * 0.7, y - r * 0.2, x - r * 0.55, y - r * 0.95, x - r * 0.15, y - r * 0.55);
  g.fillTriangle(x + r * 0.7, y - r * 0.2, x + r * 0.55, y - r * 0.95, x + r * 0.15, y - r * 0.55);
  g.fillCircle(x, y, r * 0.72);
  g.strokeCircle(x, y, r * 0.72);
  g.fillStyle(OL, 1);
  g.fillCircle(x - r * 0.26, y - r * 0.08, r * 0.09);
  g.fillCircle(x + r * 0.26, y - r * 0.08, r * 0.09);
  g.fillStyle(PALETTE.donutPink, 1);
  g.fillTriangle(x - r * 0.08, y + r * 0.12, x + r * 0.08, y + r * 0.12, x, y + r * 0.22);
  g.lineStyle(1.5 * s, OL, 1);
  g.lineBetween(x - r * 0.25, y + r * 0.22, x - r * 0.75, y + r * 0.15);
  g.lineBetween(x + r * 0.25, y + r * 0.22, x + r * 0.75, y + r * 0.15);
}

function block(g: G, x: number, y: number, r: number, s: number, color: number): void {
  outline(g, s);
  const top = [
    { x, y: y - r * 0.55 },
    { x: x + r * 0.8, y: y - r * 0.15 },
    { x, y: y + r * 0.25 },
    { x: x - r * 0.8, y: y - r * 0.15 },
  ];
  const left = [top[3]!, top[2]!, { x, y: y + r * 0.85 }, { x: x - r * 0.8, y: y + r * 0.45 }];
  const right = [top[2]!, top[1]!, { x: x + r * 0.8, y: y + r * 0.45 }, { x, y: y + r * 0.85 }];
  g.fillStyle(lighten(color, 0.15), 1);
  g.fillPoints(top, true);
  g.fillStyle(darken(color, 0.12), 1);
  g.fillPoints(left, true);
  g.fillStyle(darken(color, 0.25), 1);
  g.fillPoints(right, true);
  for (const p of [top, left, right]) g.strokePoints(p, true);
}

/** Draw a named icon centred on (x, y) with half-size r. */
export function drawIcon(g: G, name: IconName, x: number, y: number, r: number, s: number): void {
  switch (name) {
    case 'star':
      drawStar(g, x, y, r, PALETTE.coinGold, 3 * s);
      return;
    case 'donut':
      drawDonut(g, x, y, r * 0.8, s);
      return;
    case 'duck':
      duckShape(g, x - r * 0.25, y, r * 0.7, s, 0xffd23f);
      duckShape(g, x + r * 0.55, y + r * 0.4, r * 0.38, s, 0xfff08a);
      return;
    case 'rubberDuck':
      duckShape(g, x, y, r * 0.85, s, 0xffd23f);
      return;
    case 'puppy':
      puppy(g, x, y, r, s);
      return;
    case 'sock':
      sock(g, x, y, r, s);
      return;
    case 'flag':
      flag(g, x, y, r, s, PALETTE.fireRed);
      return;
    case 'scooter':
      bike(g, x, y, r, s, PALETTE.getawayPurple, true);
      return;
    case 'bike':
      bike(g, x, y, r, s, PALETTE.policeBlue, false);
      return;
    case 'padlock':
      padlock(g, x, y, r, s);
      return;
    case 'net':
      net(g, x, y, r, s);
      return;
    case 'badge':
      badge(g, x, y, r, s);
      return;
    case 'coin':
      drawCoin(g, x, y, r, s);
      return;
    case 'feather': {
      outline(g, s);
      g.fillStyle(0x7ec8f2, 1);
      g.fillEllipse(x, y, r * 0.55, r * 1.7);
      g.strokeEllipse(x, y, r * 0.55, r * 1.7);
      g.lineBetween(x, y - r * 0.85, x, y + r);
      return;
    }
    case 'trafficLight': {
      g.fillStyle(0x3a3d4a, 1);
      g.fillRoundedRect(x - r * 0.35, y - r, r * 0.7, r * 2, r * 0.2);
      outline(g, s);
      g.strokeRoundedRect(x - r * 0.35, y - r, r * 0.7, r * 2, r * 0.2);
      [PALETTE.fireRed, PALETTE.coinGold, PALETTE.grass].forEach((c, i) => {
        g.fillStyle(c, 1);
        g.fillCircle(x, y - r * 0.6 + i * r * 0.6, r * 0.22);
      });
      return;
    }
    case 'magnifier': {
      g.fillStyle(0xbfe6fa, 1);
      g.fillCircle(x - r * 0.15, y - r * 0.15, r * 0.55);
      g.lineStyle(6 * s, OL, 1);
      g.lineBetween(x + r * 0.25, y + r * 0.25, x + r * 0.8, y + r * 0.8);
      outline(g, s, 4);
      g.strokeCircle(x - r * 0.15, y - r * 0.15, r * 0.55);
      return;
    }
    case 'cap': {
      outline(g, s);
      g.fillStyle(PALETTE.policeBlue, 1);
      g.fillRoundedRect(x - r * 0.7, y - r * 0.6, r * 1.4, r * 0.8, r * 0.3);
      g.strokeRoundedRect(x - r * 0.7, y - r * 0.6, r * 1.4, r * 0.8, r * 0.3);
      g.fillStyle(OL, 1);
      g.fillEllipse(x, y + r * 0.25, r * 1.8, r * 0.35);
      drawStar(g, x, y - r * 0.2, r * 0.25, PALETTE.coinGold, 1.5 * s);
      return;
    }
    case 'twoRobbers': {
      for (const dx of [-0.42, 0.42]) {
        const cx = x + dx * r;
        g.fillStyle(0xffffff, 1);
        outline(g, s);
        g.fillRoundedRect(cx - r * 0.35, y + r * 0.05, r * 0.7, r * 0.75, r * 0.15);
        g.strokeRoundedRect(cx - r * 0.35, y + r * 0.05, r * 0.7, r * 0.75, r * 0.15);
        g.fillStyle(OL, 1);
        g.fillRect(cx - r * 0.33, y + r * 0.25, r * 0.66, r * 0.12);
        g.fillRect(cx - r * 0.33, y + r * 0.5, r * 0.66, r * 0.12);
        g.fillStyle(PALETTE.skin, 1);
        g.fillCircle(cx, y - r * 0.3, r * 0.33);
        outline(g, s);
        g.strokeCircle(cx, y - r * 0.3, r * 0.33);
        g.fillStyle(OL, 1);
        g.fillRect(cx - r * 0.3, y - r * 0.4, r * 0.6, r * 0.14);
      }
      return;
    }
    case 'flame':
      flame(g, x, y, r, s, true);
      return;
    case 'kitten':
      kitten(g, x, y, r, s);
      return;
    case 'toaster': {
      outline(g, s);
      g.fillStyle(0xc9ced8, 1);
      g.fillRoundedRect(x - r * 0.8, y - r * 0.35, r * 1.6, r, r * 0.25);
      g.strokeRoundedRect(x - r * 0.8, y - r * 0.35, r * 1.6, r, r * 0.25);
      g.fillStyle(PALETTE.dough, 1);
      g.fillRoundedRect(x - r * 0.55, y - r * 0.85, r * 0.45, r * 0.6, r * 0.12);
      g.fillRoundedRect(x + r * 0.1, y - r * 0.85, r * 0.45, r * 0.6, r * 0.12);
      g.strokeRoundedRect(x - r * 0.55, y - r * 0.85, r * 0.45, r * 0.6, r * 0.12);
      g.strokeRoundedRect(x + r * 0.1, y - r * 0.85, r * 0.45, r * 0.6, r * 0.12);
      return;
    }
    case 'ladder': {
      g.lineStyle(5 * s, 0xc9ced8, 1);
      g.lineBetween(x - r * 0.35, y + r, x - r * 0.35, y - r);
      g.lineBetween(x + r * 0.35, y + r, x + r * 0.35, y - r);
      for (let i = 0; i < 5; i++) {
        const yy = y - r * 0.8 + i * r * 0.4;
        g.lineBetween(x - r * 0.35, yy, x + r * 0.35, yy);
      }
      return;
    }
    case 'hose': {
      g.lineStyle(7 * s, PALETTE.fireRed, 1);
      g.beginPath();
      g.arc(x - r * 0.2, y + r * 0.1, r * 0.55, Math.PI * 0.2, Math.PI * 1.6, false);
      g.strokePath();
      g.fillStyle(0xc9ced8, 1);
      g.fillRect(x + r * 0.05, y - r * 0.55, r * 0.5, r * 0.25);
      g.fillStyle(0x7ec8f2, 1);
      for (let i = 0; i < 3; i++)
        g.fillCircle(x + r * 0.7 + i * r * 0.12, y - r * 0.5 - i * r * 0.15, r * 0.1);
      return;
    }
    case 'helmet': {
      outline(g, s);
      g.fillStyle(PALETTE.fireRed, 1);
      g.beginPath();
      g.arc(x, y + r * 0.2, r * 0.75, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillEllipse(x + r * 0.2, y + r * 0.25, r * 1.9, r * 0.3);
      g.strokeEllipse(x + r * 0.2, y + r * 0.25, r * 1.9, r * 0.3);
      badge(g, x, y - r * 0.15, r * 0.3, s);
      return;
    }
    case 'hardHat': {
      outline(g, s);
      g.fillStyle(PALETTE.builderYellow, 1);
      g.beginPath();
      g.arc(x, y + r * 0.2, r * 0.75, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillRect(x - r * 0.95, y + r * 0.15, r * 1.9, r * 0.22);
      g.strokeRect(x - r * 0.95, y + r * 0.15, r * 1.9, r * 0.22);
      g.lineBetween(x, y - r * 0.55, x, y + r * 0.15);
      return;
    }
    case 'brick':
      block(g, x, y, r, s, PALETTE.builderYellow);
      return;
    case 'mixer': {
      wheel(g, x - r * 0.5, y + r * 0.6, r * 0.25, s);
      wheel(g, x + r * 0.55, y + r * 0.6, r * 0.25, s);
      outline(g, s);
      g.fillStyle(PALETTE.builderYellow, 1);
      g.fillRoundedRect(x + r * 0.25, y - r * 0.25, r * 0.6, r * 0.75, r * 0.12);
      g.strokeRoundedRect(x + r * 0.25, y - r * 0.25, r * 0.6, r * 0.75, r * 0.12);
      g.fillStyle(0xf4f6fa, 1);
      g.fillEllipse(x - r * 0.25, y - r * 0.05, r * 1.1, r * 0.8);
      g.strokeEllipse(x - r * 0.25, y - r * 0.05, r * 1.1, r * 0.8);
      g.lineStyle(3 * s, PALETTE.coneOrange, 1);
      g.lineBetween(x - r * 0.55, y - r * 0.3, x - r * 0.05, y + r * 0.25);
      g.lineBetween(x - r * 0.25, y - r * 0.4, x + r * 0.2, y + r * 0.1);
      return;
    }
    case 'blaster': {
      outline(g, s);
      g.fillStyle(PALETTE.builderYellow, 1);
      g.fillRoundedRect(x - r * 0.8, y - r * 0.3, r * 1.2, r * 0.6, r * 0.2);
      g.strokeRoundedRect(x - r * 0.8, y - r * 0.3, r * 1.2, r * 0.6, r * 0.2);
      g.fillRoundedRect(x - r * 0.6, y + r * 0.2, r * 0.3, r * 0.5, r * 0.1);
      g.strokeRoundedRect(x - r * 0.6, y + r * 0.2, r * 0.3, r * 0.5, r * 0.1);
      block(g, x + r * 0.65, y - r * 0.1, r * 0.4, s, PALETTE.harborTeal);
      return;
    }
    case 'lighthouse': {
      outline(g, s);
      g.fillStyle(0xffffff, 1);
      const body = [
        { x: x - r * 0.3, y: y - r * 0.5 },
        { x: x + r * 0.3, y: y - r * 0.5 },
        { x: x + r * 0.45, y: y + r },
        { x: x - r * 0.45, y: y + r },
      ];
      g.fillPoints(body, true);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillRect(x - r * 0.36, y - r * 0.1, r * 0.72, r * 0.25);
      g.fillRect(x - r * 0.42, y + r * 0.45, r * 0.84, r * 0.25);
      g.strokePoints(body, true);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillRect(x - r * 0.25, y - r * 0.85, r * 0.5, r * 0.35);
      g.strokeRect(x - r * 0.25, y - r * 0.85, r * 0.5, r * 0.35);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillTriangle(x - r * 0.35, y - r * 0.85, x + r * 0.35, y - r * 0.85, x, y - r * 1.1);
      return;
    }
    case 'boat': {
      outline(g, s);
      g.fillStyle(PALETTE.fireRed, 1);
      const hull = [
        { x: x - r, y: y + r * 0.1 },
        { x: x + r, y: y + r * 0.1 },
        { x: x + r * 0.65, y: y + r * 0.65 },
        { x: x - r * 0.65, y: y + r * 0.65 },
      ];
      g.fillPoints(hull, true);
      g.strokePoints(hull, true);
      g.lineBetween(x, y + r * 0.1, x, y - r);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(x + r * 0.05, y - r * 0.9, x + r * 0.75, y, x + r * 0.05, y);
      g.lineStyle(2 * s, OL, 1);
      g.strokeTriangle(x + r * 0.05, y - r * 0.9, x + r * 0.75, y, x + r * 0.05, y);
      return;
    }
    case 'bridge': {
      g.fillStyle(PALETTE.water, 1);
      g.fillRect(x - r, y + r * 0.3, r * 2, r * 0.6);
      outline(g, s, 4);
      g.lineStyle(6 * s, PALETTE.trunk, 1);
      g.beginPath();
      g.arc(x, y + r * 0.9, r * 0.9, Math.PI * 1.1, Math.PI * 1.9, false);
      g.strokePath();
      g.lineBetween(x - r, y + r * 0.1, x + r, y + r * 0.1);
      return;
    }
    case 'dock': {
      g.fillStyle(PALETTE.water, 1);
      g.fillRect(x - r, y, r * 2, r * 0.9);
      outline(g, s);
      g.fillStyle(PALETTE.trunk, 1);
      g.fillRect(x - r, y - r * 0.2, r * 1.5, r * 0.3);
      g.strokeRect(x - r, y - r * 0.2, r * 1.5, r * 0.3);
      for (const px of [-0.8, -0.2, 0.4]) {
        g.fillRect(x + px * r, y + r * 0.1, r * 0.15, r * 0.6);
        g.strokeRect(x + px * r, y + r * 0.1, r * 0.15, r * 0.6);
      }
      return;
    }
    case 'firework': {
      const cols = [PALETTE.fireRed, PALETTE.coinGold, PALETTE.harborTeal, PALETTE.donutPink];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineStyle(4 * s, cols[i % 4]!, 1);
        g.lineBetween(
          x + Math.cos(a) * r * 0.25,
          y + Math.sin(a) * r * 0.25,
          x + Math.cos(a) * r * 0.9,
          y + Math.sin(a) * r * 0.9,
        );
      }
      drawStar(g, x, y, r * 0.3, PALETTE.coinGold, 2 * s);
      return;
    }
    case 'grill': {
      outline(g, s);
      g.fillStyle(OL, 1);
      g.lineBetween(x - r * 0.5, y + r * 0.2, x - r * 0.7, y + r);
      g.lineBetween(x + r * 0.5, y + r * 0.2, x + r * 0.7, y + r);
      g.fillStyle(0x3a3d4a, 1);
      g.beginPath();
      g.arc(x, y - r * 0.1, r * 0.8, 0, Math.PI, false);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(0xa0522d, 1);
      g.fillEllipse(x - r * 0.3, y - r * 0.25, r * 0.5, r * 0.2);
      g.fillEllipse(x + r * 0.3, y - r * 0.25, r * 0.5, r * 0.2);
      return;
    }
    case 'cake': {
      outline(g, s);
      g.fillStyle(PALETTE.donutPink, 1);
      g.fillRect(x - r * 0.8, y - r * 0.1, r * 1.6, r * 0.8);
      g.strokeRect(x - r * 0.8, y - r * 0.1, r * 1.6, r * 0.8);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - r * 0.8, y - r * 0.25, r * 1.6, r * 0.25);
      g.strokeRect(x - r * 0.8, y - r * 0.25, r * 1.6, r * 0.25);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillCircle(x, y - r * 0.45, r * 0.18);
      return;
    }
    case 'parrot': {
      outline(g, s);
      g.fillStyle(PALETTE.grass, 1);
      g.fillEllipse(x, y + r * 0.2, r * 0.9, r * 1.3);
      g.strokeEllipse(x, y + r * 0.2, r * 0.9, r * 1.3);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillCircle(x, y - r * 0.45, r * 0.4);
      g.strokeCircle(x, y - r * 0.45, r * 0.4);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillTriangle(
        x + r * 0.3,
        y - r * 0.5,
        x + r * 0.65,
        y - r * 0.35,
        x + r * 0.3,
        y - r * 0.25,
      );
      g.fillStyle(OL, 1);
      g.fillCircle(x + r * 0.1, y - r * 0.55, r * 0.08);
      return;
    }
    case 'tower': {
      outline(g, s);
      g.fillStyle(PALETTE.harborTeal, 1);
      g.fillRect(x - r * 0.45, y - r, r * 0.9, r * 2);
      g.strokeRect(x - r * 0.45, y - r, r * 0.9, r * 2);
      g.fillStyle(PALETTE.windowBlue, 1);
      for (let j = 0; j < 4; j++)
        for (const dx of [-0.22, 0.12])
          g.fillRect(x + dx * r, y - r * 0.85 + j * r * 0.45, r * 0.15, r * 0.25);
      return;
    }
    case 'window': {
      outline(g, s);
      g.fillStyle(PALETTE.windowBlue, 1);
      g.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      g.strokeRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      g.lineBetween(x, y - r * 0.7, x, y + r * 0.7);
      g.lineBetween(x - r * 0.7, y, x + r * 0.7, y);
      return;
    }
    case 'crane': {
      g.lineStyle(5 * s, PALETTE.builderYellow, 1);
      g.lineBetween(x - r * 0.5, y + r, x - r * 0.5, y - r * 0.8);
      g.lineBetween(x - r * 0.8, y - r * 0.8, x + r * 0.9, y - r * 0.8);
      g.lineStyle(2 * s, OL, 1);
      g.lineBetween(x + r * 0.6, y - r * 0.8, x + r * 0.6, y - r * 0.1);
      block(g, x + r * 0.6, y + r * 0.15, r * 0.3, s, PALETTE.harborTeal);
      return;
    }
    case 'grid': {
      outline(g, s, 2);
      const cols = [PALETTE.fireRed, PALETTE.builderYellow, PALETTE.harborTeal, 0xffffff];
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          g.fillStyle(cols[(i + j * 2) % 4]!, 1);
          g.fillRect(x - r * 0.8 + i * r * 0.8, y - r * 0.8 + j * r * 0.8, r * 0.8, r * 0.8);
          g.strokeRect(x - r * 0.8 + i * r * 0.8, y - r * 0.8 + j * r * 0.8, r * 0.8, r * 0.8);
        }
      return;
    }
    case 'bucket': {
      outline(g, s);
      g.fillStyle(0xb8bcc8, 1);
      const pts = [
        { x: x - r * 0.7, y: y - r * 0.5 },
        { x: x + r * 0.7, y: y - r * 0.5 },
        { x: x + r * 0.5, y: y + r * 0.8 },
        { x: x - r * 0.5, y: y + r * 0.8 },
      ];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      g.fillStyle(0x9a9a9a, 1);
      g.fillEllipse(x, y - r * 0.5, r * 1.4, r * 0.35);
      g.strokeEllipse(x, y - r * 0.5, r * 1.4, r * 0.35);
      return;
    }
    case 'uniforms': {
      [PALETTE.policeBlue, PALETTE.fireRed, PALETTE.builderYellow].forEach((c, i) => {
        const cx = x + (i - 1) * r * 0.62;
        outline(g, s);
        g.fillStyle(c, 1);
        const shirt = [
          { x: cx - r * 0.3, y: y - r * 0.5 },
          { x: cx + r * 0.3, y: y - r * 0.5 },
          { x: cx + r * 0.28, y: y + r * 0.6 },
          { x: cx - r * 0.28, y: y + r * 0.6 },
        ];
        g.fillPoints(shirt, true);
        g.strokePoints(shirt, true);
      });
      g.lineStyle(3 * s, OL, 1);
      g.lineBetween(x - r, y - r * 0.6, x + r, y - r * 0.6);
      return;
    }
    case 'balloon': {
      outline(g, s);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillEllipse(x, y - r * 0.2, r * 1.1, r * 1.3);
      g.strokeEllipse(x, y - r * 0.2, r * 1.1, r * 1.3);
      g.lineStyle(2 * s, OL, 1);
      g.lineBetween(x, y + r * 0.45, x + r * 0.1, y + r);
      return;
    }
    case 'pizza': {
      outline(g, s);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillTriangle(x - r * 0.8, y - r * 0.6, x + r * 0.8, y - r * 0.6, x, y + r * 0.9);
      g.strokeTriangle(x - r * 0.8, y - r * 0.6, x + r * 0.8, y - r * 0.6, x, y + r * 0.9);
      g.fillStyle(PALETTE.fireRed, 1);
      for (const [dx, dy] of [
        [-0.3, -0.3],
        [0.25, -0.25],
        [0, 0.25],
      ] as const)
        g.fillCircle(x + dx * r, y + dy * r, r * 0.13);
      return;
    }
    case 'teddy': {
      outline(g, s);
      const fur = 0xb8794a;
      g.fillStyle(fur, 1);
      for (const dx of [-0.42, 0.42]) {
        g.fillCircle(x + dx * r, y - r * 0.62, r * 0.22);
        g.strokeCircle(x + dx * r, y - r * 0.62, r * 0.22);
      }
      g.fillEllipse(x, y + r * 0.35, r * 1.1, r * 1.1);
      g.strokeEllipse(x, y + r * 0.35, r * 1.1, r * 1.1);
      g.fillCircle(x, y - r * 0.3, r * 0.48);
      g.strokeCircle(x, y - r * 0.3, r * 0.48);
      g.fillStyle(0xf3d2a8, 1);
      g.fillEllipse(x, y - r * 0.18, r * 0.42, r * 0.3);
      g.fillStyle(OL, 1);
      g.fillCircle(x - r * 0.17, y - r * 0.38, r * 0.07);
      g.fillCircle(x + r * 0.17, y - r * 0.38, r * 0.07);
      g.fillCircle(x, y - r * 0.2, r * 0.08);
      return;
    }
    case 'flower': {
      g.lineStyle(4 * s, 0x2f8a3a, 1);
      g.lineBetween(x, y + r, x, y - r * 0.1);
      const petals = [PALETTE.donutPink, PALETTE.fireRed, PALETTE.coinGold];
      for (let i = 0; i < 3; i++) {
        const cx = x + (i - 1) * r * 0.55;
        const cy = y - r * 0.35 + (i === 1 ? -r * 0.2 : 0);
        g.fillStyle(petals[i]!, 1);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.fillCircle(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18, r * 0.16);
        }
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx, cy, r * 0.1);
      }
      return;
    }
    case 'iceCream': {
      outline(g, s);
      g.fillStyle(PALETTE.dough, 1);
      g.fillTriangle(x - r * 0.45, y - r * 0.1, x + r * 0.45, y - r * 0.1, x, y + r);
      g.strokeTriangle(x - r * 0.45, y - r * 0.1, x + r * 0.45, y - r * 0.1, x, y + r);
      g.fillStyle(PALETTE.donutPink, 1);
      g.fillCircle(x, y - r * 0.4, r * 0.48);
      g.strokeCircle(x, y - r * 0.4, r * 0.48);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillCircle(x + r * 0.1, y - r * 0.92, r * 0.12);
      return;
    }
    case 'letter': {
      outline(g, s);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - r * 0.85, y - r * 0.55, r * 1.7, r * 1.1);
      g.strokeRect(x - r * 0.85, y - r * 0.55, r * 1.7, r * 1.1);
      g.lineBetween(x - r * 0.85, y - r * 0.55, x, y + r * 0.1);
      g.lineBetween(x + r * 0.85, y - r * 0.55, x, y + r * 0.1);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillCircle(x, y + r * 0.1, r * 0.14);
      return;
    }
    case 'fish': {
      outline(g, s);
      g.fillStyle(PALETTE.coneOrange, 1);
      g.fillEllipse(x - r * 0.1, y, r * 1.4, r * 0.8);
      g.strokeEllipse(x - r * 0.1, y, r * 1.4, r * 0.8);
      g.fillTriangle(x + r * 0.5, y, x + r * 0.95, y - r * 0.4, x + r * 0.95, y + r * 0.4);
      g.strokeTriangle(x + r * 0.5, y, x + r * 0.95, y - r * 0.4, x + r * 0.95, y + r * 0.4);
      g.fillStyle(OL, 1);
      g.fillCircle(x - r * 0.45, y - r * 0.08, r * 0.08);
      return;
    }
    case 'book': {
      outline(g, s);
      g.fillStyle(PALETTE.policeBlue, 1);
      g.fillRoundedRect(x - r * 0.65, y - r * 0.8, r * 1.3, r * 1.6, r * 0.1);
      g.strokeRoundedRect(x - r * 0.65, y - r * 0.8, r * 1.3, r * 1.6, r * 0.1);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x + r * 0.45, y - r * 0.7, r * 0.12, r * 1.4);
      drawStar(g, x - r * 0.05, y - r * 0.1, r * 0.3, PALETTE.coinGold, 1.5 * s);
      return;
    }
    case 'present': {
      outline(g, s);
      g.fillStyle(PALETTE.harborTeal, 1);
      g.fillRect(x - r * 0.75, y - r * 0.35, r * 1.5, r * 1.1);
      g.strokeRect(x - r * 0.75, y - r * 0.35, r * 1.5, r * 1.1);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillRect(x - r * 0.12, y - r * 0.35, r * 0.24, r * 1.1);
      g.fillEllipse(x - r * 0.3, y - r * 0.5, r * 0.5, r * 0.3);
      g.fillEllipse(x + r * 0.3, y - r * 0.5, r * 0.5, r * 0.3);
      return;
    }
    case 'apple': {
      outline(g, s);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillCircle(x - r * 0.25, y + r * 0.1, r * 0.55);
      g.fillCircle(x + r * 0.25, y + r * 0.1, r * 0.55);
      g.lineStyle(4 * s, 0x6b4226, 1);
      g.lineBetween(x, y - r * 0.4, x + r * 0.1, y - r * 0.8);
      g.fillStyle(PALETTE.grass, 1);
      g.fillEllipse(x + r * 0.35, y - r * 0.65, r * 0.45, r * 0.22);
      return;
    }
    case 'shell': {
      outline(g, s);
      g.fillStyle(0xffd9c2, 1);
      g.beginPath();
      g.arc(x, y + r * 0.5, r * 0.9, Math.PI, 0, false);
      g.closePath();
      g.fillPath();
      g.strokePath();
      for (const a of [-0.6, -0.2, 0.2, 0.6])
        g.lineBetween(x, y + r * 0.5, x + a * r, y - r * 0.25);
      return;
    }
    case 'bed': {
      outline(g, s);
      g.fillStyle(PALETTE.trunk, 1);
      g.fillRect(x - r * 0.9, y - r * 0.6, r * 0.2, r * 1.3);
      g.strokeRect(x - r * 0.9, y - r * 0.6, r * 0.2, r * 1.3);
      g.fillStyle(PALETTE.policeBlue, 1);
      g.fillRect(x - r * 0.7, y - r * 0.05, r * 1.6, r * 0.5);
      g.strokeRect(x - r * 0.7, y - r * 0.05, r * 1.6, r * 0.5);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(x - r * 0.65, y - r * 0.35, r * 0.5, r * 0.3, r * 0.1);
      g.strokeRoundedRect(x - r * 0.65, y - r * 0.35, r * 0.5, r * 0.3, r * 0.1);
      g.fillStyle(PALETTE.trunk, 1);
      g.fillRect(x - r * 0.7, y + r * 0.45, r * 0.15, r * 0.3);
      g.fillRect(x + r * 0.75, y + r * 0.45, r * 0.15, r * 0.3);
      return;
    }
    case 'table': {
      outline(g, s);
      g.fillStyle(PALETTE.dough, 1);
      g.fillRect(x - r * 0.9, y - r * 0.25, r * 1.8, r * 0.25);
      g.strokeRect(x - r * 0.9, y - r * 0.25, r * 1.8, r * 0.25);
      for (const dx of [-0.75, 0.6]) {
        g.fillRect(x + dx * r, y, r * 0.15, r * 0.8);
        g.strokeRect(x + dx * r, y, r * 0.15, r * 0.8);
      }
      return;
    }
    case 'lamp': {
      outline(g, s);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillTriangle(x - r * 0.55, y - r * 0.1, x + r * 0.55, y - r * 0.1, x, y - r * 0.9);
      g.strokeTriangle(x - r * 0.55, y - r * 0.1, x + r * 0.55, y - r * 0.1, x, y - r * 0.9);
      g.lineStyle(5 * s, OL, 1);
      g.lineBetween(x, y - r * 0.1, x, y + r * 0.75);
      g.fillStyle(OL, 1);
      g.fillEllipse(x, y + r * 0.8, r * 0.8, r * 0.25);
      return;
    }
    case 'cushion': {
      outline(g, s);
      for (const [dx, c] of [
        [-0.35, PALETTE.donutPink],
        [0.35, PALETTE.harborTeal],
      ] as const) {
        g.fillStyle(c, 1);
        g.fillRoundedRect(x + dx * r - r * 0.4, y - r * 0.3, r * 0.8, r * 0.7, r * 0.25);
        g.strokeRoundedRect(x + dx * r - r * 0.4, y - r * 0.3, r * 0.8, r * 0.7, r * 0.25);
      }
      return;
    }
    case 'bookshelf': {
      outline(g, s);
      g.fillStyle(PALETTE.trunk, 1);
      g.fillRect(x - r * 0.7, y - r * 0.9, r * 1.4, r * 1.8);
      g.strokeRect(x - r * 0.7, y - r * 0.9, r * 1.4, r * 1.8);
      const cols = [PALETTE.fireRed, PALETTE.policeBlue, PALETTE.coinGold, PALETTE.grass];
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 4; i++) {
          g.fillStyle(cols[(i + row) % 4]!, 1);
          g.fillRect(x - r * 0.6 + i * r * 0.3, y - r * 0.8 + row * r * 0.58, r * 0.22, r * 0.45);
        }
      return;
    }
    case 'tv': {
      outline(g, s);
      g.fillStyle(0x3a3d4a, 1);
      g.fillRoundedRect(x - r * 0.9, y - r * 0.65, r * 1.8, r * 1.15, r * 0.12);
      g.strokeRoundedRect(x - r * 0.9, y - r * 0.65, r * 1.8, r * 1.15, r * 0.12);
      g.fillStyle(PALETTE.windowBlue, 1);
      g.fillRect(x - r * 0.75, y - r * 0.52, r * 1.5, r * 0.88);
      drawStar(g, x, y - r * 0.08, r * 0.25, PALETTE.coinGold, 1.5 * s);
      g.fillStyle(OL, 1);
      g.fillRect(x - r * 0.3, y + r * 0.55, r * 0.6, r * 0.15);
      return;
    }
    case 'computer': {
      outline(g, s);
      g.fillStyle(0xd9dce3, 1);
      g.fillRoundedRect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.05, r * 0.1);
      g.strokeRoundedRect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.05, r * 0.1);
      g.fillStyle(PALETTE.harborTeal, 1);
      g.fillRect(x - r * 0.6, y - r * 0.62, r * 1.2, r * 0.75);
      g.fillStyle(0xd9dce3, 1);
      g.fillRect(x - r * 0.9, y + r * 0.45, r * 1.8, r * 0.3);
      g.strokeRect(x - r * 0.9, y + r * 0.45, r * 1.8, r * 0.3);
      return;
    }
    case 'fishTank': {
      outline(g, s);
      g.fillStyle(0x9fd8f5, 1);
      g.fillRect(x - r * 0.9, y - r * 0.55, r * 1.8, r * 1.2);
      g.strokeRect(x - r * 0.9, y - r * 0.55, r * 1.8, r * 1.2);
      g.fillStyle(PALETTE.coneOrange, 1);
      g.fillEllipse(x - r * 0.25, y, r * 0.5, r * 0.28);
      g.fillTriangle(x + r * 0.0, y, x + r * 0.2, y - r * 0.15, x + r * 0.2, y + r * 0.15);
      g.fillStyle(PALETTE.grass, 1);
      g.fillRect(x + r * 0.45, y + r * 0.1, r * 0.1, r * 0.5);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x - r * 0.55, y - r * 0.3, r * 0.08);
      return;
    }
    case 'chefHat': {
      outline(g, s);
      g.fillStyle(0xffffff, 1);
      for (const [dx, dy, rr] of [
        [-0.35, -0.3, 0.38],
        [0.35, -0.3, 0.38],
        [0, -0.55, 0.42],
      ] as const) {
        g.fillCircle(x + dx * r, y + dy * r, rr * r);
        g.strokeCircle(x + dx * r, y + dy * r, rr * r);
      }
      g.fillRect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.6);
      g.strokeRect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.6);
      return;
    }
    case 'pirateHat': {
      outline(g, s);
      g.fillStyle(0x2b2d42, 1);
      g.beginPath();
      g.moveTo(x - r, y + r * 0.2);
      g.lineTo(x - r * 0.4, y - r * 0.5);
      g.lineTo(x, y - r * 0.2);
      g.lineTo(x + r * 0.4, y - r * 0.5);
      g.lineTo(x + r, y + r * 0.2);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y - r * 0.02, r * 0.16);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillRect(x - r * 0.9, y + r * 0.12, r * 1.8, r * 0.1);
      return;
    }
    case 'duckHat':
      duckShape(g, x, y + r * 0.1, r * 0.8, s, 0xffd23f);
      return;
    case 'car': {
      wheel(g, x - r * 0.5, y + r * 0.45, r * 0.25, s);
      wheel(g, x + r * 0.5, y + r * 0.45, r * 0.25, s);
      outline(g, s);
      g.fillStyle(PALETTE.donutPink, 1);
      g.fillRoundedRect(x - r * 0.9, y - r * 0.1, r * 1.8, r * 0.55, r * 0.2);
      g.strokeRoundedRect(x - r * 0.9, y - r * 0.1, r * 1.8, r * 0.55, r * 0.2);
      g.fillRoundedRect(x - r * 0.5, y - r * 0.55, r * 1.0, r * 0.5, r * 0.2);
      g.strokeRoundedRect(x - r * 0.5, y - r * 0.55, r * 1.0, r * 0.5, r * 0.2);
      g.fillStyle(PALETTE.windowBlue, 1);
      g.fillRect(x - r * 0.38, y - r * 0.45, r * 0.32, r * 0.3);
      g.fillRect(x + r * 0.06, y - r * 0.45, r * 0.32, r * 0.3);
      return;
    }
    case 'paint': {
      outline(g, s);
      g.fillStyle(0xb8bcc8, 1);
      g.fillRect(x - r * 0.6, y - r * 0.3, r * 1.2, r * 1.0);
      g.strokeRect(x - r * 0.6, y - r * 0.3, r * 1.2, r * 1.0);
      const cs = [PALETTE.fireRed, PALETTE.harborTeal, PALETTE.getawayPurple, PALETTE.donutPink];
      cs.forEach((c, i) => {
        g.fillStyle(c, 1);
        g.fillCircle(x - r * 0.45 + i * r * 0.3, y - r * 0.4, r * 0.18);
      });
      g.lineBetween(x - r * 0.6, y - r * 0.3, x - r * 0.3, y - r * 0.9);
      g.lineBetween(x + r * 0.6, y - r * 0.3, x + r * 0.3, y - r * 0.9);
      return;
    }
    case 'heart': {
      outline(g, s);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillCircle(x - r * 0.33, y - r * 0.2, r * 0.42);
      g.fillCircle(x + r * 0.33, y - r * 0.2, r * 0.42);
      g.fillTriangle(x - r * 0.72, y - r * 0.05, x + r * 0.72, y - r * 0.05, x, y + r * 0.8);
      return;
    }
    case 'home': {
      outline(g, s);
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillRect(x - r * 0.6, y - r * 0.1, r * 1.2, r * 0.9);
      g.strokeRect(x - r * 0.6, y - r * 0.1, r * 1.2, r * 0.9);
      g.fillStyle(PALETTE.fireRed, 1);
      g.fillTriangle(x - r * 0.85, y - r * 0.05, x + r * 0.85, y - r * 0.05, x, y - r * 0.85);
      g.strokeTriangle(x - r * 0.85, y - r * 0.05, x + r * 0.85, y - r * 0.05, x, y - r * 0.85);
      g.fillStyle(PALETTE.trunk, 1);
      g.fillRect(x - r * 0.15, y + r * 0.35, r * 0.3, r * 0.45);
      return;
    }
    case 'gear': {
      outline(g, s);
      g.fillStyle(0xa0a6b4, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.2);
      }
      g.fillCircle(x, y, r * 0.65);
      g.strokeCircle(x, y, r * 0.65);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x, y, r * 0.25);
      return;
    }
    case 'wrench': {
      g.lineStyle(7 * s, 0x8a8fa0, 1);
      g.lineBetween(x - r * 0.6, y + r * 0.6, x + r * 0.35, y - r * 0.35);
      g.fillStyle(0x8a8fa0, 1);
      g.fillCircle(x + r * 0.45, y - r * 0.45, r * 0.32);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(x + r * 0.58, y - r * 0.58, r * 0.14);
      return;
    }
  }
}
