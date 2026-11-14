# 009 — Plan

## Approach
All art is already baked once into canvas textures. The pass keeps that and tightens the drawing
code, file by file, checking each against a contact sheet of every baked texture.

1. **Bake helper.** One helper pre-creates the canvas texture with `lineJoin = 'round'` and
   `lineCap = 'round'` before Phaser's `generateTexture` draws into it. `bakeParts` gets a
   `canvas` part type so a part can draw with the 2D context (curves, clipping).
2. **Characters** are redrawn with the 2D context: the head is a clip region for hair, cheeks and
   mask, so nothing can leave it. The frame grows upward so tall hats fit. A third frame gives a
   two-leg walk cycle; `walkFrame(t)` maps walking time to a frame.
3. **Vehicles.** Wheels are circles in the plane of the side face (projected), with a hub and
   spokes that turn. Riders reuse the character head. Extra detail on the faces.
4. **Icons** share one outline rule: width scales with the icon size. Each icon is redrawn where
   parts were unoutlined or did not fit.
5. **Props, boats, buildings, ground, HUD, menus, minigame art**: same rules, more detail.
6. **Animations**: walk cycle, squash on landing, pop-in/out eases, flicker and bob timings.

## Files / modules
- `src/art/bake.ts` (new), `src/art/blocks.ts`, `src/art/characters.ts`, `src/art/vehicles.ts`,
  `src/art/icons.ts`, `src/art/shapes2d.ts`, `src/art/props.ts`, `src/art/missionProps.ts`,
  `src/art/boats.ts`, `src/art/buildings.ts`, `src/art/ground.ts`, `src/art/hud.ts`,
  `src/art/ui.ts`, `src/art/menu.ts`, `src/art/minigame.ts`
- Entities and scenes that play frames or tweens.
- `src/scenes/GalleryScene.ts`: `?gallery=all`.

## Data
None. Texture keys stay the same; character frames add `-2`.

## Risks
- Texture sizes and origins feed depth, occlusion masks and tap tests. Vehicle frame bounds and
  building footprints stay the same; the character frame only grows upward and the foot point is
  exported as before.
- More detail costs bake time at boot, not frame time. Check boot time and the perf script.

## Test approach
- Unit: face layout stays inside the head; walk cycle uses both step frames.
- e2e: frames are not cut off at the top; rounded joins on a baked context; the existing suite.
- By eye: contact sheets of all textures before/after, screenshots of city, minigames and menus.
