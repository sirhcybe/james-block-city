# 010 — Plan

## Approach
The world is built from map pieces laid over the sea (`content/world.ts`, ADR-005/ADR-011). The
city fills tiles x 0–54, y 0–39, with open sea to the east (the harbor side, with all the boat
rescues) and to the south. Parkside is a new piece, 55 × 21, laid at (0, 39): it takes over the
old south grass edge (row 39) and adds rows 40–59. Nothing in the old city moves, so every
marker, mission and test coordinate stays valid.

Layout (world tiles):
- Rows 37–38, the old south ring road, becomes an inner street.
- Band A, rows 39–46: homes (west and east), and the shop street (ice cream, pet shop, library).
- Rows 47–48: a new east–west street.
- Band B, rows 49–56: the school and schoolyard (west), the park with pond, playground and garden
  (middle, a double-width block), homes (east).
- Rows 57–58: the new south coast road; row 59: grass and trees; sea from row 60.
- North–south streets continue on the old columns (x 1–2, 9–10, 17–18, 22–23, 30–31, 38–39,
  43–44, 52–53); x 9–10 and 30–31 stop at the middle street so the school and park get double
  blocks. The green strips at x 19–21 and 40–42 continue as tree-lined verges.

Residential blocks use one-tile pavements and grass gardens (the old districts use two-tile
pavements round a small paved yard), so Parkside reads as homes, not offices.

## Files / modules
- `src/content/parkside.json` (new), `sea.json` (72 × 68, south islands moved), south-edge trees
  and flowers removed from `downtown.json`, `heights.json`, `harbor.json`.
- `src/content/world.ts`: add the piece. `src/content/schema.ts`: new building kinds and props.
- `src/art/buildings.ts`: home, school, playground, icecream, petshop, library, garden.
- `src/art/props.ts`: mailbox. `src/art/icons.ts`: ball, kite, carrot (bubbles, pickups).
- `src/content/errands.json`, `voice.json`; `scenes/CityScene.ts`: townspeople, traffic 7–8.
- Docs: `docs/game-design.md`, `docs/architecture.md`, `docs/roadmap.md`, ADR-013.

## Data
`parkside.json` is hand-editable like the other districts. It is made once by a throwaway script
and then edited by hand; no migration script is kept (nothing old is transformed).

## Risks
- Ground textures: the land grows by half, so the baked ground grows by about a third (16 px
  chunks). Measure boot time and texture memory against `main`; if memory grows too much, bake
  the ground at a lower scale or on demand (a follow-up, recorded in the ADR).
- Camera bounds and the objective guide use the map size: they grow on their own. Check.
- The finale parade goes round the Plaza on fixed markers: unaffected. Check in the e2e run.

## Test approach
- Unit: land area ≥ 1.5× (merge with and without Parkside); one road network; every new person,
  spot and stroller reachable; new errands valid with pictures and voice lines; the sea grid
  reaches the new coast from the dock.
- e2e: drive from the Plaza into Parkside; each new errand from offer to coins.
- By eye: gallery and city screenshots; perf: old against new in the same sandbox.
