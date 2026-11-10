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
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(40 * s, 74 * s, 50 * s, 10 * s);
  g.lineStyle(3 * s, ol, 1);
  g.fillStyle(0xffd23f, 1);
  g.fillEllipse(40 * s, 52 * s, 56 * s, 38 * s); // body
  g.strokeEllipse(40 * s, 52 * s, 56 * s, 38 * s);
  g.fillCircle(52 * s, 26 * s, 16 * s); // head
  g.strokeCircle(52 * s, 26 * s, 16 * s);
  g.fillStyle(PALETTE.coneOrange, 1);
  const beak = [
    { x: 64 * s, y: 26 * s },
    { x: 78 * s, y: 30 * s },
    { x: 64 * s, y: 34 * s },
  ];
  g.fillPoints(beak, true);
  g.strokePoints(beak, true);
  g.fillStyle(ol, 1);
  g.fillCircle(56 * s, 22 * s, 3 * s);
  g.fillStyle(darken(0xffd23f, 0.15), 1);
  g.fillEllipse(34 * s, 50 * s, 26 * s, 14 * s); // wing
  g.fillStyle(PALETTE.coneOrange, 1);
  g.fillRect(32 * s, 68 * s, 6 * s, 8 * s);
  g.fillRect(44 * s, 68 * s, 6 * s, 8 * s);
  if (sad) {
    g.lineStyle(2.5 * s, ol, 1);
    g.lineBetween(50 * s, 15 * s, 60 * s, 18 * s); // worried brow
  }
}

function car(g: Phaser.GameObjects.Graphics, s: number, color: number): void {
  const ol = PALETTE.outline;
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(70 * s, 92 * s, 130 * s, 12 * s);
  g.lineStyle(4 * s, ol, 1);
  g.fillStyle(color, 1);
  g.fillRoundedRect(6 * s, 40 * s, 128 * s, 40 * s, 14 * s);
  g.strokeRoundedRect(6 * s, 40 * s, 128 * s, 40 * s, 14 * s);
  g.fillStyle(lighten(color, 0.15), 1);
  g.fillRoundedRect(30 * s, 12 * s, 70 * s, 34 * s, 12 * s);
  g.strokeRoundedRect(30 * s, 12 * s, 70 * s, 34 * s, 12 * s);
  g.fillStyle(PALETTE.windowBlue, 1);
  g.fillRoundedRect(38 * s, 18 * s, 24 * s, 20 * s, 5 * s);
  g.fillRoundedRect(68 * s, 18 * s, 26 * s, 20 * s, 5 * s);
  g.fillStyle(0xfff1a8, 1);
  g.fillCircle(128 * s, 56 * s, 6 * s); // headlight (cars drive right)
  for (const wx of [34, 106]) {
    g.fillStyle(ol, 1);
    g.fillCircle(wx * s, 82 * s, 15 * s);
    g.fillStyle(0xc9ced8, 1);
    g.fillCircle(wx * s, 82 * s, 6 * s);
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
      g.fillStyle(PALETTE.windowBlue, 1);
      g.fillRect((x + 20) * s, (260 - h + 30) * s, 36 * s, 30 * s);
      g.fillRect((x + 84) * s, (260 - h + 30) * s, 36 * s, 30 * s);
    }
  });
  bakeIcon(scene, MG.duck, 82, 80, (g, s) => duck(g, s, false));
  bakeIcon(scene, MG.duckSad, 82, 80, (g, s) => duck(g, s, true));
  MG_CAR_COLORS.forEach((c, i) => bakeIcon(scene, MG.car(i), 140, 100, (g, s) => car(g, s, c)));
  bakeIcon(scene, MG.light, 130, 324, (g, s) => trafficLight(g, s, false));
  bakeIcon(scene, MG.lightRed, 130, 324, (g, s) => trafficLight(g, s, true));
  bakeIcon(scene, MG.flag, 40, 60, (g, s) => {
    g.lineStyle(4 * s, PALETTE.outline, 1);
    g.lineBetween(6 * s, 4 * s, 6 * s, 58 * s);
    g.fillStyle(PALETTE.grass, 1);
    g.fillTriangle(8 * s, 6 * s, 38 * s, 16 * s, 8 * s, 28 * s);
    g.strokeTriangle(8 * s, 6 * s, 38 * s, 16 * s, 8 * s, 28 * s);
  });
}
