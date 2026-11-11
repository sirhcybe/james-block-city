# 003 — Tasks

> Approved 2026-11-09. Tasks are done in order. ⏸ marks a stop for a quick human play.

## A. Driving feel
- [x] T1 Write `src/iso/steer.ts` (`screenAngle`, `pickBranch`, `wantsUTurn`) with unit tests.
      - Angle sweep × every node: no flip-back-and-forth.
      - Ties go to straight ahead.
      - (AC1, AC2)
      Done: `src/iso/steer.ts` (`toScreen`, `stickDiff`, `pickBranch`, `wantsUTurn`); tests in
      `roads.test.ts` (ties, stop, going back) and the `driving.test.ts` sweep (AC1).
- [x] T2 `LaneDriver`:
      - stick in screen space;
      - commit to the next edge at t ≥ 0.5;
      - corner arcs;
      - `headingAngle`;
      - U-turn spin state.
      - Extend the "never leaves the road" test to sample arc positions; existing driving tests
        keep passing. (AC1, AC3)
      Done. The next edge is picked on entering an edge and can be re-picked until its curve
      starts (instead of at t ≥ 0.5). Stop line half a tile before a junction; `placeOnEdge` for
      the debug hook.
- [x] T3 Vehicle art: 8 facings for the police car, getaway car and van.
      - `facing8`.
      - Spin and hop on U-turn.
      - Check with gallery screenshots. (AC4)
      Done: `drawOrientedBlock` (`art/blocks.ts`) + `orientedBoxFaces` (`art/isoShapes.ts`, unit
      tested); `dir8`; the light bar is an overlay sprite; checked in `?gallery=vehicles` and in
      the city.
- [x] T4 Add the dev-only `?drive` tuning overlay and tune by hand in the browser; write
      ADR-004; commit.
      Done: `src/driveTuning.ts` (`?play&drive`, dev build only); ADR-004. Defaults kept from
      spec 002 except the new corner speed 3.6, curve 0.9 and spin 0.35 s.
- [x] ⏸ T5 Chris drives with keys, mouse and thumb (emulated, and on a phone if possible) and
      confirms it feels right. Record the result in the playtest note. (AC5)
      Done: "better, but hard to travel between the two blocks" (`docs/playtests/2026-11-10.md`).
      Fixed: three roads across the seam; reverse from a stop within 85°; travel tests.

## B. Rookie Cop
- [x] T6 `MissionDirector` + goal handlers refactor.
      - No behaviour change: all of 002's e2e and unit tests still pass.
      Done: `src/missions/MissionDirector.ts` + `handlers.ts` + `world.ts` (ADR-005); spec 002's e2e still pass (updated only where the chief now starts missions).
- [x] T7 Missions schema:
      - new goal types (`checkpoints`, `siren`, `escort`, `find`, `catch.robbers`);
      - `requires` against `badges` and `owned`;
      - badge award.
      - Update the Goal union in `architecture.md`.
      - Tests. (AC7, AC8)
      Done: `systems/missions.ts` (goal union, multi-part goals, `requires`, `nextMission`, `earnedBadges`; spec 002 `{robber}` still loads); `architecture.md` updated; tests in `cop.test.ts`.
- [x] T8 Map:
      - `downtown.json` covers the full district: Tower, park and paths, pond, second crossing,
        chief, flags;
      - lane graph per vehicle class.
      - Test: walkers stay off roads; the car can't use paths. (AC10 part)
      Done: `content/downtown.json` (16×32: Tower, park + paths, pond, second crossing, chief, board, flags, spots); `water`/`path` tiles; `buildRoadGraph(map, 'car' | 'bike')`; tests: bike uses paths, car can't, water not walkable, places reachable.
- [x] T9 Chief with a star bubble, and the mission board with stars, padlocks and replay.
      (AC6, AC15)
      Done: chief (`Townsperson` + swappable bubble) driven by the director; `MissionBoardScene` (cards, stars, padlocks, replay). e2e: board replay in the Donut Dash test.
