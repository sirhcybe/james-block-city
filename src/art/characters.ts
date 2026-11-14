import type Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Facing } from '../entities/Player';
import {
  bakeCanvas,
  circlePath,
  clipped,
  css,
  ellipsePath,
  paint,
  roundRectPath,
  type Ctx,
} from './bake';
import { darken, lighten, mix } from './color';
import { WT } from './renderScale';

export const FACINGS: Facing[] = ['NE', 'NW', 'SE', 'SW'];

/**
 * Logical size of a character frame and where the feet sit inside it. The frame has head room
 * above the head so the tallest hat (the chef's) is never cut off.
 */
export const CHAR_W = 48;
export const CHAR_H = 88;
export const CHAR_FOOT_Y = 82;

/** Frame 0 stands; 1 and 2 are the two steps of the walk (left leg up, right leg up). */
export type CharFrame = 0 | 1 | 2;
export const CHAR_FRAMES: CharFrame[] = [0, 1, 2];

/** Seconds each walk pose is held, and the poses in order: step, stand, other step, stand. */
export const WALK_STEP_SEC = 0.11;
const WALK_CYCLE: CharFrame[] = [1, 0, 2, 0];

/** The frame to show after walking for `t` seconds (starts on a step, so a short walk still steps). */
export function walkFrame(t: number): CharFrame {
  const i = Math.floor(Math.max(0, t) / WALK_STEP_SEC) % WALK_CYCLE.length;
  return WALK_CYCLE[i]!;
}

export type HatName = 'cop' | 'chef' | 'fire' | 'hardhat' | 'pirate' | 'duck';

export interface CharacterLook {
  shirt: number;
  pants: number;
  hair: number;
  skin: number;
  /** Black-and-white striped shirt (robbers). */
  stripes?: boolean;
  /** Black eye mask (robbers). */
  mask?: boolean;
  hat?: HatName;
  /** Hair shape (default short). */
  hairStyle?: 'short' | 'long' | 'bun' | 'bald';
  glasses?: boolean;
  moustache?: boolean;
  /** A small extra on the outfit, so jobs read at a glance. */
  detail?: 'badge' | 'hiVis' | 'vest' | 'apron' | 'tie' | 'buttons' | 'cross';
}

export const PLAYER_LOOK: CharacterLook = {
  shirt: PALETTE.policeBlue,
  pants: 0x24407a,
  hair: 0x6b4226,
  skin: PALETTE.skin,
  hat: 'cop',
  detail: 'badge',
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
  playerPlain: { ...PLAYER_LOOK, hat: undefined, detail: undefined },
  playerFire: {
    ...PLAYER_LOOK,
    shirt: PALETTE.fireRed,
    pants: 0x3a3d52,
    hat: 'fire',
    detail: 'hiVis',
  },
  playerBuilder: {
    ...PLAYER_LOOK,
    shirt: PALETTE.coneOrange,
    pants: 0x2f6fde,
    hat: 'hardhat',
    detail: 'vest',
  },
  fireChief: {
    shirt: PALETTE.fireRed,
    pants: 0x2b2d42,
    hair: 0x3b2a1a,
    skin: 0x8d5a3b,
    hat: 'fire',
    detail: 'hiVis',
    moustache: true,
  },
  florist: {
    shirt: PALETTE.grass,
    pants: PALETTE.donutPink,
    hair: 0xd9822b,
    skin: 0xf2c9a0,
    hairStyle: 'long',
    detail: 'apron',
  },
  painter: {
    shirt: 0xffffff,
    pants: PALETTE.harborTeal,
    hair: 0x111111,
    skin: 0x8d5a3b,
    detail: 'buttons',
  },
  teacher: {
    shirt: PALETTE.getawayPurple,
    pants: 0x3a3d52,
    hair: 0x6b4226,
    skin: 0xe0ac7e,
    hairStyle: 'bun',
    glasses: true,
  },
  grandpa: {
    shirt: PALETTE.policeBlue,
    pants: 0x6e6e8a,
    hair: 0xe8e8e8,
    skin: PALETTE.skin,
    hairStyle: 'bald',
    moustache: true,
    detail: 'buttons',
  },
  foreman: {
    shirt: PALETTE.builderYellow,
    pants: 0x5a4632,
    hair: 0x6b4226,
    skin: 0xe0ac7e,
    hat: 'hardhat',
    detail: 'vest',
  },
  chief: {
    shirt: 0x1f4fa8,
    pants: 0x1a2f5e,
    hair: 0xb0b0b0,
    skin: 0xc68a5e,
    hat: 'cop',
    detail: 'badge',
    moustache: true,
  },
  mayor: { shirt: 0x6b3fa0, pants: 0x2b2d42, hair: 0x6b4226, skin: PALETTE.skin, detail: 'tie' },
  kid: { shirt: PALETTE.coinGold, pants: 0x2f6fde, hair: 0x2b1d14, skin: 0x8d5a3b },
  grandma: {
    shirt: PALETTE.donutPink,
    pants: 0x6e6e8a,
    hair: 0xe8e8e8,
    skin: 0xf2c9a0,
    hairStyle: 'bun',
    glasses: true,
  },
  baker: {
    shirt: 0xffffff,
    pants: PALETTE.donutPink,
    hair: 0x3b2a1a,
    skin: 0xc68a5e,
    hat: 'chef',
    detail: 'apron',
  },
  lifeguard: {
    shirt: PALETTE.fireRed,
    pants: PALETTE.coinGold,
    hair: 0xf0c75e,
    skin: 0xd9a066,
    detail: 'cross',
  },
  walkerRed: { shirt: PALETTE.fireRed, pants: 0x3a3d52, hair: 0x2b1d14, skin: 0xe0ac7e },
  walkerGreen: {
    shirt: PALETTE.grass,
    pants: 0x5a4632,
    hair: 0xf0c75e,
    skin: PALETTE.skin,
    hairStyle: 'long',
  },
  walkerBlue: { shirt: PALETTE.harborTeal, pants: 0x3a3d52, hair: 0x111111, skin: 0x8d5a3b },
  walkerPurple: {
    shirt: PALETTE.getawayPurple,
    pants: 0x2f6fde,
    hair: 0xa0522d,
    skin: 0xf2c9a0,
    detail: 'buttons',
  },
};

