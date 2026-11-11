# ADR-004: Steer by screen direction, with curves through corners

**Status:** accepted · 2026-11-10 · updates part of ADR-003 (how the stick picks a road)

## Context
In the 2026-11-09 playtest the car controls "didn't feel right". A probe found the cause.

- In spec 002, the stick was converted to a grid direction and compared with roads by dot product.
- The roads run diagonally on screen, so a single arrow key, or a thumb pushed straight up, sits
  between two road directions.
- The car turned around whenever the stick was more than about 127° from its heading. After a
  forced bend, the same held key was suddenly "behind" it.
- So holding Up or Left made the car **flip back and forth forever at a corner**.

Turns were also instant 90° snaps at a point, with a 4-facing sprite.

## Decision
- **Compare directions on screen.** `src/iso/steer.ts` compares the stick, which is screen-space
  with up as negative y, against each road direction as drawn: `toScreen(d) = (dx − dy, (dx + dy)/2)`.
  - On screen, roads that meet at a right angle are 53° or 127° apart, not 90°.
- **The rules in `pickBranch`, which runs at nodes:**
  - With no input: go straight on, else follow a single bend, else stop and wait.
  - With input: take the branch closest to the stick, within 100°. Straight on may be up to 110°.
  - Ties within 3° go to the gentler turn, so straight on wins.
  - Nothing close enough: stop. The stick is saying "not that way".
  - Going back is only allowed when stopped, and only when the stick is mostly behind (within 85°;
    under 90° so a sideways push can't bounce the car between the two ends of a road). This was
    70° at first, which left a diagonal push parked for good on some roads (playtest 2026-11-10).
- **U-turns (`wantsUTurn`).**
  - The car turns round only when the stick is more than 110° from its heading, and not within
    0.3 s of the last change of direction.
  - If a junction less than 1.2 tiles ahead has a road toward the stick, the car takes that
    road instead.
  - A U-turn is a 0.35 s cartoon spin.
  - Why this stops the flip-flopping: with one direction held, the car only travels roads within
    100° of the stick. A loop of roads always needs all four directions, and at least one of them
    is more than 100° from any stick. So the car never returns to the same place. At most one
    U-turn happens, then it drives until no road goes that way and stops.
- **Curves.**
  - `LaneDriver` picks its next edge as soon as it enters an edge, and can re-pick until the
    corner curve starts.
  - It drives along its lane as a line of lane corners, with each turn rounded by a quadratic curve
    of radius ≤ 0.9 tile.
  - It slows to the corner speed for curves and stops at a "stop line" half a tile before a
    junction where it waits.
  - Small jumps in position (re-routing, the lane swap in a U-turn) are hidden by a short visual
    blend.
- **8 facings.**
  - Vehicles are drawn with an oriented-box renderer (`drawOrientedBlock`) at 8 headings, chosen
    by the actual direction of travel.
  - The flashing light bar is a separate overlay sprite, so the extra headings don't double the
    texture memory.
- **Tuning.** Feel values live in `DRIVE_TUNING`, which defaults from `config.ts`. The dev-only
  `?drive` overlay has sliders for them.

## Consequences
- **AC1 of spec 003** is a unit test. It holds 32 stick directions for 30 s from every 5th node in
  every heading. It asserts at most one U-turn, never more than 2 direction changes on one node
  within 1 s, and that the car never leaves the road.
- **Old helpers.** `chooseBranch` (grid-space) is removed. AI cars use `pickBranch` with no stick,
  or their own chooser. `screenDirToGrid` is still used for walking.
- **Pressing "nowhere".** Holding a direction that no road goes in makes the car stop at the
  junction rather than pick something. That feels like "it goes where I push" or not at all,
  which is what we want for a 6-year-old.
- **Corners.** Two right turns on adjacent nodes, a 1-tile jog, get a tiny or zero curve. The
  map has no such jogs today.
