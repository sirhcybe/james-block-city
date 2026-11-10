# ADR-002: Render scale instead of Phaser `resolution`

**Status:** accepted · 2026-11-09

## Context
Spec 001's plan asked for `resolution: min(dpr, 2)` in the Phaser config so code-drawn art stays crisp
on high-DPI phones. Phaser 3.90 no longer has a `resolution` game-config option. With a plain
1280×720 canvas under `Scale.FIT`, a Pixel 7 (dpr 2.625) or a 1080p laptop shows the canvas upscaled
about 1.5×, which blurs the thin outlines.

The city also zooms in (`WORLD_ZOOM = 1.5`) so the character is big enough for a 6-year-old on a
phone. Zooming a texture drawn at 1× blurs it too.

## Decision
- At boot, compute a **render scale** `RS` = physical pixels the FIT canvas will cover ÷ logical
  size, rounded to 0.25 and clamped to [1, 2] (`src/art/renderScale.ts`). `?rs=` overrides it for testing.
- The canvas is `1280·RS × 720·RS`. Every camera zooms by `RS` (the city camera by `RS·WORLD_ZOOM`),
  so **all game code still works in 1280×720 logical units / iso world px**.
- Textures are drawn at their final pixel density and shown at the inverse scale:
  UI at `RS`, world art (blocks, buildings, characters, ground) at `WT = min(2.5, RS·WORLD_ZOOM)`.
- Pointer input converts `pointer.x / RS` to logical screen coordinates, and
  `camera.getWorldPoint` to world coordinates.

## Consequences
- Art is crisp at native density; measured 93 fps uncapped with Pixel 7 emulation + 4× CPU throttle.
- The baked ground texture is about 2600 px wide at the highest `WT`. A 48×48 map will need the ground
  baked in chunks so it stays under the 4096 px limit common on mobile GPUs.
- Anything that adds a texture must draw at `WT` (world) or `RS` (UI) and use `setScale(1/WT|1/RS)`.
  The helpers in `src/art/` do this already.
