# 003 — Plan

> **DRAFT. Waiting for review together with spec.md.**

## Approach
The work comes in three parts, each one playable on its own. We stop for a quick play after
each part.

- **A. Driving feel.** Steering moves into a pure module that works in *screen* angles. `LaneDriver`
  decides on its next edge half a tile before each node, so it can draw an arc through the corner.
  Vehicles get 8 facings. This replaces the "stick → grid → dot product" path from spec 002.
  It is recorded as **ADR-004**, which updates ADR-003. The lane graph itself stays the same.
- **B. Rookie Cop.**
  - Mission flow moves out of `CityScene` into a `MissionDirector`, with one small handler per
    goal type.
  - Then we add the chief, the mission board, the net launcher, Time-Out Tower, ambient traffic,
    the 3 Rookie missions and the badge.
- **C. Pro Cop.** Shop and `Economy.spend`, the police bike and park paths, Who Took It?, the 3 Pro
  missions and the errands.

## Files / modules

### A. Driving
- `src/iso/steer.ts` (new, pure):
  - `screenAngle(gridDir)` returns the angle of a grid direction as drawn on screen.
  - `pickBranch(stickScreen, heading, options)` picks the branch closest to the stick by screen
    angle. Ties go to straight ahead, then to the branch closest to the current heading.
    Returns -1 when there is no input and the road isn't straight.
  - `wantsUTurn(stickScreen, heading, secondsSinceTurn)` turns around only when the stick is more
    than 110° from the heading, and not within 0.3 s of the last direction change.
  - Unit tests: an angle sweep × every node in the world graph, checking AC1 and AC2.
- `src/iso/roads.ts`:
  - `chooseBranch` is kept only for AI choosers with no input (straight on or follow a bend).
    Player input goes through `steer.ts`.
  - `buildLaneGraph` takes a tile predicate per vehicle class: road only for the car, road or
    `path` for the bike.
- `src/entities/LaneDriver.ts`:
  - `DriveInput.stick` becomes screen-space; `screenDirToGrid` is no longer used for cars.
  - It commits to the next edge when `t ≥ 0.5`, so the corner arc is known in advance.
  - `pos` follows a quadratic curve from half a tile before the node to half a tile after it,
    blending the incoming and outgoing lane offsets.
  - It exposes a continuous `headingAngle` for 8-way facing.
  - A U-turn is a state, `spinning` for 0.35 s: speed goes to 0, then the car spins and hops.
- `src/art/vehicles.ts`: bake 8 facings. The 4 screen-diagonal facings (NE, NW, SE, SW) already
  exist; add N, S, E and W. `facing8(angle)`.
- `src/scenes/DriveTuning.ts` (dev only, `?drive`): sliders for max speed, acceleration, braking,
  arc radius and U-turn threshold, as a DOM overlay. It is left out of the production build.
- `docs/decisions/ADR-004-screen-space-steering.md`.

### B. Rookie Cop
- `src/missions/MissionDirector.ts`: owns the `MissionRun`, voice intros, hints, rewards and
  replays. It routes world events to goal handlers in `src/missions/goals/*.ts`:
  - `goTo`
  - `catch` (now accepts `robbers: string[]`, in any order)
  - `checkpoints`
  - `siren`
  - `escort`
  - `find`
  - `minigame`
  - `errand`
  - Each handler gives the hint target and an `easier()` step for the "about 3 tries" rule.
  - `CityScene` shrinks to world, entities and input.
- `src/systems/missions.ts`: new goal types `checkpoints {flags}`, `siren`,
  `escort {group, to}`, `find {item, spots}`, and `catch.robbers`. The old `catch.robber` form is
  still accepted. Add `requires` checks against `badges` and `owned`, and a badge award when all of
  a tier is done. Update the Goal union in `docs/architecture.md` to match.
- `src/systems/net.ts` (pure):
  - `netTarget(shooter, heading, robbers)` finds a target in a forward cone, 60° wide and 4
    tiles long.
  - The net flies 2.5 tiles/s and homes in on the target, so it hits whatever lane he's in.
  - `src/entities/Net.ts` handles the visuals.
- `src/entities/RobberChase.ts`: becomes a general robber with a `vehicle` (getaway car or
  scooter). Being netted or bumped triggers the catch. The van then drives to Time-Out Tower.
- `src/entities/TimeOutTower.ts`: a building with a big window. Robbers inside sit in the corner.
  A sneak-out animation plays at the next robber mission's intro.
