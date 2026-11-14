# ADR-012: How art is baked (canvas context, rounded joins, one icon pen)

**Status:** accepted · 2026-11-14 · spec 009

## Context
All art is generated in code and baked into textures at boot. Until now every texture was drawn
with Phaser `Graphics` and `generateTexture`. That left three kinds of sloppiness:
- Graphics cannot clip or draw curves, so parts that belong inside a shape (cheeks, hair, a mask
  on a head) were placed by hand and stuck out.
- Lines used mitre joins and butt caps: spiky corners, and line ends that stopped short.
- Each icon chose its own line widths in screen pixels, so the same picture was chunky in a small
  bubble and thin on a big card, and many inner parts had no outline at all.

## Decision
- **One bake helper, `art/bake.ts`.** It creates the canvas texture first, sets
  `lineJoin = lineCap = 'round'`, and then lets `Graphics.generateTexture` draw into that canvas.
  The Graphics is drawn into the canvas element, not by key, so Phaser does not upload the
  texture on every flush; the helper uploads once at the end. (Uploading per flush cost about
  half a second of boot time on the big ground chunks.)
- **`bakeParts` takes `canvas` parts** next to block, window and custom parts. A canvas part draws
  on the 2D context (curves, `clip()`); Graphics parts before it are flushed first, so parts
  still draw in list order.
- **Characters are drawn on the 2D context.** The head and the body are clip regions for what
  belongs on them. `faceLayout` holds the face geometry as plain numbers so a unit test can check
  that every part is inside the head. Vehicle riders use the same head and shoulders
  (`drawRiderBust`).
- **Character frames: 48 × 88 logical px, feet at y = 82,** three frames per facing (stand, left
  step, right step). The frame grew upward only; every user places it by `CHAR_FOOT_Y / CHAR_H`.
- **Icons share one pen** (`Pen` in `art/icons.ts`): coordinates in units of the icon's half-size,
  outline = 11% of the half-size. `drawIcon(g, name, x, y, r, s)` keeps its signature.
- **Minigame scenery is baked too** (`art/scenery.ts`: tower fronts, windows, the fire truck,
  crane jib, stacking blocks) instead of being drawn live with WebGL Graphics, which has no
  rounded joins.

## Consequences
- Texture count 912 → about 1000 and texture memory +3% (358 → 368 MB of canvas pixels at
  render scale 1.5); frame rate is unchanged; boot bakes about 0.4 s longer in software rendering.
- New art should use `bakeCanvas` or a `canvas` part whenever something must stay inside a shape.
- Live `Graphics` in scenes is still fine for things that change every frame (the ladder, the
  cement level), but keep to rectangles, circles and straight lines there.
