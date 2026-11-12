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
  /** Black-and-white striped shirt (robbers). */
  stripes?: boolean;
  /** Black eye mask (robbers). */
  mask?: boolean;
  hat?: 'cop' | 'chef' | 'fire' | 'hardhat' | 'pirate' | 'duck';
}

export const PLAYER_LOOK: CharacterLook = {
  shirt: PALETTE.policeBlue,
  pants: 0x24407a,
  hair: 0x6b4226,
  skin: PALETTE.skin,
  hat: 'cop',
};

/** Every other character in the slice, by look id (used by content, e.g. map walkers). */
export const LOOKS: Record<string, CharacterLook> = {
  player: PLAYER_LOOK,
  pickles: {
    shirt: 0xffffff,
    pants: 0x3a3d52,
    hair: 0xd9822b,
    skin: PALETTE.skin,
    stripes: true,
    mask: true,
  },
  smudge: {
    shirt: 0xffffff,
    pants: 0x3a3d52,
    hair: 0x2b1d14,
    skin: 0xe0ac7e,
    stripes: true,
    mask: true,
  },
  /** The player before First Day hands over the cap. */
  playerPlain: { ...PLAYER_LOOK, hat: undefined },
  playerFire: { ...PLAYER_LOOK, shirt: PALETTE.fireRed, pants: 0x3a3d52, hat: 'fire' },
  playerBuilder: { ...PLAYER_LOOK, shirt: PALETTE.coneOrange, pants: 0x2f6fde, hat: 'hardhat' },
  fireChief: {
    shirt: PALETTE.fireRed,
    pants: 0x2b2d42,
    hair: 0x3b2a1a,
    skin: 0x8d5a3b,
    hat: 'fire',
  },
  florist: { shirt: PALETTE.grass, pants: PALETTE.donutPink, hair: 0xd9822b, skin: 0xf2c9a0 },
  painter: { shirt: 0xffffff, pants: PALETTE.harborTeal, hair: 0x111111, skin: 0x8d5a3b },
  teacher: { shirt: PALETTE.getawayPurple, pants: 0x3a3d52, hair: 0x6b4226, skin: 0xe0ac7e },
  grandpa: { shirt: PALETTE.policeBlue, pants: 0x6e6e8a, hair: 0xe8e8e8, skin: PALETTE.skin },
  foreman: {
    shirt: PALETTE.builderYellow,
    pants: 0x5a4632,
    hair: 0x6b4226,
    skin: 0xe0ac7e,
    hat: 'hardhat',
  },
  chief: { shirt: 0x1f4fa8, pants: 0x1a2f5e, hair: 0xb0b0b0, skin: 0xc68a5e, hat: 'cop' },
  mayor: { shirt: 0x6b3fa0, pants: 0x2b2d42, hair: 0x6b4226, skin: PALETTE.skin },
  kid: { shirt: PALETTE.coinGold, pants: 0x2f6fde, hair: 0x2b1d14, skin: 0x8d5a3b },
  grandma: { shirt: PALETTE.donutPink, pants: 0x6e6e8a, hair: 0xe8e8e8, skin: 0xf2c9a0 },
  baker: { shirt: 0xffffff, pants: PALETTE.donutPink, hair: 0x3b2a1a, skin: 0xc68a5e, hat: 'chef' },
  walkerRed: { shirt: PALETTE.fireRed, pants: 0x3a3d52, hair: 0x2b1d14, skin: 0xe0ac7e },
  walkerGreen: { shirt: PALETTE.grass, pants: 0x5a4632, hair: 0xf0c75e, skin: PALETTE.skin },
  walkerBlue: { shirt: PALETTE.harborTeal, pants: 0x3a3d52, hair: 0x111111, skin: 0x8d5a3b },
  walkerPurple: { shirt: PALETTE.getawayPurple, pants: 0x2f6fde, hair: 0xa0522d, skin: 0xf2c9a0 },
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
  if (look.stripes) {
    g.fillStyle(PALETTE.robberBlack, 1);
    for (let k = 1; k < 4; k++)
      g.fillRect(bodyX + 2 * s, bodyY + k * 5 * s, bodyW - 4 * s, 2.5 * s);
  }
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

  if (look.mask) {
    // A goofy black eye mask (a band, with eye holes on the front).
    g.fillStyle(PALETTE.robberBlack, 1);
    g.fillRoundedRect(hx - hr + 1 * s, hy - 4 * s, hr * 2 - 2 * s, 8 * s, 3 * s);
    if (front) {
      const ex = hx + side * 3 * s;
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex - 5 * s, hy, 2.6 * s);
      g.fillCircle(ex + 5 * s, hy, 2.6 * s);
      g.fillStyle(ol, 1);
      g.fillCircle(ex - 5 * s, hy, 1.4 * s);
      g.fillCircle(ex + 5 * s, hy, 1.4 * s);
    }
  }
  if (look.hat === 'cop') {
    // Flat-topped police cap with a brim and a gold badge (smooth, no peg).
    g.fillStyle(PALETTE.policeBlue, 1);
    g.lineStyle(2 * s, ol, 1);
    g.fillRoundedRect(hx - 12 * s, hy - hr - 4 * s, 24 * s, 10 * s, 3 * s);
    g.strokeRoundedRect(hx - 12 * s, hy - hr - 4 * s, 24 * s, 10 * s, 3 * s);
    g.fillStyle(0x1d2b4f, 1);
    g.fillRoundedRect(
      hx - 13 * s + side * (front ? 3 : -3) * s,
      hy - hr + 4 * s,
      26 * s,
      4 * s,
      2 * s,
    );
    if (front) {
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillCircle(hx + side * 2 * s, hy - hr + 1 * s, 2.8 * s);
    }
  } else if (look.hat === 'chef') {
    g.fillStyle(0xffffff, 1);
    g.lineStyle(2 * s, ol, 1);
    for (const [dx, dy, r] of [
      [-6, -16, 6],
      [6, -16, 6],
      [0, -20, 7],
    ] as const) {
      g.fillCircle(hx + dx * s, hy + dy * s - hr * 0.6, r * s);
      g.strokeCircle(hx + dx * s, hy + dy * s - hr * 0.6, r * s);
    }
    g.fillRoundedRect(hx - 10 * s, hy - hr - 6 * s, 20 * s, 8 * s, 2 * s);
    g.strokeRoundedRect(hx - 10 * s, hy - hr - 6 * s, 20 * s, 8 * s, 2 * s);
  } else if (look.hat === 'pirate') {
    // A black three-corner hat with a white dot.
    g.fillStyle(0x2b2d42, 1);
    g.lineStyle(2 * s, ol, 1);
    const pts = [
      { x: hx - 17 * s, y: hy - hr + 6 * s },
      { x: hx - 8 * s, y: hy - hr - 10 * s },
      { x: hx, y: hy - hr - 4 * s },
      { x: hx + 8 * s, y: hy - hr - 10 * s },
      { x: hx + 17 * s, y: hy - hr + 6 * s },
    ];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
    if (front) {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(hx + side * 2 * s, hy - hr - 1 * s, 3 * s);
    }
  } else if (look.hat === 'duck') {
    // A rubber-duck hat: a little yellow duck sitting on the head.
    g.fillStyle(0xffd23f, 1);
    g.lineStyle(2 * s, ol, 1);
    g.fillEllipse(hx, hy - hr - 1 * s, 24 * s, 13 * s);
    g.strokeEllipse(hx, hy - hr - 1 * s, 24 * s, 13 * s);
    g.fillCircle(hx + side * 6 * s, hy - hr - 9 * s, 6 * s);
    g.strokeCircle(hx + side * 6 * s, hy - hr - 9 * s, 6 * s);
    g.fillStyle(PALETTE.coneOrange, 1);
    g.fillTriangle(
      hx + side * 11 * s,
      hy - hr - 10 * s,
      hx + side * 16 * s,
      hy - hr - 8 * s,
      hx + side * 11 * s,
      hy - hr - 6 * s,
    );
  } else if (look.hat === 'fire' || look.hat === 'hardhat') {
    // Rounded helmet: red with a gold shield (fire) or yellow with a ridge (builder).
    const fire = look.hat === 'fire';
    g.fillStyle(fire ? PALETTE.fireRed : PALETTE.builderYellow, 1);
    g.lineStyle(2 * s, ol, 1);
    g.slice(hx, hy - hr + 6 * s, 13 * s, Math.PI, 0, false);
    g.fillPath();
    g.strokePath();
    g.fillRoundedRect(
      hx - 16 * s + side * (front ? 2 : -2) * s,
      hy - hr + 4 * s,
      32 * s,
      5 * s,
      2 * s,
    );
    g.strokeRoundedRect(
      hx - 16 * s + side * (front ? 2 : -2) * s,
      hy - hr + 4 * s,
      32 * s,
      5 * s,
      2 * s,
    );
    if (fire && front) {
      g.fillStyle(PALETTE.coinGold, 1);
      g.fillCircle(hx + side * 2 * s, hy - hr - 1 * s, 3.4 * s);
    } else if (!fire) {
      g.lineStyle(2 * s, ol, 1);
      g.lineBetween(hx, hy - hr - 7 * s, hx, hy - hr + 4 * s);
    }
  }
}

/** Bake all frames (4 facings × 2 bob frames) for a character look. */
/**
 * Make sure a look's frames exist. Composite looks (`<base>+<hat>`, spec 006) are baked the first
 * time they're needed: the base look with a different hat.
 */
export function ensureLook(scene: Phaser.Scene, name: string): void {
  if (scene.textures.exists(characterFrameKey(name, 'SW', 0))) return;
  const [base, hat] = name.split('+');
  const look = LOOKS[base ?? ''];
  if (!look) return;
  bakeCharacter(scene, name, hat ? { ...look, hat: hat as CharacterLook['hat'] } : look);
}

/** A big front-facing portrait frame (minigame line-ups): `big-<name>`, drawn at 3× logical size. */
export const BIG_CHAR_SCALE = 3;
export const bigCharacterKey = (name: string) => `big-${name}`;

export function bakeBigCharacter(scene: Phaser.Scene, name: string, look: CharacterLook): void {
  const key = bigCharacterKey(name);
  if (scene.textures.exists(key)) return;
  const s = WT * BIG_CHAR_SCALE;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  drawCharacter(g, look, 'SW', 0, s);
  g.generateTexture(key, Math.ceil(CHAR_W * s), Math.ceil(CHAR_H * s));
  g.destroy();
}

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