export function characterFrameKey(name: string, facing: Facing, frame: CharFrame): string {
  return `${name}-${facing}-${frame}`;
}

/* ------------------------------------------------------------------------------------------------
 * Layout. Everything is in logical px relative to the point between the feet; y grows downward.
 * ---------------------------------------------------------------------------------------------- */

const OL = PALETTE.outline;
/** Outline width (logical px). */
const LW = 2;
export const HEAD_R = 13;
const BODY_W = 26;
const BODY_H = 20;
const LEG_W = 9;
const LEG_H = 13;
/** Top of the body and centre of the head when standing. */
const BODY_TOP = -(LEG_H + BODY_H - 3);
const HEAD_Y = BODY_TOP - HEAD_R + 4;

export interface FaceLayout {
  /** Circles as [x, y, r] relative to the head centre. */
  eyes: [number, number, number][];
  cheeks: [number, number, number][];
  /** The smile is an arc: centre, radius and the two angles. */
  smile: { x: number; y: number; r: number; a0: number; a1: number };
  /** The mask band: top and bottom (it is clipped to the head, so only y matters). */
  mask: { y0: number; y1: number };
}

/**
 * Where the face parts go on a front view. `side` is +1 when the character looks to the right of
 * the screen, −1 to the left: the face shifts a little that way. Every part lies inside the head
 * circle (radius `HEAD_R`); `characters.test.ts` checks it.
 */
export function faceLayout(side: 1 | -1, masked = false, lowSmile = masked): FaceLayout {
  const ex = side * 2;
  const smileY = lowSmile ? 5.2 : 4.2;
  return {
    eyes: [
      [ex - 4.6, 2.2, masked ? 2.7 : 2.1],
      [ex + 4.6, 2.2, masked ? 2.7 : 2.1],
    ],
    cheeks: masked
      ? []
      : [
          [ex - 7, 5.6, 2.1],
          [ex + 7, 5.6, 2.1],
        ],
    smile: { x: ex, y: smileY, r: 4.6, a0: Math.PI * 0.18, a1: Math.PI * 0.82 },
    mask: { y0: -2.6, y1: 5.8 },
  };
}

interface Pose {
  right: boolean;
  front: boolean;
  side: 1 | -1;
  /** +1 = the screen-left leg is up, −1 = the screen-right leg, 0 = standing. */
  step: -1 | 0 | 1;
  bob: number;
}

function poseOf(facing: Facing, frame: CharFrame): Pose {
  const right = facing === 'SE' || facing === 'NE';
  return {
    right,
    front: facing === 'SE' || facing === 'SW',
    side: right ? 1 : -1,
    step: frame === 0 ? 0 : frame === 1 ? 1 : -1,
    bob: frame === 0 ? 0 : -2,
  };
}

