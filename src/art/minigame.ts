import type Phaser from 'phaser';
import { GAME_H, GAME_W, PALETTE } from '../config';
import { darken, lighten } from './color';
import { bakeIcon } from './ui';

/** Traffic Helper art: a side-on street with a crosswalk, ducks, cartoon cars and a big light. */
export const MG = {
  bg: 'mg-bg',
  duck: 'mg-duck',
  duckSad: 'mg-duck-sad',
  light: 'mg-light',
  lightRed: 'mg-light-red',
  flag: 'mg-flag',
  car: (i: number) => `mg-car-${i}`,
} as const;

export const MG_CAR_COLORS = [
  PALETTE.fireRed,
  PALETTE.harborTeal,
  PALETTE.builderYellow,
  PALETTE.getawayPurple,
];
export const ROAD = { top: 300, bottom: 470, laneY: 410 } as const;

function duck(g: Phaser.GameObjects.Graphics, s: number, sad: boolean): void {
  const ol = PALETTE.outline;
  const yellow = 0xffd23f;
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(40 * s, 75 * s, 52 * s, 9 * s);
  g.lineStyle(3 * s, ol, 1);
  // Feet and tail first, behind the body.
  for (const fx of [32, 45]) {
    g.fillStyle(PALETTE.coneOrange, 1);
    g.fillRoundedRect(fx * s, 66 * s, 8 * s, 9 * s, 2 * s);
    g.strokeRoundedRect(fx * s, 66 * s, 8 * s, 9 * s, 2 * s);
  }
  const tail = [
    { x: 16 * s, y: 46 * s },
    { x: 7 * s, y: 34 * s },
    { x: 24 * s, y: 38 * s },
  ];
  g.fillStyle(yellow, 1);
  g.fillPoints(tail, true);
  g.strokePoints(tail, true);
  const beak = [
    { x: 63 * s, y: 22 * s },
    { x: 79 * s, y: 28 * s },
    { x: 63 * s, y: 34 * s },
  ];
  g.fillStyle(PALETTE.coneOrange, 1);
  g.fillPoints(beak, true);
  g.strokePoints(beak, true);
  g.fillStyle(yellow, 1);
  g.fillEllipse(40 * s, 52 * s, 56 * s, 38 * s); // body
  g.strokeEllipse(40 * s, 52 * s, 56 * s, 38 * s);
  g.fillCircle(52 * s, 26 * s, 16 * s); // head
  g.strokeCircle(52 * s, 26 * s, 16 * s);
  // Wing: a darker smile-shaped line on the side.
  g.lineStyle(3 * s, darken(yellow, 0.25), 1);
  g.beginPath();
  g.arc(35 * s, 47 * s, 13 * s, Math.PI * 0.1, Math.PI * 0.9, false);
  g.strokePath();
  g.fillStyle(ol, 1);
  g.fillCircle(57 * s, 22 * s, 3.2 * s);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(56 * s, 21 * s, 1.1 * s);
  if (sad) {
    g.lineStyle(2.5 * s, ol, 1);
    g.lineBetween(50 * s, 14 * s, 61 * s, 17 * s); // worried brow
  }
}

