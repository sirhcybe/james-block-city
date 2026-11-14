# ADR-011: Bigger world, the boat, Build It!, and minigame hearts

**Status:** accepted · 2026-11-13 · spec 008

## Context
The third playtest asked for a bigger map with pointers, boats, a build minigame, and minigames
with progression and "a small failure state". Until now the rule was "no fail states" anywhere.

## Decision
- **Minigame rounds may end in "Oops".** Each minigame has `hearts` in `minigames.json` (0 = none).
  A mistake costs one; at zero the round stops with a retry button and a back button.
  - No coins are paid and none are lost. Each retry starts with two more hearts (up to +4), and a
    streak of five wins one back, so nobody stays stuck.
  - A round that reaches its end still always pays at least 5.
  - Missions and the open city still cannot be failed. `AGENTS.md` now says exactly this.
- **Levels inside a round.** `levelEvery` points raise the level; each model has a `level` the
  scene sets, and uses it to speed up a little. Replays still start harder (`plays`).
- **One top bar** for every minigame lives in `MinigameScene` (`addTopBar`, `syncTopBar`, `good`,
  `oops`, `fail`, `retry`). Traffic Helper moved onto `MinigameScene`.
- **The map is stretched by a script,** `scripts/stretch-map.mjs`, kept in the repo as the record
  of the rule:
  - it inserts a copy of each block's sidewalk row/column on the road side, so roads stay two
    tiles wide and landmarks keep their neighbours;
  - minigame pads and boards move to the new outer ring;
  - it adds street furniture on the new tiles and writes `sea.json`.
  The districts are now hand-editable JSON again; the script refuses to run twice.
- **The sea is a background map piece.** `mergeMaps` lays the districts over it. `buildSeaGrid`
  says where a boat may go (water, minus built docks/bridges and things standing in the water).
- **The boat steers freely.** Roads snap vehicles to lanes; open water has no lanes, so the boat
  has its own model (`BoatModel`: accelerate toward the stick, drag, slide along shores).
  `Boat` exposes what the city reads on any ride (`pos`, `img`, `driver.speed`,
  `driver.headingAngle`, `flash`, `hop`), and `Ride = Vehicle | Boat` is what `riding()` returns.
  It counts as "driving" (`mode === 'car'`), so the HUD and mission checks did not change.
- **Rescues are a fourth mission tier,** `rescue`, offered by the lifeguard (like the mayor's
  finale offers). `isJobMission()` keeps them off the job boards and out of the bosses' logic.
  When all of a job's rescues are done they come round again.
- **Build It! replaces pressing the blaster N times.** The blaster opens `BuildItScene`; finishing
  it emits `EV.buildDone` and the city grows the building as before. Blueprints are content
  (`blueprints.json`). Leaving part-way leaves the build spot waiting.
- **Objective arrows** come from `ObjectiveGuide` (no progress for 5 s in a mission, 12 s outside
  one), drawn by the HUD on the target or on the screen edge. The 20 s idle hint is unchanged.

## Consequences
- Every world coordinate moved; tests use markers or the new coordinates.
- `SiteState`'s block counting is only used for "built or not" now.
- A six-year-old can lose a minigame round. Watch for this in the next playtest; `hearts: 0`
  in `minigames.json` turns it off per game with no code change.