function shoeColor(look: CharacterLook): number {
  return mix(darken(look.pants, 0.5), 0x2b2d42, 0.35);
}

function drawLegs(ctx: Ctx, look: CharacterLook, p: Pose): void {
  for (const i of [-1, 1] as const) {
    const up = (p.step === 1 && i === -1) || (p.step === -1 && i === 1) ? 3.5 : 0;
    const x = i < 0 ? -LEG_W - 1 : 1;
    const y = -LEG_H - up;
    roundRectPath(ctx, x, y, LEG_W, LEG_H, 3);
    paint(ctx, look.pants, null);
    clipped(ctx, () => {
      // Shaded inner half, then the shoe across the bottom.
      ctx.fillStyle = css(darken(look.pants, 0.14));
      ctx.fillRect(x + LEG_W * 0.55, y, LEG_W, LEG_H);
      ctx.fillStyle = css(shoeColor(look));
      ctx.fillRect(x - 1, y + LEG_H - 4.6, LEG_W + 2, 6);
    });
    roundRectPath(ctx, x, y, LEG_W, LEG_H, 3);
    paint(ctx, null, OL, LW);
  }
}

function stripesIn(ctx: Ctx, x: number, y: number, w: number, h: number, gap: number): void {
  ctx.fillStyle = css(PALETTE.robberBlack);
  for (let yy = y + gap; yy < y + h - 1; yy += gap) ctx.fillRect(x - 1, yy, w + 2, 2.5);
}

/** Both arms hang at the sides, behind the body; they swing against the legs. */
function drawArms(ctx: Ctx, look: CharacterLook, p: Pose, bodyTop: number): void {
  for (const i of [-1, 1] as const) {
    const swing = p.step === 0 ? 0 : p.step === i ? 1.5 : -2;
    const x = i < 0 ? -BODY_W / 2 - 5 : BODY_W / 2 - 2;
    const y = bodyTop + 3 + swing;
    // Hand first, so the sleeve's cuff sits over it.
    circlePath(ctx, x + 3.5, y + 13.4, 3.4);
    paint(ctx, look.skin, OL, LW);
    roundRectPath(ctx, x, y, 7, 13, 3.5);
    paint(ctx, look.shirt, null);
    clipped(ctx, () => {
      if (i > 0) {
        ctx.fillStyle = css(darken(look.shirt, 0.14));
        ctx.fillRect(x, y, 7, 13);
      }
      if (look.stripes) stripesIn(ctx, x, y - 1, 7, 14, 5);
    });
    roundRectPath(ctx, x, y, 7, 13, 3.5);
    paint(ctx, null, OL, LW);
  }
}

function drawBody(ctx: Ctx, look: CharacterLook, p: Pose, bodyTop: number, h = BODY_H): void {
  const x = -BODY_W / 2;
  const body = () => roundRectPath(ctx, x, bodyTop, BODY_W, h, 7);
  body();
  paint(ctx, look.shirt, null);
  clipped(ctx, () => {
    // Light comes from the upper left, like the blocks: the right side is in shade.
    ctx.fillStyle = css(darken(look.shirt, 0.14));
    ctx.fillRect(x + BODY_W * 0.66, bodyTop, BODY_W, h);
    if (look.stripes) stripesIn(ctx, x, bodyTop, BODY_W, h, 5);
    drawOutfitDetail(ctx, look, p, bodyTop, h);
  });
  body();
  paint(ctx, null, OL, LW);
}

