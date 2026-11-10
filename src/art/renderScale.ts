import { GAME_H, GAME_W, WORLD_ZOOM } from '../config';

/**
 * Render scale: the canvas is GAME_W×GAME_H × RS physical pixels and every camera is zoomed by RS,
 * so all game code works in 1280×720 logical units while art stays crisp on high-DPI screens.
 * Textures are drawn at RS and displayed at 1/RS. See docs/decisions/ADR-002-render-scale.md.
 */
function computeRenderScale(): number {
  if (typeof window === 'undefined') return 1;
  const forced = new URLSearchParams(window.location.search).get('rs');
  if (forced) return Math.min(2, Math.max(1, Number(forced) || 1));
  const dpr = window.devicePixelRatio || 1;
  // Physical pixels the FIT-scaled canvas will cover, relative to the logical size.
  const fit = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
  const physical = fit * dpr;
  // Quantize to 0.25 steps; never below 1, never above 2.
  return Math.min(2, Math.max(1, Math.round(physical * 4) / 4));
}

export const RS = computeRenderScale();

/**
 * Pixel scale for world art (blocks, buildings, characters). The city camera zooms in by
 * WORLD_ZOOM, so world textures are drawn that much larger to stay crisp. Capped to keep the
 * baked ground texture under ~3k px.
 */
export const WT = Math.min(2.5, RS * WORLD_ZOOM);