- `src/entities/TrafficCar.ts`: 2–3 ambient cars on the lane graph, choosing branches at random.
  When a siren is within 4 tiles, or a duck or the player is in front of them, they slow and wait.
- `src/entities/Follower.ts`: the escort logic, in pure `systems/escort.ts`. Ducklings follow a
  trail of the player's breadcrumbs. Within 1 tile of the destination they count as delivered.
- `src/entities/Chief.ts` (Townsperson + cap) and `src/entities/MissionBoard.ts`: one picture card
  per mission with stars, and a padlock if it's locked. Tapping a card replays the mission.
- `src/scenes/HudScene.ts`: a badge slot (top-left, under the coins), and a net icon on the Action
  button.
- Content:
  - `downtown.json` replaces `downtown-slice.json` and covers the full district: Tower, park, pond,
    second crossing, chief marker and checkpoint flags.
  - `missions.json` gets 6 missions; `voice.json` and `errands.json` grow.

### C. Pro Cop
- `src/systems/economy.ts`: `spend(item, price)` returns false and changes nothing if the player
  can't afford it. `award` stays the only way to gain coins.
- `src/systems/shop.ts` + `content/shop.json` (zod): `{ id, price, requires }`.
- `src/scenes/ShopScene.ts`: launched over City from the Shop door in the Plaza.
  - A picture card with price, coin icon and a buy button.
  - "Not yet" shows a wobble and a count of minigame icons for the coins still needed.
- `src/art/vehicles.ts` `POLICE_BIKE`, and `Vehicle` with per-vehicle stats. The vehicle picker is
  two picture buttons at the station.
- `src/scenes/minigames/WhoTookItScene.ts` + pure `src/systems/whoTookIt.ts`:
  - rounds of 5 suspects, one with the clue;
  - clue size and the time to look get smaller on replay;
  - scoring tiers come from `minigames.json`.
- Scooter getaway vehicle for Smudge, and a bark-meter `find` handler for Lost Puppy (a voice and
  sound volume that grows as you get closer).

## Data
- Mission ids: `first-day`, `donut-dash`, `duck-crossing`, `rooftop-run`, `lost-puppy`,
  `double-trouble`.
  - Rookie missions have `requires` naming the earlier missions.
  - Pro missions have `requires: ["badge:cop", "owned:police-bike"]`.
- Badge id: `cop`. The Rookie tier awards it (`reward.unlocks: ["badge:cop"]` on the last Rookie
  mission, and it is awarded once all three Rookie missions are done).
- Save: SaveV1 already has `badges`, `owned` and `missionsDone` (stars), so **no version bump is
  expected**. If one is needed, add SaveV2 with a `migrate` and tests.
- Replay pay-out depends on open question 6.

## Risks
- **Arcs and tight bends.** Arcs combined with 1-tile edges at tight bends could cut the corner
  onto the sidewalk. Mitigation: arc radius ≤ 0.5 tile; the "never leaves the road" test samples
  `pos` every frame.
- **Feel is subjective.** That's why there's a `?drive` tuning overlay, and why we stop for a human
  check after part A (AC5).
- **Performance.** Two robbers, 3 traffic cars, 4 ducks and more pedestrians. Mitigation: occlusion
  sampling only for the focus mover (already true); re-run `scripts/perf.mjs` with a
  `double-trouble` scenario.
- **Bigger map.** A larger Downtown means more ground chunks. They're already chunked and culled,
  so check memory on the phone.
- **CityScene size.** `CityScene` is already large. The `MissionDirector` refactor happens before
  any new mission is added, so the new missions don't make it worse.

## Test approach
- **Unit:**
  - steering (angle sweep, no flip-back-and-forth, ties, AC1–AC3);
  - arcs stay on the road;
  - `requires`, badge award;
  - `spend`;
  - net cone;
  - escort follow and deliver;
  - `find` getting easier;
  - Who Took It? scoring and difficulty;
  - shop schema;
  - mission content (every goal has a hint target);
  - save round-trip.
- **E2E** (state-driven, like 002):
  - one flow per mission, using debug-hook shortcuts for long drives;
  - badge → shop → bike → Pro unlock;
  - mission board replay;
  - reload keeps everything;
  - no DOM text.
- **Manual:**
  - drive-feel check after part A, on keys, mouse and Pixel 7 touch emulation, then a real phone;
  - screenshots of 8 facings, the Tower, the board and the shop.
- **Perf:** `SCENARIO=double` in `scripts/perf.mjs`, Pixel 7 + 4× throttle.