/** Outfit extras, drawn inside the body's clip so they can never stick out. */
function drawOutfitDetail(ctx: Ctx, look: CharacterLook, p: Pose, top: number, h: number): void {
  const x = -BODY_W / 2;
  const belt = (color: number, buckle: number | null) => {
    ctx.fillStyle = css(color);
    ctx.fillRect(x, top + h - 6.5, BODY_W, 3);
    if (buckle !== null && p.front) {
      ctx.fillStyle = css(buckle);
      ctx.fillRect(-2, top + h - 7, 4, 4);
    }
  };
  switch (look.detail) {
    case 'badge':
      belt(0x1d2b4f, PALETTE.coinGold);
      if (p.front) {
        circlePath(ctx, -5.5, top + 8, 2.6);
        paint(ctx, PALETTE.coinGold, OL, 1.2);
      }
      return;
    case 'hiVis':
      ctx.fillStyle = css(PALETTE.coinGold);
      ctx.fillRect(x, top + h - 9, BODY_W, 3);
      ctx.fillStyle = css(0xffffff, 0.85);
      ctx.fillRect(x, top + h - 8, BODY_W, 1);
      return;
    case 'vest':
      // Two bright straps and a band: a safety vest.
      ctx.fillStyle = css(lighten(PALETTE.coinGold, 0.35));
      ctx.fillRect(-8.5, top, 3.2, h);
      ctx.fillRect(5.3, top, 3.2, h);
      ctx.fillRect(x, top + h - 8.5, BODY_W, 2.6);
      return;
    case 'apron': {
      const apronColor = look.shirt === 0xffffff ? 0xffd9ea : 0xffffff;
      if (!p.front) {
        // Seen from behind: just the bow of the apron strings.
        ctx.fillStyle = css(apronColor);
        ctx.fillRect(x, top + 10, BODY_W, 1.8);
        return;
      }
      const c = apronColor;
      roundRectPath(ctx, -7.5, top + 6.5, 15, h, 3);
      paint(ctx, c, OL, 1.2);
      ctx.fillStyle = css(darken(c, 0.14));
      ctx.fillRect(-3.5, top + 12, 7, 1.4);
      return;
    }
    case 'tie':
      if (!p.front) return;
      ctx.beginPath();
      ctx.moveTo(-2, top + 3);
      ctx.lineTo(2, top + 3);
      ctx.lineTo(3, top + 12);
      ctx.lineTo(0, top + 15);
      ctx.lineTo(-3, top + 12);
      ctx.closePath();
      paint(ctx, PALETTE.coinGold, OL, 1.2);
      return;
    case 'buttons':
      if (!p.front) return;
      ctx.fillStyle = css(darken(look.shirt, 0.35));
      for (const dy of [8, 13]) {
        circlePath(ctx, 0, top + dy, 1.1);
        ctx.fill();
      }
      return;
    case 'cross':
      if (!p.front) return;
      // A white cross on the chest (lifeguard).
      ctx.fillStyle = css(0xffffff);
      ctx.fillRect(-2, top + 6, 4, 9);
      ctx.fillRect(-5, top + 8.6, 10, 3.8);
      return;
    default:
      return;
  }
}

/** Hair that hangs behind the head and shoulders on front views (drawn before the body). */
function drawHairBehind(ctx: Ctx, look: CharacterLook, p: Pose, hx: number, hy: number): void {
  if (look.hairStyle === 'long' && p.front) {
    roundRectPath(ctx, hx - HEAD_R - 1.5, hy - 5, HEAD_R * 2 + 3, 21, 7);
    paint(ctx, look.hair, OL, LW);
  }
  if (look.hairStyle === 'bun' && p.front && !look.hat) {
    circlePath(ctx, hx - p.side * 3, hy - HEAD_R - 1.5, 5);
    paint(ctx, look.hair, OL, LW);
  }
}

