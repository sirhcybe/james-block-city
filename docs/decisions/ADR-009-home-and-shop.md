# ADR-009: Home, hats and paint

**Status:** accepted · 2026-11-12 · spec 006

## Context
Spec 006 lets the player spend coins on things they can see:
- furniture to place in an apartment;
- hats to wear in any job;
- their own car, in a choice of paints.

The save needs to remember what is worn and painted, and the art has to show any hat on any
outfit without baking every combination at boot.

## Decision
- **SaveV2** adds `hat` and `paint` (both nullable).
  - `migrate()` steps a v1 save up to v2 by filling both with `null`.
  - Everything else is kept unchanged, and a unit test checks a spec 005 save.
- **Composite looks.**
  - `lookFor(job, owned, hat)` gives a look name such as `playerFire+pirate`.
  - `ensureLook()` bakes it the first time it is needed (8 frames), using the base outfit with a
    different hat.
  - Only the combinations a player actually wears are ever baked.
- **Paint.** The own car is baked in its five paints at boot (`own-car`, `own-car-paint-red`, …),
  and painting swaps the look.
- **The apartment** is a separate scene (like the kitchen).
  - The pure `ApartmentLayout` (a 6×4 grid, one item per square, owned items only) cleans any bad
    saved layout and is unit-tested.
  - The scene saves after every drop.
- **Shop tabs** come from a `tab` field on each Shop item.
  - The job tab still shows only the current job's upgrade.
  - `requires: ["badge:any"]` gates the own car.
- **Errands with no `after`** that aren't robber loot are on offer from the start, so new players
  always have someone to help. Each errand can carry its own `voice` line.

## Consequences
- **New hats** need only a hat drawing in `characters.ts`, a `HATS` entry and a Shop item.
- **A long-standing bug was fixed:** Phaser reuses scene objects, so a scene's own "already
  closed" flag must be reset when the scene opens. The kitchen could not be left a second time
  before this was fixed.
- **Spending now shows on the HUD coin counter.** It used to only count up.
