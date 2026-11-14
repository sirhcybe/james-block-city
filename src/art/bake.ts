import type Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;

/**
 * Baking helpers (spec 009). Every texture in the game is drawn once into a canvas. The canvas is
 * made here first so its lines get rounded joins and caps: corners never spike and line ends never
 * stop short of the shape they belong to.
 */
function softCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(
    key,
    Math.max(1, Math.ceil(w)),
    Math.max(1, Math.ceil(h)),
  );
  if (!tex) throw new Error(`could not create texture ${key}`);
  const ctx = tex.getContext();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return tex;
}

/** Bake a Graphics object into texture `key` (w × h px), with rounded joins and caps. */
export function bakeGraphics(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  key: string,
  w: number,
  h: number,
): Phaser.Textures.CanvasTexture {
  const tex = softCanvas(scene, key, w, h);
  g.generateTexture(key, tex.width, tex.height);
  return tex;
}

/** Bake a texture by drawing straight onto its 2D context (curves, clipping). */
export function bakeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx) => void,
): Phaser.Textures.CanvasTexture {
  const tex = softCanvas(scene, key, w, h);
  const ctx = tex.getContext();
  ctx.save();
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return tex;
}

/** 0xRRGGBB (+ alpha) as a CSS colour. */
export function css(c: number, a = 1): string {
  if (a >= 1) return `#${c.toString(16).padStart(6, '0')}`;
  return `rgba(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff},${a})`;
}

/** Path helpers: each starts a new path on the context. */
export function roundRectPath(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function circlePath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

export function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

export function polyPath(ctx: Ctx, pts: readonly (readonly [number, number])[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Fill the current path, then outline it. */
export function paint(
  ctx: Ctx,
  fill: number | null,
  stroke: number | null,
  lw = 2,
  alpha = 1,
): void {
  if (fill !== null) {
    ctx.fillStyle = css(fill, alpha);
    ctx.fill();
  }
  if (stroke !== null && lw > 0) {
    ctx.strokeStyle = css(stroke);
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Run `draw` with the current path as the clip region. */
export function clipped(ctx: Ctx, draw: () => void): void {
  ctx.save();
  ctx.clip();
  draw();
  ctx.restore();
}