function drawHead(ctx: Ctx, look: CharacterLook, p: Pose, hx: number, hy: number): void {
  const face = faceLayout(p.side, look.mask, look.mask || look.moustache);
  const bald = look.hairStyle === 'bald';

  // Ears: half hidden by the head, and by long hair.
  if (look.hairStyle !== 'long') {
    for (const i of [-1, 1]) {
      circlePath(ctx, hx + i * (HEAD_R - 0.4), hy + 2.6, 2.7);
      paint(ctx, look.skin, OL, LW);
    }
  }

  circlePath(ctx, hx, hy, HEAD_R);
  paint(ctx, darken(look.skin, 0.1), null);
  clipped(ctx, () => {
    // Lit from the upper left: the lower right edge stays a shade darker.
    circlePath(ctx, hx - 2.2, hy - 2.2, HEAD_R);
    paint(ctx, look.skin, null);

    if (p.front) {
      if (bald) {
        // A fringe over each ear.
        for (const i of [-1, 1]) {
          ellipsePath(ctx, hx + i * (HEAD_R - 1), hy - 3.5, 3.6, 5.5);
          paint(ctx, look.hair, null);
        }
      } else {
        // A fringe swept away from the way they are looking.
        ellipsePath(ctx, hx - p.side * 3, hy - 10.5, 16, 8.4);
        paint(ctx, look.hair, null);
        ellipsePath(ctx, hx - p.side * 6, hy - 11.5, 9, 4);
        paint(ctx, lighten(look.hair, 0.16), null);
      }
      for (const [x, y, r] of face.cheeks) {
        circlePath(ctx, hx + x, hy + y, r);
        paint(ctx, 0xff7f8f, null, 0, 0.5);
      }
      if (look.mask) {
        ctx.fillStyle = css(PALETTE.robberBlack);
        ctx.fillRect(hx - HEAD_R, hy + face.mask.y0, HEAD_R * 2, face.mask.y1 - face.mask.y0);
      }
    } else {
      // Back of the head: hair all over, a strip of neck showing underneath.
      ctx.fillStyle = css(look.hair);
      ctx.fillRect(hx - HEAD_R, hy - HEAD_R, HEAD_R * 2, HEAD_R + 8);
      if (bald) {
        // A horseshoe of hair around a bald crown.
        ellipsePath(ctx, hx, hy - 6, 9.5, 9);
        paint(ctx, look.skin, null);
        ellipsePath(ctx, hx - 3.5, hy - 9, 3, 1.8);
        paint(ctx, lighten(look.skin, 0.5), null, 0, 0.7);
      } else {
        ellipsePath(ctx, hx - 4, hy - 7.5, 6.5, 3.4);
        paint(ctx, lighten(look.hair, 0.16), null);
      }
      if (look.mask) {
        // Just the strap of the mask goes round the back.
        ctx.fillStyle = css(0x4a4e5c);
        ctx.fillRect(hx - HEAD_R, hy + face.mask.y0 + 2.2, HEAD_R * 2, 3);
      }
    }
  });
  circlePath(ctx, hx, hy, HEAD_R);
  paint(ctx, null, OL, LW);

  if (!p.front) {
    if (look.hairStyle === 'long') {
      // Long hair falls over the neck and shoulders.
      roundRectPath(ctx, hx - HEAD_R, hy + 1, HEAD_R * 2, 15, 6);
      paint(ctx, look.hair, null);
      ctx.beginPath();
      ctx.moveTo(hx - HEAD_R, hy + 3);
      ctx.lineTo(hx - HEAD_R, hy + 10);
      ctx.arcTo(hx - HEAD_R, hy + 16, hx - HEAD_R + 6, hy + 16, 6);
      ctx.lineTo(hx + HEAD_R - 6, hy + 16);
      ctx.arcTo(hx + HEAD_R, hy + 16, hx + HEAD_R, hy + 10, 6);
      ctx.lineTo(hx + HEAD_R, hy + 3);
      paint(ctx, null, OL, LW);
    }
    if (look.hairStyle === 'bun' && !look.hat) {
      circlePath(ctx, hx, hy - 6, 5.2);
      paint(ctx, look.hair, OL, LW);
    }
    if (look.mask) {
      // The knot of the mask: a small bow at the back of the head.
      const kx = hx - p.side * 2;
      const ky = hy + face.mask.y0 + 3.7;
      for (const i of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx + i * 5, ky - 2.8);
        ctx.lineTo(kx + i * 5, ky + 2.8);
        ctx.closePath();
        paint(ctx, 0x4a4e5c, OL, 1.2);
      }
      circlePath(ctx, kx, ky, 1.7);
      paint(ctx, 0x4a4e5c, OL, 1.2);
    }
    return;
  }

  // Eyes: dots with a glint (white holes with pupils behind a mask).
  for (const [x, y, r] of face.eyes) {
    circlePath(ctx, hx + x, hy + y, r);
    paint(ctx, look.mask ? 0xffffff : OL, null);
    if (look.mask) {
      circlePath(ctx, hx + x + p.side * 0.5, hy + y + 0.2, 1.4);
      paint(ctx, OL, null);
    } else {
      circlePath(ctx, hx + x - 0.7, hy + y - 0.8, 0.7);
      paint(ctx, 0xffffff, null);
    }
  }
  if (look.glasses) {
    ctx.strokeStyle = css(OL);
    ctx.lineWidth = 1.2;
    for (const [x, y] of face.eyes) {
      circlePath(ctx, hx + x, hy + y, 3.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(hx + face.eyes[0]![0] + 3.6, hy + 2.2);
    ctx.lineTo(hx + face.eyes[1]![0] - 3.6, hy + 2.2);
    ctx.stroke();
  }
  // Big smile.
  const sm = face.smile;
  ctx.beginPath();
  ctx.arc(hx + sm.x, hy + sm.y, sm.r, sm.a0, sm.a1, false);
  ctx.strokeStyle = css(OL);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  if (look.moustache) {
    // Two little curls over the smile.
    ctx.strokeStyle = css(look.hair === 0xe8e8e8 ? 0xffffff : darken(look.hair, 0.1));
    ctx.lineWidth = 2.4;
    for (const i of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + sm.x + i * 0.7, hy + 6);
      ctx.quadraticCurveTo(hx + sm.x + i * 2.8, hy + 5.2, hx + sm.x + i * 4.6, hy + 6.8);
      ctx.stroke();
    }
  }
}

