import type { Vec2 } from '../iso/projection';

/**
 * Convert a screen-relative direction (up = up the screen) into a grid direction whose projection
 * points the same way on screen. Output length equals input length (clamped to 1).
 *
 * Screen delta of a grid step is (dx - dy, (dx + dy) / 2) × 32, so solving for (dx, dy):
 *   dx ∝ v.x / 2 + v.y,   dy ∝ -v.x / 2 + v.y
 */
export function screenDirToGrid(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 0, y: 0 };
  const gx = v.x / 2 + v.y;
  const gy = -v.x / 2 + v.y;
  const glen = Math.hypot(gx, gy);
  const mag = Math.min(1, len);
  return { x: (gx / glen) * mag, y: (gy / glen) * mag };
}

/** Clamp a vector to length ≤ 1 and zero it inside a radial dead zone (rescaling the rest). */
export function applyDeadZone(v: Vec2, deadZone: number): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len <= deadZone) return { x: 0, y: 0 };
  const clamped = Math.min(1, len);
  const scaled = (clamped - deadZone) / (1 - deadZone);
  return { x: (v.x / len) * scaled, y: (v.y / len) * scaled };
}