function car(g: Phaser.GameObjects.Graphics, s: number, color: number): void {
  const ol = PALETTE.outline;
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(70 * s, 93 * s, 130 * s, 11 * s);
  g.lineStyle(4 * s, ol, 1);
  // Cabin behind the body so their outlines join cleanly.
  g.fillStyle(lighten(color, 0.15), 1);
  g.fillRoundedRect(30 * s, 12 * s, 70 * s, 40 * s, 12 * s);
  g.strokeRoundedRect(30 * s, 12 * s, 70 * s, 40 * s, 12 * s);
  g.fillStyle(color, 1);
  g.fillRoundedRect(6 * s, 40 * s, 128 * s, 40 * s, 14 * s);
  g.fillStyle(darken(color, 0.14), 1);
  g.fillRoundedRect(10 * s, 64 * s, 120 * s, 14 * s, 7 * s);
  g.lineStyle(4 * s, ol, 1);
  g.strokeRoundedRect(6 * s, 40 * s, 128 * s, 40 * s, 14 * s);
  // Windows, a door seam and handle, bumpers and lights.
  g.lineStyle(2.5 * s, ol, 1);
  for (const [wx, ww] of [
    [38, 25],
    [68, 25],
  ] as const) {
    g.fillStyle(PALETTE.windowBlue, 1);
    g.fillRoundedRect(wx * s, 19 * s, ww * s, 19 * s, 5 * s);
    g.strokeRoundedRect(wx * s, 19 * s, ww * s, 19 * s, 5 * s);
    g.lineStyle(2 * s, 0xffffff, 0.8);
    g.lineBetween((wx + 5) * s, 31 * s, (wx + 11) * s, 24 * s);
    g.lineStyle(2.5 * s, ol, 1);
  }
  g.lineBetween(65.5 * s, 44 * s, 65.5 * s, 74 * s);
  g.lineBetween(72 * s, 52 * s, 80 * s, 52 * s);
  g.fillStyle(0xfff1a8, 1);
  g.fillCircle(127 * s, 56 * s, 6 * s); // headlight (cars drive right)
  g.strokeCircle(127 * s, 56 * s, 6 * s);
  g.fillStyle(PALETTE.fireRed, 1);
  g.fillRoundedRect(7 * s, 51 * s, 6 * s, 10 * s, 2 * s);
  g.strokeRoundedRect(7 * s, 51 * s, 6 * s, 10 * s, 2 * s);
  for (const wx of [34, 106]) {
    g.fillStyle(0x3a3d4a, 1);
    g.fillCircle(wx * s, 82 * s, 15 * s);
    g.lineStyle(3.5 * s, ol, 1);
    g.strokeCircle(wx * s, 82 * s, 15 * s);
    g.fillStyle(0xc9ced8, 1);
    g.fillCircle(wx * s, 82 * s, 6.5 * s);
    g.lineStyle(2 * s, ol, 1);
    g.strokeCircle(wx * s, 82 * s, 6.5 * s);
  }
}

function trafficLight(g: Phaser.GameObjects.Graphics, s: number, red: boolean): void {
  const ol = PALETTE.outline;
  g.fillStyle(0x4a4e5c, 1);
  g.fillRect(56 * s, 200 * s, 18 * s, 120 * s);
  g.lineStyle(4 * s, ol, 1);
  g.strokeRect(56 * s, 200 * s, 18 * s, 120 * s);
  g.fillStyle(0x3a3d4a, 1);
  g.fillRoundedRect(10 * s, 6 * s, 110 * s, 200 * s, 24 * s);
  g.strokeRoundedRect(10 * s, 6 * s, 110 * s, 200 * s, 24 * s);
  const lamp = (y: number, c: number, on: boolean) => {
    if (on) {
      g.fillStyle(c, 0.35);
      g.fillCircle(65 * s, y * s, 46 * s);
    }
    g.fillStyle(on ? lighten(c, 0.2) : darken(c, 0.6), 1);
    g.fillCircle(65 * s, y * s, 34 * s);
    g.lineStyle(4 * s, ol, 1);
    g.strokeCircle(65 * s, y * s, 34 * s);
  };
  lamp(58, PALETTE.fireRed, red);
  lamp(152, PALETTE.grass, !red);
}