/** Hats sit on the rim line just above the eyes and wrap the top of the head. */
function drawHat(ctx: Ctx, hat: HatName, p: Pose, hx: number, hy: number): void {
  const rim = hy - 5.5;
  const side = p.side;
  // Brims point the way the character looks; seen from behind they point away from us.
  const fwd = p.front ? side : -side;
  switch (hat) {
    case 'cop': {
      const crown = () => {
        ctx.beginPath();
        ctx.moveTo(hx - 13.2, rim);
        ctx.lineTo(hx - 14.5, rim - 6);
        ctx.quadraticCurveTo(hx - 14.5, rim - 11.5, hx - 9.5, rim - 11.5);
        ctx.lineTo(hx + 9.5, rim - 11.5);
        ctx.quadraticCurveTo(hx + 14.5, rim - 11.5, hx + 14.5, rim - 6);
        ctx.lineTo(hx + 13.2, rim);
        ctx.closePath();
      };
      crown();
      paint(ctx, PALETTE.policeBlue, null);
      clipped(ctx, () => {
        ctx.fillStyle = css(lighten(PALETTE.policeBlue, 0.2));
        ctx.fillRect(hx - 15, rim - 12, 30, 3);
        ctx.fillStyle = css(darken(PALETTE.policeBlue, 0.16));
        ctx.fillRect(hx + 6, rim - 12, 10, 12);
        ctx.fillStyle = css(0x1d2b4f);
        ctx.fillRect(hx - 15, rim - 3.8, 30, 4);
      });
      crown();
      paint(ctx, null, OL, LW);
      if (p.front) {
        // The peak, then the gold badge.
        ctx.beginPath();
        ctx.moveTo(hx - 12.5 + fwd * 2.5, rim - 0.4);
        ctx.lineTo(hx + 12.5 + fwd * 2.5, rim - 0.4);
        ctx.bezierCurveTo(
          hx + 12 + fwd * 2.5,
          rim + 5,
          hx - 12 + fwd * 2.5,
          rim + 5,
          hx - 12.5 + fwd * 2.5,
          rim - 0.4,
        );
        ctx.closePath();
        paint(ctx, 0x1d2b4f, OL, LW);
        circlePath(ctx, hx + side * 2, rim - 7, 2.7);
        paint(ctx, PALETTE.coinGold, OL, 1.2);
      }
      return;
    }
    case 'fire':
    case 'hardhat': {
      const fire = hat === 'fire';
      const color = fire ? PALETTE.fireRed : PALETTE.builderYellow;
      const dome = () => {
        ctx.beginPath();
        ctx.moveTo(hx - 13.6, rim + 0.5);
        ctx.bezierCurveTo(hx - 13.6, rim - 17.5, hx + 13.6, rim - 17.5, hx + 13.6, rim + 0.5);
        ctx.closePath();
      };
      dome();
      paint(ctx, color, null);
      clipped(ctx, () => {
        ctx.fillStyle = css(darken(color, 0.14));
        ctx.fillRect(hx + 6, rim - 14, 10, 15);
        ellipsePath(ctx, hx - 7, rim - 8, 3.2, 1.8);
        paint(ctx, lighten(color, 0.4), null);
        // The ridge over the top, kept inside the dome so nothing sticks up like a peg.
        roundRectPath(ctx, hx - 2.2, rim - 16, 4.4, fire ? 9.5 : 16, 2.2);
        paint(ctx, fire ? darken(color, 0.16) : lighten(color, 0.3), OL, 1.2);
      });
      dome();
      paint(ctx, null, OL, LW);
      // The brim: long at the back for the fire helmet, a short peak for the hard hat.
      const shift = fire ? -fwd * 2 : fwd * 2;
      roundRectPath(ctx, hx - 16 + shift, rim - 1.6, 32, 5, 2.5);
      paint(ctx, color, OL, LW);
      if (fire && p.front) {
        // Gold shield.
        ctx.beginPath();
        ctx.moveTo(hx + side * 2 - 3, rim - 9.5);
        ctx.lineTo(hx + side * 2 + 3, rim - 9.5);
        ctx.lineTo(hx + side * 2 + 3, rim - 5.5);
        ctx.lineTo(hx + side * 2, rim - 3.2);
        ctx.lineTo(hx + side * 2 - 3, rim - 5.5);
        ctx.closePath();
        paint(ctx, PALETTE.coinGold, OL, 1.2);
      }
      return;
    }
    case 'chef': {
      // A tall white hat: three puffs over a band. Outline the puffs first, then fill over the
      // inner halves of those lines, so only the outside edge of the cloud is drawn.
      const puffs: [number, number, number][] = [
        [-6.5, -12, 6],
        [6.5, -12, 6],
        [0, -15.5, 7],
      ];
      ctx.strokeStyle = css(OL);
      ctx.lineWidth = LW * 2;
      for (const [dx, dy, r] of puffs) {
        circlePath(ctx, hx + dx, rim + dy, r);
        ctx.stroke();
      }
      for (const [dx, dy, r] of puffs) {
        circlePath(ctx, hx + dx, rim + dy, r);
        paint(ctx, 0xffffff, null);
      }
      ctx.strokeStyle = css(0xd5d9e2);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx + 6.5, rim - 12, 3.4, -0.3, 1.2);
      ctx.stroke();
      roundRectPath(ctx, hx - 10, rim - 8, 20, 9, 2.5);
      paint(ctx, 0xffffff, OL, LW);
      ctx.fillStyle = css(0xd5d9e2);
      for (const dx of [-4.5, 0, 4.5]) ctx.fillRect(hx + dx - 0.6, rim - 6, 1.2, 5);
      return;
    }
    case 'pirate': {
      // A wide black hat that curls up at both ends, with a white trim.
      const shape = () => {
        ctx.beginPath();
        ctx.moveTo(hx - 17.5, rim + 0.5);
        ctx.bezierCurveTo(hx - 14, rim - 9, hx - 6, rim - 13, hx, rim - 13);
        ctx.bezierCurveTo(hx + 6, rim - 13, hx + 14, rim - 9, hx + 17.5, rim + 0.5);
        ctx.quadraticCurveTo(hx, rim - 5, hx - 17.5, rim + 0.5);
        ctx.closePath();
      };
      shape();
      paint(ctx, 0x3a3d52, OL, LW);
      ctx.beginPath();
      ctx.moveTo(hx - 13.5, rim - 2.6);
      ctx.quadraticCurveTo(hx, rim - 6.6, hx + 13.5, rim - 2.6);
      ctx.strokeStyle = css(0xffffff);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (p.front) {
        circlePath(ctx, hx + side * 1.5, rim - 8.6, 2.5);
        paint(ctx, 0xffffff, null);
      }
      return;
    }
    case 'duck': {
      // A rubber duck sitting on the head.
      const y = PALETTE.coinGold;
      ellipsePath(ctx, hx, rim - 3.5, 11.5, 6.2);
      paint(ctx, y, OL, LW);
      ctx.beginPath();
      ctx.moveTo(hx + fwd * 10.5, rim - 12.2);
      ctx.lineTo(hx + fwd * 15.5, rim - 10.6);
      ctx.lineTo(hx + fwd * 10.5, rim - 8.6);
      ctx.closePath();
      paint(ctx, PALETTE.coneOrange, OL, 1.4);
      circlePath(ctx, hx + fwd * 6.5, rim - 10.5, 5.2);
      paint(ctx, y, OL, LW);
      circlePath(ctx, hx + fwd * 8, rim - 11.4, 1);
      paint(ctx, OL, null);
      ctx.beginPath();
      ctx.arc(hx - fwd * 2.5, rim - 4.5, 4, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = css(darken(y, 0.22));
      ctx.lineWidth = 1.6;
      ctx.stroke();
      return;
    }
  }
}

