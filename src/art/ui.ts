import type Phaser from 'phaser';
import { JOYSTICK_RADIUS, PALETTE } from '../config';
import { darken, lighten } from './color';
import { RS, WT } from './renderScale';

export const UI = {
  play: 'ui-play',
  stickBase: 'ui-stick-base',
  stickKnob: 'ui-stick-knob',
  target: 'ui-target',
} as const;

export const PLAY_SIZE = 200;
export const KNOB_R = 34;

function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics, s: number) => void,
  scale = RS,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g, scale);
  g.generateTexture(key, Math.ceil(w * scale), Math.ceil(h * scale));
  g.destroy();
}

/** Icon-only UI art: round, chunky, outlined. */
export function bakeUi(scene: Phaser.Scene): void {
  // Big round Play button with a triangle.
  bake(scene, UI.play, PLAY_SIZE + 12, PLAY_SIZE + 20, (g, s) => {
    const c = ((PLAY_SIZE + 12) / 2) * s;
    const r = (PLAY_SIZE / 2) * s;
    g.fillStyle(darken(PALETTE.policeBlue, 0.35), 1);
    g.fillCircle(c, c + 10 * s, r);
    g.fillStyle(PALETTE.policeBlue, 1);
    g.fillCircle(c, c, r);
    g.fillStyle(lighten(PALETTE.policeBlue, 0.25), 1);
    g.fillCircle(c, c, r * 0.82);
    g.lineStyle(6 * s, PALETTE.outline, 1);
    g.strokeCircle(c, c, r);
    const t = r * 0.42;
    const pts = [
      { x: c - t * 0.7, y: c - t },
      { x: c + t * 1.05, y: c },
      { x: c - t * 0.7, y: c + t },
    ];
    g.fillStyle(PALETTE.buildingWhite, 1);
    g.fillPoints(pts, true);
    g.lineStyle(6 * s, PALETTE.outline, 1);
    g.strokePoints(pts, true);
  });

  // Joystick base + knob.
  const baseD = JOYSTICK_RADIUS * 2 + 16;
  bake(scene, UI.stickBase, baseD, baseD, (g, s) => {
    const c = (baseD / 2) * s;
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(c, c, JOYSTICK_RADIUS * s);
    g.lineStyle(4 * s, PALETTE.outline, 0.6);
    g.strokeCircle(c, c, JOYSTICK_RADIUS * s);
  });
  const knobD = KNOB_R * 2 + 8;
  bake(scene, UI.stickKnob, knobD, knobD, (g, s) => {
    const c = (knobD / 2) * s;
    g.fillStyle(PALETTE.coinGold, 1);
    g.fillCircle(c, c, KNOB_R * s);
    g.fillStyle(lighten(PALETTE.coinGold, 0.4), 1);
    g.fillCircle(c - 8 * s, c - 9 * s, 8 * s);
    g.lineStyle(4 * s, PALETTE.outline, 1);
    g.strokeCircle(c, c, KNOB_R * s);
  });

  // Go-to target marker: a flat diamond ring on the ground.
  bake(
    scene,
    UI.target,
    68,
    36,
    (g, s) => {
      const pts = [
        { x: 34 * s, y: 2 * s },
        { x: 66 * s, y: 18 * s },
        { x: 34 * s, y: 34 * s },
        { x: 2 * s, y: 18 * s },
      ];
      g.lineStyle(5 * s, PALETTE.coinGold, 1);
      g.strokePoints(pts, true);
    },
    WT,
  );
}
