/** Small color helpers on 0xRRGGBB numbers. */

function channels(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

function pack(r: number, g: number, b: number): number {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(r) << 16) | (cl(g) << 8) | cl(b);
}

/** Move each channel `amount` (0..1) of the way toward white. */
export function lighten(c: number, amount: number): number {
  const [r, g, b] = channels(c);
  return pack(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Scale each channel down by `amount` (0..1). */
export function darken(c: number, amount: number): number {
  const [r, g, b] = channels(c);
  return pack(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Linear mix: t = 0 → a, t = 1 → b. */
export function mix(a: number, b: number, t: number): number {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  return pack(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