/** Draw the character with (0, 0) between the feet, in logical px (the context is pre-scaled). */
function drawFigure(ctx: Ctx, look: CharacterLook, facing: Facing, frame: CharFrame): void {
  const p = poseOf(facing, frame);
  const bodyTop = BODY_TOP + p.bob;
  const hx = p.side;
  const hy = HEAD_Y + p.bob;

  ellipsePath(ctx, 0, 0, p.step === 0 ? 15 : 14, p.step === 0 ? 5.2 : 4.8);
  paint(ctx, 0x000000, null, 0, 0.18);

  drawLegs(ctx, look, p);
  // Long hair hangs down the back: behind the shoulders, so it goes on before the arms and body.
  drawHairBehind(ctx, look, p, hx, hy);
  drawArms(ctx, look, p, bodyTop);
  drawBody(ctx, look, p, bodyTop);
  drawHead(ctx, look, p, hx, hy);
  if (look.hat) drawHat(ctx, look.hat, p, hx, hy);
}

/**
 * Draw a short, stubby, smooth character: round head (no peg), dot eyes, big smile.
 * Front views (SE/SW) show the face; back views (NE/NW) show hair.
 */
export function drawCharacter(
  ctx: Ctx,
  look: CharacterLook,
  facing: Facing,
  frame: CharFrame,
  s: number,
): void {
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(CHAR_W / 2, CHAR_FOOT_Y);
  drawFigure(ctx, look, facing, frame);
  ctx.restore();
}

