# ADR-005: Mission director with goal handlers, and how the world grows

**Status:** accepted · 2026-11-10 · spec 003

## Context
Spec 002 hard-coded one mission (Donut Dash) inside `CityScene`. Spec 003 adds six Cop missions
with new goal types (flags, siren, escort, find, two robbers), and specs 004 and 005 add two more
jobs with their own goals. The plan asked for a `MissionDirector` before any new mission is added,
so `CityScene` doesn't grow without end.

The map also had to grow: Downtown gains its south half (Time-Out Tower, a park with bike paths, a
duck pond and a second crossing), and later specs add Skyscraper Heights and the Harbor.

## Decision

### Missions
- **Pure state** stays in `src/systems/missions.ts` (unit-tested):
  - the zod `Goal` union;
  - `MissionRun`. Multi-part goals (two robbers, three flags, several fires) complete when all
    their parts are done, in any order. `notify()` returns `'part'`, `'goal'` or `'complete'`;
  - `requires` checks: mission ids, `badge:<job>`, `owned:<item>`;
  - `nextMission`;
  - `earnedBadges`: a job's badge once all of its Rookie missions are done.
- **`src/missions/MissionDirector.ts`** runs a mission in the world:
  - the job's boss (the chief) shows the next mission's picture in a bubble, and walking up starts it;
  - one `GoalHandler` per goal (`src/missions/handlers.ts`): `start`, `update`, `onPart`,
    `onSiren`, `hint`, `end`;
  - the finish: pay, save, stars, the badge ceremony, and errands that unlock after the mission;
  - a "companion" (the found puppy) that follows the player until the mission ends.
- **`src/missions/world.ts`** defines `MissionWorld`, the small surface handlers may use. Handlers
  never touch input or the HUD; they ask the world to spawn robbers, drop pickups, and so on.
  `CityScene` implements it.
- **Replays** come from the mission board, and pay in full (spec 003 decision 6). Starting a
  replay while another mission is running abandons that one, with no penalty.
- **Spec 002 content** (`{ type: 'catch', robber }`) still loads: it becomes one robber in the
  getaway car.

### World layout
- **The world is one merged map** (`src/content/world.ts`), made of district pieces at fixed tile
  offsets. Coordinates of existing places never change when a district is added, so saves, tests
  and content stay valid.
  | District | Tiles | Spec |
  | --- | --- | --- |
  | Downtown | x 0–15, y 0–31 | 002 (north half), 003 (south half) |
  | City Plaza | x 16–31, y 0–15 | 001 |
  | Skyscraper Heights | x 16–31, y 16–31 | 004 |
  | Harbor | x 32–47, y 0–31 | 005 |
- **Water and paths.**
  - Gaps between pieces are sea (a new `water` tile), drawn as the camera background.
  - The duck pond is the same tile but enclosed by land, so it is drawn.
  - Earth slab sides are drawn wherever land meets water on a front edge.
  - Ground chunks that are all sea get no texture.
- **Lane graphs are built per vehicle class** (`buildRoadGraph(map, 'car' | 'bike')`): bikes
  also use `path` tiles (park paths) and cars don't (AC10).

### Gameplay numbers chosen while building
- **Net aim help:** a 70° cone, 5 tiles long. The net flies at 9 tiles/s and homes in on its
  target.
  - The plan said 60°, 4 tiles and 2.5 tiles/s. But a getaway car does up to 4.4 tiles/s, so a
    2.5 tiles/s net could never reach him.
  - One hit catches him. A miss costs nothing, and there is a 0.6 s wait before the next shot.
- **Traffic:**
  - three town cars at 2.6 tiles/s;
  - they always stop for anything just ahead of them (people, ducks, other cars), so nobody is
    ever hit;
  - a siren or whistle within 7 tiles stops them for 5 s.
- **Siren on foot:** the siren button also works on foot, as a police whistle. Duck Crossing is
  played on foot, and the spec has the siren stop traffic there.
- **What gets easier after about 3 tries (AC14):**
  - Chase: the robber runs out of gas (as in spec 002).
  - Duck Crossing: after the ducks have had to stop 3 times (left behind, or waiting at the kerb),
    they hurry and no longer wait for traffic.
  - Lost Puppy: after 45 s on one hiding spot, the barks go to full volume and a longer paw-print
    trail appears.
- **Vehicle picker:** the bike is parked next to the car at the station once bought, and you tap
  the one you want or walk up to it. The plan said picture buttons. Parked vehicles are the same
  pictures, need no new UI, and match how the car already works.

## Consequences
- **New goal types** (spec 004 `spray` and `rescue`, spec 005 `build`) each need a schema entry
  and one handler class. `CityScene` only gains world features.
- **`CityScene`** is still large (it owns entities, input, pads, errands and depth sorting), but
  mission logic lives in the director and its handlers.
- **Mission tests** are e2e flows that use debug-hook shortcuts (`startMission`, `grant`,
  `driveTo`, `walkTo`, `fireNet`) plus unit tests of the pure models.
