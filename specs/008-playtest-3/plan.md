# 008 — Plan

## Approach
Slices, each with pure logic in `src/systems/` (unit-tested) and a thin scene on top.

1. **Stuck mission.** `needUpgradeLine(job)` in `systems/jobs.ts`; `MissionDirector.hint()` points
   at the Shop while `lockedOnlyByShop()`; `CityScene.onMenuClosed` says `upgrade-bought`.
2. **Map.** `scripts/stretch-map.mjs` rewrites the four district JSON files with extra rows and
   columns inside blocks (never through a road or a building), shifts every coordinate, and adds
   street furniture. `content/sea.json` is a new background piece (open sea, islands, sea
   markers). `world.ts` places the pieces at their new offsets. Hard-coded coordinates in
   `CityScene` (parade ring) become markers.
3. **Objective arrows.** `systems/guide.ts` `ObjectiveGuide` (no progress for N s → show; arrive →
   hide; new target → reset). `CityScene.publishHud` sends `guide` (screen point, on-screen flag);
   `HudScene` draws the arrow on the target or on the screen edge.
4. **Boat.** `systems/boat.ts` `BoatModel` (velocity, drag, slide along shore, steer-to-point).
   `entities/Boat.ts` draws it and exposes the same small surface as `Vehicle` (`pos`, `img`,
   `driver.speed`, `driver.headingAngle`, …) so `riding()` consumers keep working. Art: boat
   frames in `art/boats.ts`. Sea waves: one camera-fixed TileSprite.
5. **Rescues.** Mission tier `rescue`; `goTo` gets optional `carry`; `checkpoints` gets optional
   `look`. `MissionDirector.updateLifeguard()` mirrors the mayor's finale offers.
6. **Build It!** `systems/buildJob.ts` `BuildJobModel`; blueprints in `content/blueprints.json`;
   `scenes/BuildItScene.ts`. `CityScene.blast()` opens it; `EV.buildDone` finishes the site.
7. **Minigame kit.** `systems/round.ts` (hearts, levels, star meter maths);
   `scenes/minigameKit.ts` gains the top bar, level-up banner, score pops, `fail()`/retry;
   every minigame scene uses it; Traffic Helper moves onto `MinigameScene`.
8. **Title.** New `TitleScene` art; Play stays at (640, 250).

## Data
- `minigames.json`: `hearts` (0 = none), `levelEvery`.
- `missions.json`: four `rescue` missions.
- `blueprints.json`: pieces per build spot.
- Save: unchanged (boat = `built:dock`).

## Risks
- Stretching moves every coordinate: tests that hard-code tiles must move to markers.
- Hearts could frustrate a 6-year-old: extra hearts after each Oops, hearts back on streaks.
- Boat as a "vehicle": anything assuming a lane graph must check for it.

## Test approach
Unit tests for every new pure module; world invariants (markers on the right tile kinds, vehicle
starts on roads, reachability); e2e for the six notes; screenshots checked by eye.
