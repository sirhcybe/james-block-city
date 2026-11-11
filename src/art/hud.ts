import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import { drawCoin, drawDonut, drawStar } from './shapes2d';
import { drawIcon } from './icons';
import { bakeIcon } from './ui';

/** HUD and minigame icons (pictures only, never words). Sizes are logical px. */
export const HUD = {
  coin: 'hud-coin',
  donut: 'hud-donut',
  actionEnter: 'hud-action-enter',
  actionExit: 'hud-action-exit',
  actionIdle: 'hud-action-idle',
  siren: 'hud-siren',
  sirenOn: 'hud-siren-on',
  arrow: 'hud-arrow',
  star: 'hud-star',
  starEmpty: 'hud-star-empty',
  check: 'hud-check',
  actionNet: 'hud-action-net',
  actionHose: 'hud-action-hose',
  actionBlast: 'hud-action-blast',
  uniform: 'hud-uniform',
  badgeSlot: 'hud-badge-slot',
  badge: (job: string) => `hud-badge-${job}`,
} as const;

export const ACTION_SIZE = 150;
export const SIREN_SIZE = 110;
export const COIN_SIZE = 56;
/** Quick-change uniform button (top-right, with all three badges). */
export const UNIFORM_SIZE = 96;

function roundButton(
  g: Phaser.GameObjects.Graphics,
  size: number,
  color: number,
  s: number,
): number {
  const c = (size / 2 + 4) * s;
  const r = (size / 2) * s;
  g.fillStyle(darken(color, 0.35), 1);
  g.fillCircle(c, c + 6 * s, r);
  g.fillStyle(color, 1);
  g.fillCircle(c, c, r);
  g.fillStyle(lighten(color, 0.2), 1);
  g.fillCircle(c, c - r * 0.08, r * 0.84);
  g.lineStyle(5 * s, PALETTE.outline, 1);
  g.strokeCircle(c, c, r);
  return c;
}

/** Side-view car picture centred on (x, y). */
function carIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, k: number, s: number): void {
  const u = k * s;
  g.lineStyle(3 * s, PALETTE.outline, 1);
  g.fillStyle(PALETTE.buildingWhite, 1);
  g.fillRoundedRect(x - 34 * u, y - 8 * u, 68 * u, 22 * u, 7 * u);
  g.strokeRoundedRect(x - 34 * u, y - 8 * u, 68 * u, 22 * u, 7 * u);
  g.fillStyle(PALETTE.policeBlue, 1);
  g.fillRoundedRect(x - 18 * u, y - 24 * u, 34 * u, 18 * u, 6 * u);
  g.strokeRoundedRect(x - 18 * u, y - 24 * u, 34 * u, 18 * u, 6 * u);
  g.fillStyle(PALETTE.windowBlue, 1);
  g.fillRoundedRect(x - 13 * u, y - 20 * u, 24 * u, 10 * u, 3 * u);
  g.fillStyle(PALETTE.fireRed, 1);
  g.fillRect(x - 6 * u, y - 30 * u, 6 * u, 6 * u);
  g.fillStyle(PALETTE.policeBlue, 1);
  g.fillRect(x, y - 30 * u, 6 * u, 6 * u);
  for (const wx of [-20, 20]) {
    g.fillStyle(PALETTE.outline, 1);
    g.fillCircle(x + wx * u, y + 15 * u, 9 * u);
    g.fillStyle(0xc9ced8, 1);
    g.fillCircle(x + wx * u, y + 15 * u, 4 * u);
  }
}

function personIcon(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  k: number,
  s: number,
): void {
  const u = k * s;
  g.lineStyle(3 * s, PALETTE.outline, 1);
  g.fillStyle(PALETTE.policeBlue, 1);
  g.fillRoundedRect(x - 12 * u, y - 4 * u, 24 * u, 26 * u, 8 * u);
  g.strokeRoundedRect(x - 12 * u, y - 4 * u, 24 * u, 26 * u, 8 * u);
  g.fillStyle(PALETTE.skin, 1);
  g.fillCircle(x, y - 16 * u, 12 * u);
  g.strokeCircle(x, y - 16 * u, 12 * u);
  g.fillStyle(PALETTE.outline, 1);
  g.fillCircle(x - 4 * u, y - 16 * u, 2 * u);
  g.fillCircle(x + 4 * u, y - 16 * u, 2 * u);
}

