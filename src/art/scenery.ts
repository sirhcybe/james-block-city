import type Phaser from 'phaser';
import { PALETTE } from '../config';
import { bakeCanvas, circlePath, clipped, css, paint, roundRectPath, type Ctx } from './bake';
import { darken, lighten } from './color';
import { RS } from './renderScale';

/**
 * Side-on scenery for the minigames (spec 009): tower fronts, windows, the fire truck, crane
 * parts and stacking blocks. Baked once per size/colour at the render scale; show them at 1/RS.
 * Same look rules as the city: flat fills, a lit side and a shaded side, thick outline.
 */
const OL = PALETTE.outline;
const PAD = 16;

function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx) => void,
): string {
  if (!scene.textures.exists(key)) {
    bakeCanvas(scene, key, (w + PAD * 2) * RS, (h + PAD * 2) * RS, (ctx) => {
      ctx.scale(RS, RS);
      ctx.translate(PAD, PAD);
      draw(ctx);
    });
  }
  return key;
}

/** Padding round every scenery texture (logical px): the picture's own box starts at (PAD, PAD). */
export const SCENERY_PAD = PAD;

/**
 * A tower front `w` × `h`: white wall, shaded right edge, a roof band in the accent colour that
 * overhangs a little. Place it with origin (0, 0) at (x − PAD, y − PAD).
 */
export function wallTexture(
  scene: Phaser.Scene,
  w: number,
  h: number,
  accent: number,
  band = 36,
): string {
  return bake(scene, `sc-wall-${w}x${h}-${accent.toString(16)}-${band}`, w, h, (ctx) => {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    paint(ctx, PALETTE.buildingWhite, null);
    clipped(ctx, () => {
      ctx.fillStyle = css(darken(PALETTE.buildingWhite, 0.1));
      ctx.fillRect(w - Math.min(46, w * 0.12), 0, 60, h);
      ctx.fillStyle = css(darken(PALETTE.buildingWhite, 0.05));
      ctx.fillRect(0, band - 2, w, 8);
    });
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    paint(ctx, null, OL, 6);
    // Roof band.
    roundRectPath(ctx, -10, -8, w + 20, band, 6);
    paint(ctx, accent, null);
    clipped(ctx, () => {
      ctx.fillStyle = css(lighten(accent, 0.25));
      ctx.fillRect(-10, -8, w + 20, band * 0.28);
      ctx.fillStyle = css(darken(accent, 0.16));
      ctx.fillRect(-10, -8 + band * 0.74, w + 20, band * 0.3);
    });
    roundRectPath(ctx, -10, -8, w + 20, band, 6);
    paint(ctx, null, OL, 5);
  });
}

/**
 * A window `w` × `h` with a frame, a reflection, a cross bar and a sill. The glass is the
 * texture's own box, so place it with origin (0, 0) at (x − PAD, y − PAD).
 */
