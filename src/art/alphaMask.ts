import type Phaser from 'phaser';

interface Mask {
  w: number;
  h: number;
  /** 1 where the pixel is solid enough to count as "drawn here". */
  solid: Uint8Array;
}

const masks = new Map<string, Mask | null>();

/**
 * Per-texture solidity masks, read once from the baked canvas. Occlusion and tap hit tests ask
 * "is this pixel of the sprite drawn?" many times per frame; a lookup table is far cheaper than
 * TextureManager.getPixelAlpha (which draws + reads back a canvas on every call).
 */
export function maskFor(textures: Phaser.Textures.TextureManager, key: string): Mask | null {
  const hit = masks.get(key);
  if (hit !== undefined) return hit;
  let mask: Mask | null;
  try {
    const src = textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const w = src.width;
    const h = src.height;
    let canvas: HTMLCanvasElement;
    if (src instanceof HTMLCanvasElement) canvas = src;
    else {
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(src, 0, 0);
    }
    const data = canvas
      .getContext('2d', { willReadFrequently: true })!
      .getImageData(0, 0, w, h).data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = data[i * 4 + 3]! > 40 ? 1 : 0;
    mask = { w, h, solid };
  } catch {
    mask = null; // fall back to "not solid"
  }
  masks.set(key, mask);
  return mask;
}

/** Whether texture `key` is drawn at texture pixel (tx, ty). */
export function solidAt(
  textures: Phaser.Textures.TextureManager,
  key: string,
  tx: number,
  ty: number,
): boolean {
  const m = maskFor(textures, key);
  if (!m || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false;
  return m.solid[ty * m.w + tx] === 1;
}
