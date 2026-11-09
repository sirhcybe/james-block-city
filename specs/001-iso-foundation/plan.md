# 001 — Plan

## Approach
Scaffold with Vite's vanilla-ts template, add Phaser 3. Keep all math and input mapping in pure TS
modules so they're testable without a canvas. Generate every block texture at boot in BootScene.

## Files / modules
- `src/main.ts` — Phaser config: `Scale.FIT`, 1280×720, `pixelArt: false`, `resolution: min(dpr, 2)`,
  scenes [Boot, Title, City, Hud].
- `src/config.ts` — TILE_W=64, TILE_H=32, BLOCK_H=32, WALK_SPEED (tiles/s)=4, palette from art-style.
- `src/iso/projection.ts` — `gridToScreen`, `screenToGrid`, `depthOf`.
- `src/iso/grid.ts` — `WalkGrid` (blocked tiles, bounds), helpers.
- `src/iso/path.ts` — EasyStar wrapper returning tile paths (synchronous calculate per call is fine at 16×16).
- `src/input/InputMapper.ts` — produces `GameActions` (see architecture). `screenDirToGrid(v)`:
  grid dx = v.x/2 + v.y, grid dy = -v.x/2 + v.y, normalized (verify sign with tests).
- `src/input/TouchJoystick.ts` — floating stick on left half; radius 70 px; dead zone 0.15.
- `src/art/blocks.ts` — `drawIsoBlock`, `blockTextureKey`, cache.
- `src/art/characters.ts` — player sprite frames (4 directions × 2 bob frames) drawn in code.
- `src/content/plaza.json` — tile layout + building list `{id, gx, gy, w, d, h, color, kind}`.
- `src/scenes/BootScene.ts`, `TitleScene.ts`, `CityScene.ts`, `HudScene.ts` (joystick only for now).
- `src/entities/Player.ts` — position in grid floats, facing, collision against WalkGrid, path following.
- `src/systems/occlusion.ts` — per-frame fade decision.

## Data
`plaza.json` validated with zod at boot. Buildings mark their footprint tiles blocked.

## Risks
- Depth sorting for multi-tile buildings: sort by front-most tile; if artifacts appear, split tall
  buildings into per-tile column sprites.
- Touch + mouse double events on Android: use Phaser pointer `wasTouch`; ignore emulated mouse.
- Performance: bake textures; no per-frame Graphics.

## Test approach
Vitest for iso, path wrapper, InputMapper (feed synthetic key/pointer states). Playwright: load page,
wait for canvas, assert no console errors, press ArrowUp for 500 ms and read player grid pos via
`window.__jbc` debug hook (dev/test builds only).
