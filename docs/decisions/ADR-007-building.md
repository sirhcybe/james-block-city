# ADR-007: Build spots and the block blaster

**Status:** accepted · 2026-11-11 · spec 005

## Context
The Builder's missions make new things appear in the city: a dock, a boat shop, a lighthouse and
a bridge. That means the world must change at runtime and stay changed after a reload. A
6-year-old must never be able to fail at it.

## Decision
- **Build spots are buildings with `site: true`** in the map JSON. They start hidden and don't
  block walking.
  - Once built, `built:<id>` is saved in `owned`, the building is drawn at load, and it joins
    occlusion.
- **During a `build` goal** the spot shows as a pale-blue ghost (`BuildSite`).
  - Each blaster press flies a block in, and the building grows up out of the ground.
  - The pure `SiteState` counts the blocks: 6–10 per spot, from its size.
  - The giant mixer drum (the Pro upgrade) adds 2 per press.
  - Nothing can be lost.
- **Reach:** 6.5 tiles from the mixer truck (measured from its lane position, not the road's
  centre line) and 3 tiles on foot. Every spot has a `<id>-at` parking marker in reach, and a
  unit test checks it.
- **Walking changes; driving doesn't.**
  - `buildWalkGrid(map, built)` treats built docks and bridges as walkable water, and other built
    things as blocked. The city copies the new grid in place and refreshes the path finder.
  - Lane graphs never change at runtime, so cars can't cross the bridge.
- **The mixer truck** has a horn instead of a siren. Traffic stops for it in the same way.
- **The quick-change button:** with all three badges, the HUD calls an "open jobs" function the
  city puts in the registry. The HUD never imports the city.

## Consequences
- Adding a new build spot is content only: a site building, a parking marker and a mission goal.
- If a later spec wants cars on the bridge, lane graphs will need rebuilding (and the vehicles
  re-seating) when something is built.
- Measured on a production build: 91 fps building in the Harbor (Pixel 7 + 4× throttle). The map
  is now 48×32, with 6 ground chunks (5 of them land).