export function paneTexture(scene: Phaser.Scene, w: number, h: number): string {
  return bake(scene, `sc-pane-${w}x${h}`, w, h, (ctx) => {
    // Sill first, so the frame sits on it.
    roundRectPath(ctx, -8, h - 2, w + 16, 12, 4);
    paint(ctx, 0xd9dce3, OL, 4);
    roundRectPath(ctx, 0, 0, w, h, 5);
    paint(ctx, PALETTE.windowBlue, null);
    clipped(ctx, () => {
      // Reflection: two slanted bands of lighter glass.
      ctx.fillStyle = css(lighten(PALETTE.windowBlue, 0.3));
      for (const [x0, bw] of [
        [w * 0.12, w * 0.16],
        [w * 0.36, w * 0.07],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(x0 + h * 0.5, 0);
        ctx.lineTo(x0 + h * 0.5 + bw, 0);
        ctx.lineTo(x0 + bw, h);
        ctx.lineTo(x0, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = css(darken(PALETTE.windowBlue, 0.12));
      ctx.fillRect(0, h - 8, w, 8);
    });
    // Cross bars.
    ctx.strokeStyle = css(0xf4f6fa);
    ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.07);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(w / 2, 3);
    ctx.lineTo(w / 2, h - 3);
    if (h > 70) {
      ctx.moveTo(3, h / 2);
      ctx.lineTo(w - 3, h / 2);
    }
    ctx.stroke();
    ctx.lineCap = 'round';
    roundRectPath(ctx, 0, 0, w, h, 5);
    paint(ctx, null, OL, 5);
  });
}

function wheel(ctx: Ctx, x: number, y: number, r: number): void {
  circlePath(ctx, x, y, r);
  paint(ctx, 0x3a3d4a, OL, 5);
  circlePath(ctx, x, y, r * 0.48);
  paint(ctx, 0xc9ced8, OL, 3);
  circlePath(ctx, x, y, r * 0.14);
  paint(ctx, OL, null);
}

/** Size of the fire truck picture (its box; wheels touch the bottom edge). */
export const TRUCK_W = 280;
export const TRUCK_H = 104;

/** A side-on fire truck facing right: cab in front, a deck behind for the ladder to stand on. */
export function fireTruckTexture(scene: Phaser.Scene): string {
  return bake(scene, 'sc-firetruck', TRUCK_W, TRUCK_H, (ctx) => {
    const red = PALETTE.fireRed;
    const floor = TRUCK_H - 22; // bottom of the body; wheels hang below it
    // Light on the cab roof.
    roundRectPath(ctx, 206, 2, 26, 14, 5);
    paint(ctx, PALETTE.policeBlue, OL, 4);
    // Cab.
    roundRectPath(ctx, 176, 12, 96, floor - 12, 14);
    paint(ctx, red, null);
    clipped(ctx, () => {
      ctx.fillStyle = css(darken(red, 0.14));
      ctx.fillRect(176, floor - 16, 96, 16);
    });
    roundRectPath(ctx, 176, 12, 96, floor - 12, 14);
    paint(ctx, null, OL, 5);
    roundRectPath(ctx, 204, 24, 56, 30, 7);
    paint(ctx, PALETTE.windowBlue, OL, 4);
    ctx.strokeStyle = css(0xffffff, 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(214, 46);
    ctx.lineTo(226, 32);
    ctx.stroke();
    // Deck behind the cab, with a white stripe and locker doors.
    roundRectPath(ctx, 4, 34, 180, floor - 34, 10);
    paint(ctx, red, null);
    clipped(ctx, () => {
      ctx.fillStyle = css(0xffffff);
      ctx.fillRect(4, 54, 180, 9);
      ctx.fillStyle = css(darken(red, 0.14));
      ctx.fillRect(4, floor - 12, 180, 12);
    });
    roundRectPath(ctx, 4, 34, 180, floor - 34, 10);
    paint(ctx, null, OL, 5);
    ctx.strokeStyle = css(OL);
    ctx.lineWidth = 3;
    for (const x of [64, 124]) {
      ctx.beginPath();
      ctx.moveTo(x, 66);
      ctx.lineTo(x, floor - 6);
      ctx.stroke();
    }
    // Bumper, head light, tail light.
    roundRectPath(ctx, 258, floor - 14, 20, 12, 4);
    paint(ctx, 0xc9ced8, OL, 4);
    circlePath(ctx, 264, 62, 6);
    paint(ctx, 0xfff1a8, OL, 3);
    roundRectPath(ctx, 2, 44, 8, 14, 3);
    paint(ctx, PALETTE.coinGold, OL, 3);
    wheel(ctx, 60, floor, 22);
    wheel(ctx, 214, floor, 22);
  });
}

/** A stacking block `w` × `h`: lit top edge, shaded foot, a soft shine, rounded outline. */
export function stackBlockTexture(
  scene: Phaser.Scene,
  w: number,
  h: number,
  color: number,
): string {
  return bake(scene, `sc-block-${w}x${h}-${color.toString(16)}`, w, h, (ctx) => {
    roundRectPath(ctx, 0, 0, w, h, 8);
    paint(ctx, color, null);
    clipped(ctx, () => {
      ctx.fillStyle = css(lighten(color, 0.28));
      ctx.fillRect(0, 0, w, h * 0.24);
      ctx.fillStyle = css(darken(color, 0.18));
      ctx.fillRect(0, h * 0.76, w, h * 0.24);
      ctx.fillRect(w - 14, 0, 14, h);
    });
    roundRectPath(ctx, 12, 7, w * 0.3, 5, 2.5);
    paint(ctx, 0xffffff, null, 0, 0.7);
    roundRectPath(ctx, 0, 0, w, h, 8);
    paint(ctx, null, OL, 4);
  });
}

/** A crane jib `w` long: a yellow beam with lattice braces along it. */
export function jibTexture(scene: Phaser.Scene, w: number, h: number): string {
  return bake(scene, `sc-jib-${w}x${h}`, w, h, (ctx) => {
    const y = PALETTE.builderYellow;
    roundRectPath(ctx, 0, 0, w, h, 5);
    paint(ctx, darken(y, 0.3), null);
    clipped(ctx, () => {
      // Braces: a zigzag of yellow bars over the dark gap, then the top and bottom booms.
      ctx.strokeStyle = css(y);
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0, i = 0; x <= w + h; x += h, i++) {
        if (i === 0) ctx.moveTo(x, h);
        else ctx.lineTo(x, i % 2 ? 0 : h);
      }
      ctx.stroke();
      ctx.fillStyle = css(y);
      ctx.fillRect(0, 0, w, 7);
      ctx.fillRect(0, h - 7, w, 7);
      ctx.fillStyle = css(lighten(y, 0.3));
      ctx.fillRect(0, 0, w, 3);
    });
    roundRectPath(ctx, 0, 0, w, h, 5);
    paint(ctx, null, OL, 5);
  });
}

/** A concrete pad for the block stack to stand on. */
export function slabTexture(scene: Phaser.Scene, w: number, h: number): string {
  return bake(scene, `sc-slab-${w}x${h}`, w, h, (ctx) => {
    roundRectPath(ctx, 0, 0, w, h, 6);
    paint(ctx, 0xb9bfcb, null);
    clipped(ctx, () => {
      ctx.fillStyle = css(0xd9dce3);
      ctx.fillRect(0, 0, w, h * 0.35);
      ctx.fillStyle = css(0x8a8fa0);
      for (let x = 30; x < w; x += 60) ctx.fillRect(x, h * 0.35, 3, h);
    });
    roundRectPath(ctx, 0, 0, w, h, 6);
    paint(ctx, null, OL, 4);
  });
}

/** Add a scenery texture so its own box (not the padding) has its top-left at (x, y). */
export function addScenery(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(x - PAD, y - PAD, key)
    .setOrigin(0, 0)
    .setScale(1 / RS);
}