function arrowRight(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  u: number,
  s: number,
): void {
  const pts = [
    { x: x - 12 * u, y: y - 6 * u },
    { x: x + 2 * u, y: y - 6 * u },
    { x: x + 2 * u, y: y - 14 * u },
    { x: x + 16 * u, y },
    { x: x + 2 * u, y: y + 14 * u },
    { x: x + 2 * u, y: y + 6 * u },
    { x: x - 12 * u, y: y + 6 * u },
  ];
  g.fillStyle(PALETTE.coinGold, 1);
  g.fillPoints(pts, true);
  g.lineStyle(3 * s, PALETTE.outline, 1);
  g.strokePoints(pts, true);
}

/** A job badge: a scalloped star badge in the job colour with the job's picture in the middle. */
function drawBadge(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  s: number,
  color: number,
  job: string,
): void {
  g.lineStyle(3 * s * 0.5, PALETTE.outline, 1);
  g.fillStyle(color, 1);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.86 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillPoints(pts, true);
  g.strokePoints(pts, true);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(x, y, r * 0.6);
  g.strokeCircle(x, y, r * 0.6);
  drawIcon(g, job === 'cop' ? 'star' : job === 'fire' ? 'flame' : 'brick', x, y, r * 0.45, s * 0.5);
}

export function bakeHud(scene: Phaser.Scene): void {
  bakeIcon(scene, HUD.coin, COIN_SIZE, COIN_SIZE, (g, s) => {
    drawCoin(g, (COIN_SIZE / 2) * s, (COIN_SIZE / 2) * s, (COIN_SIZE / 2 - 3) * s, s);
  });
  bakeIcon(scene, HUD.donut, 48, 48, (g, s) => drawDonut(g, 24 * s, 24 * s, 20 * s, s));

  const A = ACTION_SIZE + 8;
  bakeIcon(scene, HUD.actionEnter, A, A + 6, (g, s) => {
    const c = roundButton(g, ACTION_SIZE, PALETTE.grass, s);
    carIcon(g, c + 6 * s, c + 8 * s, 1.1, s);
    arrowRight(g, c - 46 * s, c - 4 * s, 1, s);
  });
  bakeIcon(scene, HUD.actionExit, A, A + 6, (g, s) => {
    const c = roundButton(g, ACTION_SIZE, PALETTE.coinGold, s);
    personIcon(g, c + 22 * s, c + 6 * s, 1.3, s);
    arrowRight(g, c - 22 * s, c + 4 * s, 1, s);
  });
  bakeIcon(scene, HUD.actionNet, A, A + 6, (g, s) => {
    const c = roundButton(g, ACTION_SIZE, PALETTE.coneOrange, s);
    drawIcon(g, 'net', c, c, 46 * s, s * 1.4);
  });
  bakeIcon(scene, HUD.actionHose, A, A + 6, (g, s) => {
    const c = roundButton(g, ACTION_SIZE, PALETTE.harborTeal, s);
    drawIcon(g, 'hose', c - 6 * s, c + 4 * s, 44 * s, s * 1.4);
  });
  bakeIcon(scene, HUD.actionBlast, A, A + 6, (g, s) => {
    const c = roundButton(g, ACTION_SIZE, PALETTE.builderYellow, s);
    drawIcon(g, 'blaster', c, c, 44 * s, s * 1.4);
  });
  for (const [job, color] of [
    ['cop', PALETTE.coinGold],
    ['fire', PALETTE.fireRed],
    ['builder', PALETTE.builderYellow],
  ] as const) {
    bakeIcon(scene, HUD.badge(job), 64, 64, (g, s) => {
      drawBadge(g, 32 * s, 32 * s, 28 * s, s, color, job);
    });
    bakeIcon(scene, `${HUD.badge(job)}-big`, 300, 300, (g, s) => {
      drawBadge(g, 150 * s, 150 * s, 140 * s, s * 4, color, job);
    });
  }
  bakeIcon(scene, HUD.uniform, UNIFORM_SIZE + 8, UNIFORM_SIZE + 14, (g, s) => {
    const c = roundButton(g, UNIFORM_SIZE, 0xf3e3c0, s);
    drawIcon(g, 'uniforms', c, c, 34 * s, s * 1.2);
  });
  bakeIcon(scene, HUD.badgeSlot, 64, 64, (g, s) => {
    g.lineStyle(3 * s, 0xffffff, 0.6);
    g.strokeCircle(32 * s, 32 * s, 26 * s);
  });
  bakeIcon(scene, HUD.actionIdle, A, A + 6, (g, s) => {
    const c = roundButton(g, ACTION_SIZE, 0xb8bfcc, s);
    drawStar(g, c, c, 34 * s, lighten(0xb8bfcc, 0.4), 3 * s);
  });

  const S = SIREN_SIZE + 8;
  for (const [key, on] of [
    [HUD.siren, false],
    [HUD.sirenOn, true],
  ] as const) {
    bakeIcon(scene, key, S, S + 6, (g, s) => {
      const c = roundButton(g, SIREN_SIZE, on ? PALETTE.fireRed : PALETTE.policeBlue, s);
      // Dome light with rays.
      g.fillStyle(on ? 0xffe066 : PALETTE.fireRed, 1);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.slice(c, c + 12 * s, 24 * s, Math.PI, 0, false);
      g.fillPath();
      g.strokePath();
      g.fillStyle(PALETTE.outline, 1);
      g.fillRoundedRect(c - 30 * s, c + 12 * s, 60 * s, 10 * s, 3 * s);
      g.lineStyle(4 * s, 0xffffff, 1);
      for (const a of [-2.6, -2.1, -1.57, -1.05, -0.55]) {
        g.lineBetween(
          c + Math.cos(a) * 30 * s,
          c + 8 * s + Math.sin(a) * 30 * s,
          c + Math.cos(a) * 40 * s,
          c + 8 * s + Math.sin(a) * 40 * s,
        );
      }
    });
  }

  bakeIcon(scene, HUD.arrow, 72, 92, (g, s) => {
    const pts = [
      { x: 22 * s, y: 4 * s },
      { x: 50 * s, y: 4 * s },
      { x: 50 * s, y: 46 * s },
      { x: 68 * s, y: 46 * s },
      { x: 36 * s, y: 88 * s },
      { x: 4 * s, y: 46 * s },
      { x: 22 * s, y: 46 * s },
    ];
    g.fillStyle(PALETTE.coinGold, 1);
    g.fillPoints(pts, true);
    g.lineStyle(5 * s, PALETTE.outline, 1);
    g.strokePoints(pts, true);
  });

  bakeIcon(scene, HUD.star, 100, 100, (g, s) =>
    drawStar(g, 50 * s, 52 * s, 46 * s, PALETTE.coinGold, 5 * s),
  );
  bakeIcon(scene, HUD.starEmpty, 100, 100, (g, s) =>
    drawStar(g, 50 * s, 52 * s, 46 * s, 0xd9dce3, 5 * s),
  );
  bakeIcon(scene, HUD.check, 158, 164, (g, s) => {
    const c = roundButton(g, 150, PALETTE.grass, s);
    g.lineStyle(16 * s, PALETTE.outline, 1);
    g.beginPath();
    g.moveTo(c - 36 * s, c + 2 * s);
    g.lineTo(c - 10 * s, c + 28 * s);
    g.lineTo(c + 38 * s, c - 26 * s);
    g.strokePath();
    g.lineStyle(9 * s, 0xffffff, 1);
    g.strokePath();
  });
}