export function bakeMinigameArt(scene: Phaser.Scene): void {
  bakeIcon(scene, MG.bg, GAME_W, GAME_H, (g, s) => {
    g.fillStyle(0x9fdcff, 1);
    g.fillRect(0, 0, GAME_W * s, 200 * s);
    g.fillStyle(PALETTE.grass, 1);
    g.fillRect(0, 200 * s, GAME_W * s, 60 * s);
    g.fillRect(0, (ROAD.bottom + 60) * s, GAME_W * s, (GAME_H - ROAD.bottom - 60) * s);
    g.fillStyle(PALETTE.sidewalk, 1);
    g.fillRect(0, 260 * s, GAME_W * s, (ROAD.top - 260) * s);
    g.fillRect(0, ROAD.bottom * s, GAME_W * s, 60 * s);
    g.fillStyle(PALETTE.road, 1);
    g.fillRect(0, ROAD.top * s, GAME_W * s, (ROAD.bottom - ROAD.top) * s);
    g.lineStyle(4 * s, PALETTE.outline, 1);
    g.lineBetween(0, ROAD.top * s, GAME_W * s, ROAD.top * s);
    g.lineBetween(0, ROAD.bottom * s, GAME_W * s, ROAD.bottom * s);
    // Crosswalk stripes.
    g.fillStyle(0xffffff, 1);
    for (let y = ROAD.top + 10; y < ROAD.bottom - 10; y += 30)
      g.fillRect(565 * s, y * s, 150 * s, 16 * s);
    // Stop line.
    g.fillRect(530 * s, (ROAD.top + 90) * s, 10 * s, (ROAD.bottom - ROAD.top - 90) * s);
    // Little houses on the far side.
    const houses = [
      [90, 130, PALETTE.fireRed],
      [300, 110, PALETTE.policeBlue],
      [880, 120, PALETTE.harborTeal],
      [1100, 140, PALETTE.builderYellow],
    ] as const;
    for (const [x, h, c] of houses) {
      g.fillStyle(PALETTE.buildingWhite, 1);
      g.fillRect(x * s, (260 - h) * s, 140 * s, h * s);
      g.fillStyle(c, 1);
      g.fillRect((x - 6) * s, (260 - h - 18) * s, 152 * s, 22 * s);
      g.lineStyle(3 * s, PALETTE.outline, 1);
      g.strokeRect(x * s, (260 - h) * s, 140 * s, h * s);
      g.strokeRect((x - 6) * s, (260 - h - 18) * s, 152 * s, 22 * s);
      for (const wx of [20, 84]) {
        g.fillStyle(PALETTE.windowBlue, 1);
        g.fillRoundedRect((x + wx) * s, (260 - h + 30) * s, 36 * s, 30 * s, 4 * s);
        g.strokeRoundedRect((x + wx) * s, (260 - h + 30) * s, 36 * s, 30 * s, 4 * s);
        g.lineStyle(3 * s, 0xffffff, 0.8);
        g.lineBetween((x + wx + 8) * s, (260 - h + 50) * s, (x + wx + 18) * s, (260 - h + 38) * s);
        g.lineStyle(3 * s, PALETTE.outline, 1);
      }
      // A door between the windows.
      g.fillStyle(darken(c, 0.2), 1);
      g.fillRoundedRect((x + 60) * s, (260 - 44) * s, 20 * s, 44 * s, {
        tl: 5 * s,
        tr: 5 * s,
        bl: 0,
        br: 0,
      });
      g.strokeRoundedRect((x + 60) * s, (260 - 44) * s, 20 * s, 44 * s, {
        tl: 5 * s,
        tr: 5 * s,
        bl: 0,
        br: 0,
      });
    }
  });
  bakeIcon(scene, MG.duck, 82, 80, (g, s) => duck(g, s, false));
  bakeIcon(scene, MG.duckSad, 82, 80, (g, s) => duck(g, s, true));
  MG_CAR_COLORS.forEach((c, i) => bakeIcon(scene, MG.car(i), 140, 100, (g, s) => car(g, s, c)));
  bakeIcon(scene, MG.light, 130, 324, (g, s) => trafficLight(g, s, false));
  bakeIcon(scene, MG.lightRed, 130, 324, (g, s) => trafficLight(g, s, true));
  bakeIcon(scene, MG.flag, 40, 60, (g, s) => {
    g.fillStyle(PALETTE.grass, 1);
    g.fillTriangle(6 * s, 6 * s, 37 * s, 17 * s, 6 * s, 28 * s);
    g.lineStyle(3 * s, PALETTE.outline, 1);
    g.strokeTriangle(6 * s, 6 * s, 37 * s, 17 * s, 6 * s, 28 * s);
    g.lineStyle(5 * s, PALETTE.outline, 1);
    g.lineBetween(6 * s, 5 * s, 6 * s, 56 * s);
  });
}
