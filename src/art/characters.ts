import type Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Facing } from '../entities/Player';
import { darken, lighten } from './color';
import { WT } from './renderScale';

export const FACINGS: Facing[] = ['NE', 'NW', 'SE', 'SW'];

/** Logical size of a character frame and where the feet sit inside it. */
export const CHAR_W = 48;
export const CHAR_H = 72;
export const CHAR_FOOT_Y = 66;

export interface CharacterLook {
  shirt: number;
  pants: number;
  hair: number;
  skin: number;
}

export const PLAYER_LOOK: CharacterLook = {
  shirt: PALETTE.builderYellow,
  pants: PALETTE.policeBlue,
  hair: 0x6b4226,
  skin: PALETTE.skin,
};

export function characterFrameKey(name: string, facing: Facing, frame: 0 | 1): string {
  return `${name}-${facing}-${frame}`;
}

/**
 * Draw a short, stubby, smooth character: round head (no peg), dot eyes, big smile.
 * Front views (SE/SW) show the face; back views (NE/NW) show hair. Frame 1 is the walk bob.
 */
function drawCharacter(
  g: Phaser.GameObjects.Graphics,
  look: CharacterLook,
  facing: Facing,
  frame: 0 | 1,
  s: number,
): void {
  const ol = PALETTE.outline;
  const cx = (CHAR_W / 2) * s;
  const foot = CHAR_FOOT_Y * s;
  const right = facing === 'SE' || facing === 'NE';
  const front = facing === 'SE' || facing === 'SW';
  const side = right ? 1 : -1;
  const bob = frame === 1 ? -3 * s : 0;

  // Shadow.
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, foot, 30 * s, 11 * s);

  // Legs (alternate stride on frame 1).
  const legW = 9 * s;
  const legH = 13 * s;
  const stride = frame === 1 ? 3 * s : 0;
  g.lineStyle(2 * s, ol, 1);
  for (const [i, lx] of [
    [0, cx - 10 * s],
    [1, cx + 1 * s],
  ] as const) {
    const ly = foot - legH - (i === 0 ? stride : 0);
    g.fillStyle(look.pants, 1);
    g.fillRoundedRect(lx, ly, legW, legH, 3 * s);
    g.strokeRoundedRect(lx, ly, legW, legH, 3 * s);
  }

  // Body.
  const bodyW = 26 * s;
  const bodyH = 20 * s;
  const bodyX = cx - bodyW / 2;
  const bodyY = foot - legH - bodyH + 3 * s + bob;
  // Arms.
  const armSwing = frame === 1 ? 2 * s : -1 * s;
  for (const dir of [-1, 1]) {
    const ax = dir < 0 ? bodyX - 6 * s : bodyX + bodyW - 1 * s;
    g.fillStyle(look.shirt, 1);
    g.fillRoundedRect(ax, bodyY + 3 * s + dir * armSwing, 7 * s, 14 * s, 3.5 * s);
    g.strokeRoundedRect(ax, bodyY + 3 * s + dir * armSwing, 7 * s, 14 * s, 3.5 * s);
    g.fillStyle(look.skin, 1);
    g.fillCircle(ax + 3.5 * s, bodyY + 17 * s + dir * armSwing, 3.5 * s);
    g.strokeCircle(ax + 3.5 * s, bodyY + 17 * s + dir * armSwing, 3.5 * s);
  }
  g.fillStyle(look.shirt, 1);
  g.fillRoundedRect(bodyX, bodyY, bodyW, bodyH, 7 * s);
  // Shaded side of the shirt (the side turned away from the light).
  g.fillStyle(darken(look.shirt, 0.15), 1);
  g.fillRoundedRect(
    right ? bodyX + bodyW * 0.62 : bodyX,
    bodyY + 2 * s,
    bodyW * 0.38,
    bodyH - 4 * s,
    5 * s,
  );
  g.lineStyle(2 * s, ol, 1);
  g.strokeRoundedRect(bodyX, bodyY, bodyW, bodyH, 7 * s);

  // Head: a smooth ball, no peg.
  const hr = 13 * s;
  const hx = cx + side * 1 * s;
  const hy = bodyY - hr + 4 * s;
  g.fillStyle(look.skin, 1);
  g.fillCircle(hx, hy, hr);
  // Hair cap.
  g.fillStyle(look.hair, 1);
  if (front) {
    g.slice(hx, hy, hr, Math.PI * 1.02, Math.PI * 1.98, false);
    g.fillPath();
  } else {
    g.slice(hx, hy, hr, Math.PI * 0.85, Math.PI * 2.15, false);
    g.fillPath();
    g.fillCircle(hx, hy, hr * 0.92);
  }
  g.lineStyle(2 * s, ol, 1);
  g.strokeCircle(hx, hy, hr);
  // Highlight.
  g.fillStyle(lighten(look.skin, 0.6), 0.6);
  g.fillCircle(hx - side * 5 * s, hy - 6 * s, 2.5 * s);

  if (front) {
    // Dot eyes, shifted toward the facing side, and a big smile.
    const ex = hx + side * 3 * s;
    g.fillStyle(ol, 1);
    g.fillCircle(ex - 5 * s, hy + 1 * s, 2.2 * s);
    g.fillCircle(ex + 5 * s, hy + 1 * s, 2.2 * s);
    g.lineStyle(2 * s, ol, 1);
    g.beginPath();
    g.arc(ex, hy + 4 * s, 5 * s, Math.PI * 0.15, Math.PI * 0.85, false);
    g.strokePath();
    // Cheeks.
    g.fillStyle(0xff8f8f, 0.5);
    g.fillCircle(ex - 9 * s, hy + 5 * s, 2.5 * s);
    g.fillCircle(ex + 9 * s, hy + 5 * s, 2.5 * s);
  }
}

/** Bake all frames (4 facings × 2 bob frames) for a character look. */
export function bakeCharacter(scene: Phaser.Scene, name: string, look: CharacterLook): void {
  for (const facing of FACINGS) {
    for (const frame of [0, 1] as const) {
      const key = characterFrameKey(name, facing, frame);
      if (scene.textures.exists(key)) continue;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawCharacter(g, look, facing, frame, WT);
      g.generateTexture(key, Math.ceil(CHAR_W * WT), Math.ceil(CHAR_H * WT));
      g.destroy();
    }
  }
}
