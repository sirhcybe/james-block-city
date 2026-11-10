import type Phaser from 'phaser';
import { PALETTE } from '../config';

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
): void {
  const ring = r * 0.55;
  const mid = r - ring / 2;
  g.lineStyle(ring + 4 * s, PALETTE.outline, 1);
  g.strokeCircle(cx, cy, mid);
  g.lineStyle(ring, PALETTE.dough, 1);
  g.strokeCircle(cx, cy, mid);
  g.lineStyle(ring * 0.72, PALETTE.donutPink, 1);
  g.beginPath();
  g.arc(cx, cy, mid, Math.PI * 0.9, Math.PI * 2.1, false);
  g.strokePath();
  const sprinkles = [0xffffff, PALETTE.harborTeal, PALETTE.coinGold, PALETTE.policeBlue];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.98 + i * 0.16);
    g.fillStyle(sprinkles[i % sprinkles.length]!, 1);
    g.fillCircle(cx + Math.cos(a) * mid, cy + Math.sin(a) * mid, Math.max(1, 1.6 * s));
  }
}

/** A round coin with a star. */
export function drawCoin(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  s: number,
): void {
  g.fillStyle(PALETTE.coinGold, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(3 * s, PALETTE.outline, 1);
  g.strokeCircle(cx, cy, r);
  g.lineStyle(2 * s, 0xffffff, 0.6);
  g.strokeCircle(cx, cy, r * 0.72);
  drawStar(g, cx, cy, r * 0.5, 0xfff3b0, 1.5 * s);
}
