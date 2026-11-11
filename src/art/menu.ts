import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { darken, lighten } from './color';
import { drawIcon, type IconName } from './icons';
import { drawStar } from './shapes2d';
import { bakeIcon } from './ui';

/** Screen-space art for the picture menus (mission board, shop, job center, minigames). */
export const MENU = {
  card: 'menu-card',
  cardLocked: 'menu-card-locked',
  cardOwned: 'menu-card-owned',
  back: 'menu-back',
  buy: 'menu-buy',
  play: 'menu-play',
  panel: 'menu-panel',
  starSmall: 'menu-star',
  starSmallEmpty: 'menu-star-empty',
} as const;

export const ICON_SIZE = 120;
export const CARD_W = 210;
export const CARD_H = 250;
export const BUTTON = 130;

export const iconKey = (name: IconName) => `icon-${name}`;

const ALL_ICONS: IconName[] = [
  'star',
  'donut',
  'duck',
  'puppy',
  'sock',
  'rubberDuck',
  'flag',
  'scooter',
  'bike',
  'padlock',
  'net',
  'badge',
  'coin',
  'feather',
  'trafficLight',
  'magnifier',
  'cap',
  'twoRobbers',
  'flame',
  'kitten',
  'toaster',
  'ladder',
  'hose',
  'helmet',
  'hardHat',
  'brick',
  'mixer',
  'blaster',
  'lighthouse',
  'boat',
  'bridge',
  'dock',
  'firework',
  'grill',
  'cake',
  'parrot',
  'tower',
  'window',
  'crane',
  'grid',
  'bucket',
  'uniforms',
  'balloon',
  'pizza',
  'wrench',
];

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
  g.fillCircle(c, c, r * 0.8);
  g.lineStyle(5 * s, PALETTE.outline, 1);
  g.strokeCircle(c, c, r);
  return c;
}

function card(g: Phaser.GameObjects.Graphics, s: number, fill: number): void {
  g.fillStyle(darken(fill, 0.3), 1);
  g.fillRoundedRect(4 * s, 10 * s, CARD_W * s, CARD_H * s, 22 * s);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(4 * s, 4 * s, CARD_W * s, CARD_H * s, 22 * s);
  g.lineStyle(5 * s, PALETTE.outline, 1);
  g.strokeRoundedRect(4 * s, 4 * s, CARD_W * s, CARD_H * s, 22 * s);
}

export function bakeMenuArt(scene: Phaser.Scene): void {
  for (const name of ALL_ICONS) {
    bakeIcon(scene, iconKey(name), ICON_SIZE, ICON_SIZE, (g, s) =>
      drawIcon(
        g,
        name,
        (ICON_SIZE / 2) * s,
        (ICON_SIZE / 2) * s,
        (ICON_SIZE / 2 - 12) * s,
        s * 1.4,
      ),
    );
  }
  bakeIcon(scene, MENU.card, CARD_W + 8, CARD_H + 14, (g, s) => card(g, s, 0xffffff));
  bakeIcon(scene, MENU.cardLocked, CARD_W + 8, CARD_H + 14, (g, s) => card(g, s, 0xc9ced8));
  bakeIcon(scene, MENU.cardOwned, CARD_W + 8, CARD_H + 14, (g, s) =>
    card(g, s, lighten(PALETTE.grass, 0.45)),
  );
  bakeIcon(scene, MENU.back, BUTTON + 8, BUTTON + 14, (g, s) => {
    const c = roundButton(g, BUTTON, PALETTE.policeBlue, s);
    // A big "go back" arrow pointing left.
    const pts = [
      { x: c - 34 * s, y: c },
      { x: c + 2 * s, y: c - 32 * s },
      { x: c + 2 * s, y: c - 14 * s },
      { x: c + 34 * s, y: c - 14 * s },
      { x: c + 34 * s, y: c + 14 * s },
      { x: c + 2 * s, y: c + 14 * s },
      { x: c + 2 * s, y: c + 32 * s },
    ];
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts, true);
    g.lineStyle(5 * s, PALETTE.outline, 1);
    g.strokePoints(pts, true);
  });
  bakeIcon(scene, MENU.buy, BUTTON + 8, BUTTON + 14, (g, s) => {
    const c = roundButton(g, BUTTON, PALETTE.grass, s);
    drawIcon(g, 'coin', c - 12 * s, c + 8 * s, 26 * s, s);
    g.lineStyle(12 * s, PALETTE.outline, 1);
    g.beginPath();
    g.moveTo(c + 2 * s, c - 18 * s);
    g.lineTo(c + 16 * s, c - 4 * s);
    g.lineTo(c + 40 * s, c - 34 * s);
    g.strokePath();
    g.lineStyle(6 * s, 0xffffff, 1);
    g.strokePath();
  });
  bakeIcon(scene, MENU.play, BUTTON + 8, BUTTON + 14, (g, s) => {
    const c = roundButton(g, BUTTON, PALETTE.grass, s);
    const t = 30 * s;
    const pts = [
      { x: c - t * 0.7, y: c - t },
      { x: c + t * 1.05, y: c },
      { x: c - t * 0.7, y: c + t },
    ];
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts, true);
    g.lineStyle(5 * s, PALETTE.outline, 1);
    g.strokePoints(pts, true);
  });
  bakeIcon(scene, MENU.starSmall, 48, 48, (g, s) => drawIcon(g, 'star', 24 * s, 25 * s, 20 * s, s));
  bakeIcon(scene, MENU.starSmallEmpty, 48, 48, (g, s) =>
    drawStar(g, 24 * s, 25 * s, 20 * s, 0xd9dce3, 3 * s),
  );
}