/**
 * Head, shoulders and hat of someone sitting in or on a vehicle, with (x, y) at the seat (output
 * px). `front` shows the face; `side` is the way they look on screen.
 */
export function drawRiderBust(
  ctx: Ctx,
  look: CharacterLook,
  x: number,
  y: number,
  s: number,
  front: boolean,
  side: 1 | -1,
  legs = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const p: Pose = { right: side > 0, front, side, step: 0, bob: 0 };
  const bodyTop = -13;
  if (legs) {
    // Astride a bike: short legs down either side of the seat.
    for (const i of [-1, 1]) {
      const lx = i < 0 ? -LEG_W - 2.5 : 2.5;
      roundRectPath(ctx, lx, -3, LEG_W, 12, 3);
      paint(ctx, look.pants, null);
      clipped(ctx, () => {
        ctx.fillStyle = css(shoeColor(look));
        ctx.fillRect(lx - 1, 4.6, LEG_W + 2, 6);
      });
      roundRectPath(ctx, lx, -3, LEG_W, 12, 3);
      paint(ctx, null, OL, LW);
    }
  }
  drawHairBehind(ctx, look, p, side, bodyTop - HEAD_R + 4);
  // Arms reach forward to the wheel or handlebars: short sleeves at the sides.
  for (const i of [-1, 1] as const) {
    const ax = i < 0 ? -BODY_W / 2 - 4 : BODY_W / 2 - 3;
    circlePath(ctx, ax + 3.5, bodyTop + 11, 3.2);
    paint(ctx, look.skin, OL, LW);
    roundRectPath(ctx, ax, bodyTop + 2, 7, 9, 3.5);
    paint(ctx, look.shirt, null);
    clipped(ctx, () => {
      if (look.stripes) stripesIn(ctx, ax, bodyTop + 1, 7, 10, 5);
    });
    roundRectPath(ctx, ax, bodyTop + 2, 7, 9, 3.5);
    paint(ctx, null, OL, LW);
  }
  drawBody(ctx, look, p, bodyTop, 15);
  const hx = side;
  const hy = bodyTop - HEAD_R + 4;
  drawHead(ctx, look, p, hx, hy);
  if (look.hat) drawHat(ctx, look.hat, p, hx, hy);
  ctx.restore();
}

/**
 * Make sure a look's frames exist. Composite looks (`<base>+<hat>`, spec 006) are baked the first
 * time they're needed: the base look with a different hat.
 */
export function ensureLook(scene: Phaser.Scene, name: string): void {
  if (scene.textures.exists(characterFrameKey(name, 'SW', 0))) return;
  const [base, hat] = name.split('+');
  const look = LOOKS[base ?? ''];
  if (!look) return;
  bakeCharacter(scene, name, hat ? { ...look, hat: hat as HatName } : look);
}

/** A big front-facing portrait frame (minigame line-ups): `big-<name>`, drawn at 3× logical size. */
export const BIG_CHAR_SCALE = 3;
export const bigCharacterKey = (name: string) => `big-${name}`;

export function bakeBigCharacter(scene: Phaser.Scene, name: string, look: CharacterLook): void {
  const key = bigCharacterKey(name);
  if (scene.textures.exists(key)) return;
  const s = WT * BIG_CHAR_SCALE;
  bakeCanvas(scene, key, CHAR_W * s, CHAR_H * s, (ctx) => drawCharacter(ctx, look, 'SW', 0, s));
}

/** Bake all frames (4 facings × stand + two steps) for a character look. */
export function bakeCharacter(scene: Phaser.Scene, name: string, look: CharacterLook): void {
  for (const facing of FACINGS) {
    for (const frame of CHAR_FRAMES) {
      const key = characterFrameKey(name, facing, frame);
      if (scene.textures.exists(key)) continue;
      bakeCanvas(scene, key, CHAR_W * WT, CHAR_H * WT, (ctx) =>
        drawCharacter(ctx, look, facing, frame, WT),
      );
    }
  }
}