- [x] T10 Net launcher:
      - `systems/net.ts` cone + tests;
      - `Net` entity;
      - net icon on the Action button;
      - catch on hit;
      - the robber generalised from `RobberChase`. (AC11)
      Done: `systems/net.ts` (cone 70°/5 tiles, homing shot at 9 tiles/s; the plan's 2.5 tiles/s could never catch a 4.4 tiles/s car: ADR-005) + tests; net icon on Action only with a target; one net = caught; `RobberChase` generalised (any robber, car or scooter).
- [x] T11 Time-Out Tower: the van drives there, robbers are visible inside, and they sneak out at
      the next robber mission's intro. (AC12)
      Done: `entities/TimeOutTower.ts` (robbers sit behind the big window; tiptoe sneak-out at the next catch goal). e2e: tower state after a catch and after the sneak-out.
- [x] T12 Ambient `TrafficCar`s: wander on roads, wait for the siren, ducks and the player; check
      perf.
      Done: `entities/TrafficCar.ts` (3 cars, random branches, always stop for what's ahead, wait 5 s for a siren/whistle within 7 tiles). Perf: see T29.
- [x] T13 Mission **First Day**: checkpoint flags, siren goal, Traffic Helper. Voice lines + e2e.
      (AC6)
      Done: checkpoint flags, siren goal, Traffic Helper; the cap is given at the intro. e2e `First Day`.
- [x] T14 Mission **Donut Dash**: ends at the Tower; the net works. Update the e2e test. (AC6)
      Done: ends with Pickles in Time-Out Tower; the net catches him. e2e `Donut Dash` (+ spec 002 test).
- [x] T15 Mission **Duck Crossing**: `systems/escort.ts` + tests; ducks follow; traffic waits for
      the siren; the "easier" step is that the ducks wait. e2e. (AC6, AC14)
      Done: `systems/escort.ts` + tests; `entities/DuckLine.ts`; ducks wait at the kerb when traffic comes; the siren (a whistle on foot) stops traffic; easier after 3 stops. e2e `Duck Crossing`.
- [x] T16 Cop badge ceremony + HUD badge slot; saved. e2e + unit tests. Commit. (AC7, AC17 part)
      Done: badge awarded by `GameState.completeMission` (saved), ceremony in `HudScene`, badge slot under the coins. e2e + unit test.
- [ ] ⏸ T17 Quick play of the 3 Rookie missions (Chris and/or James). Record findings.
      Skipped by Chris's choice on 2026-11-10 (build 003–005 straight through); covered by the next playtest.

## C. Pro Cop
- [x] T18 `Economy.spend` + `systems/shop.ts` + `content/shop.json`, with tests. (AC9)
      Done: `Economy.spend`, `systems/shop.ts`, `content/shop.json`, `GameState.buy`; tests.
- [x] T19 ShopScene: picture card, buy button, "not yet" wobble with a count of minigames still
      needed. Shop door in the Plaza. e2e. (AC9)
      Done: `ShopScene` (card, coin price, buy button, wobble + minigame-picture count); Shop door pad in the Plaza (`shop` building). e2e `Pro lock + Shop`.
- [x] T20 Police bike: art (8 facings), stats, road and park-path lane graph, vehicle picker at
      the station. (AC10)
      Done: `POLICE_BIKE` (narrow vehicle with a cop rider, 8 facings), faster + zippier; bike lane graph includes park paths; the bike is parked by the car once bought (tap the one you want: ADR-005).
- [x] T21 Pro lock: padlocks on the board and the chief, until the player has both the badge and
      the bike. Unit test + e2e. (AC8)
      Done: `requires` = badge + bike; padlocks on the board; the chief shows a bike bubble and says to buy one. Unit test + e2e.
- [x] T22 Who Took It?:
      - `systems/whoTookIt.ts` + tests;
      - `WhoTookItScene`;
      - pad at the station;
      - `minigames.json` entry.
      - (AC13)
      Done: `systems/whoTookIt.ts` + tests, `WhoTookItScene` (shared `MinigameScene` base in `minigameKit.ts`), pad at the station, `minigames.json` entry.
- [x] T23 Mission **Rooftop Run**: Smudge's scooter flees through the park and alleys; catch with
      bike + net. e2e. (AC6)
      Done: Smudge on the scooter flees on the bike graph (park paths); bike + net. e2e `Rooftop Run`.
- [x] T24 Mission **Lost Puppy**: `find` handler; bark volume grows as you get closer; paw prints;
      3 spots; return to owner; the "easier" step is louder barks. e2e. (AC6, AC14)
      Done: `systems/find.ts` + tests, `FindHandler` (barks by distance, paw prints, bush shakes, puppy follows you home); easier: full-volume barks after 45 s. e2e `Lost Puppy`.
- [x] T25 Mission **Double Trouble**: two robbers that split up, catch both, then Who Took It? at
      the station. e2e. (AC6, AC13)
      Done: two getaway cars (Smudge's is teal), either order, then Who Took It? at the station. e2e `Double Trouble`.
- [x] T26 Three new Cop errands that appear after missions; economy test still holds. (AC16)
      Done: `return-socks` (Return), `find-rubber-duck` (Find), `deliver-balloon` (Deliver), each offered after a Pro mission (`after`). Unit tests; the economy test still holds.
- [x] T27 Hints for every goal (unit test: every goal has a target), plus voice lines for
      everything. (AC18)
      Done: every goal has a hint target (unit test AC18); voice lines for all intros, hints, catches and the badge in `voice.json`.
- [x] T28 Save round-trip + migrate from a spec 002 save; e2e reload. (AC17)
      Done: no save version bump needed (SaveV1 already had `badges`, `owned`, `missionsDone`); unit test loads a spec 002 save; e2e reload keeps badges, owned, stars and the bike.
- [ ] T29 Perf: `SCENARIO=double`, Pixel 7 + 4× throttle; record the result. Real-phone touch
      check. (AC20)
      Done (emulated): `SCENARIO=double` in `scripts/perf.mjs`. Pixel 7 + 4× throttle, real GPU: Double Trouble 81 fps avg (p95 20 ms), chase 85 fps (p95 17 ms), walk 97 fps. **Real Android phone touch check: still to do** (carried to the playtest).
- [x] T30 Update `docs/playtests/TEMPLATE.md` for 003; tick all ACs with evidence; update the
      roadmap and README; commit; hand over for James's playtest. (AC19, AC21)
      Done: playtest template updated for 003; ACs ticked with evidence; roadmap + README updated.