# ADR-013: Parkside — where the new neighborhood goes, and how it joins the city

**Status:** accepted · 2026-11-26 · spec 010

## Context
Chris asked for the city to be 50% bigger, by adding a new neighborhood. The city (spec 008) sat in
the top-left of a 72 × 48 sea: land on tiles x 0–54, y 0–39, open sea to the east (the harbor, the
dock and every boat rescue) and to the south. Every mission, marker and e2e test uses world
coordinates.

## Decision
- **Along the south coast.** Parkside is a new map piece, 55 × 23, laid at (0, 39): it takes over
  the old south grass edge (row 39) and adds rows 40–61. Growing south moves nothing that exists;
  growing north or west would shift every coordinate; growing east would bury the harbor's
  waterfront and the rescues.
- **The streets carry on.** Every old north–south street continues into Parkside (six to the
  coast, two stop at its middle street so the school and the park get double blocks). The old
  south road becomes an inner street; a new coast road runs along the bottom. One road network,
  roads still two tiles wide.
- **It reads as homes, not offices.** Residential blocks have one-tile pavements round grass
  gardens (the old districts have two-tile pavements round a paved yard). New building kinds in
  `art/parkside.ts`: home, school, playground, icecream, petshop, library, garden; pink blossom
  trees are the existing tree kind in `donutPink`; a mailbox prop.
- **A beach.** The land count with Parkside as a plain rectangle came to +49% (the old city's land
  includes a pond and the lighthouse island). A sand beach along the coast takes it to +51%, and
  gives the boat somewhere to land.
- **The sea grows to 72 × 68.** The two small south islands and three buoys move off the new
  coast, kept inside the ground chunk row that already holds the coast, so no extra chunk is baked
  just for an island.
- **People and errands.** Six strollers, two traffic cars, and three townspeople with errands that
  are offered from the start (a ball, a kite, carrots for the pet shop). Each new item is used by
  no other errand, because handing over gives away every one you carry.
- **Deliver errands are asked by the giver.** Until now a Deliver errand's line ("Can you take
  this to...") was said near the receiver; the giver now says it as you come up, or as they hand
  the item over if you came up fast. This is a fix for all Deliver errands, not only Parkside's.
- `parkside.json` is hand-editable; it was generated once by a throwaway script. No migration
  script is kept: nothing old was transformed, apart from deleting the trees and flowers on the
  old south edge, which now stood on Parkside's pavements.

## Consequences
- Measured against `main` in the agent's sandbox (software rendering, Pixel 7 emulation, render
  scale 1.5): frame rate the same at the same spots in the old city (spawn 24 fps, elsewhere
  7–11 fps on both), and Parkside runs at the same 7 fps as comparable old spots. Boot time not
  slower (4.6 s → 4.4 s, noise). Texture memory 368 → 422 MB of canvas pixels (+15%), of which
  ground 141 → 183 MB.
- Follow-up worth doing if a phone struggles: the ground is baked as whole 16 × 16-tile chunks,
  each a big rectangle that is half transparent, and every chunk stays in memory. Baking chunks
  near the camera on demand (and dropping far ones), or culling chunks by their diamond rather
  than their box, would cut memory and overdraw for the whole city, not just Parkside.
