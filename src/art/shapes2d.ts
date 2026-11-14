import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken } from './color';

/** Flat 2D picture helpers shared by buildings, props and the HUD. All sizes in output px. */

export function starPoints(
  cx: number,
  cy: number,
  r: number,
  points = 5,
): Phaser.Types.Math.Vector2Like[] {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

export function drawStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  outline: number,
): void {
  const pts = starPoints(cx, cy, r);
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
  g.lineStyle(outline, PALETTE.outline, 1);
  g.strokePoints(pts, true);
}

/** An upright donut: a thick dough ring with pink frosting and sprinkles (real hole in the middle). */
export function drawDonut(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  s: number,
  ow = 2 * s,
): void {
  const ring = r * 0.55;
  const mid = r - ring / 2;
  g.lineStyle(ring + ow * 2, PALETTE.outline, 1);
  g.strokeCircle(cx, cy, mid);
  g.lineStyle(ring, PALETTE.dough, 1);
  g.strokeCircle(cx, cy, mid);
  // Frosting over the top three-quarters, with a soft shine.
  g.lineStyle(ring * 0.7, PALETTE.donutPink, 1);
  g.beginPath();
  g.arc(cx, cy, mid, Math.PI * 0.86, Math.PI * 2.14, false);
  g.strokePath();
  g.lineStyle(ring * 0.14, 0xffffff, 0.7);
  g.beginPath();
  g.arc(cx, cy, mid + ring * 0.16, Math.PI * 1.15, Math.PI * 1.4, false);
  g.strokePath();
  const sprinkles = [0xffffff, PALETTE.harborTeal, PALETTE.coinGold, PALETTE.policeBlue];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.96 + i * 0.18);
    const rr = mid + (i % 2 ? -1 : 1) * ring * 0.1;
    g.fillStyle(sprinkles[i % sprinkles.length]!, 1);
    g.fillCircle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(1, ring * 0.1));
  }
}

/** A round coin with a star. */
export function drawCoin(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  s: number,
  ow = 3 * s,
): void {
  g.fillStyle(darken(PALETTE.coinGold, 0.16), 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(PALETTE.coinGold, 1);
  g.fillCircle(cx - r * 0.03, cy - r * 0.05, r * 0.94);
  g.lineStyle(ow, PALETTE.outline, 1);
  g.strokeCircle(cx, cy, r);
  g.lineStyle(Math.max(1, ow * 0.6), 0xffffff, 0.65);
  g.strokeCircle(cx, cy, r * 0.72);
  drawStar(g, cx, cy + r * 0.02, r * 0.5, 0xfff3b0, Math.max(1, ow * 0.5));
}
