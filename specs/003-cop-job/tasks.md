# 003 — Tasks

> **DRAFT. Waiting for review.** Tasks are done in order. ⏸ marks a stop for a quick human play.

## A. Driving feel
- [ ] T1 Write `src/iso/steer.ts` (`screenAngle`, `pickBranch`, `wantsUTurn`) with unit tests.
      - Angle sweep × every node: no flip-back-and-forth.
      - Ties go to straight ahead.
      - (AC1, AC2)
- [ ] T2 `LaneDriver`:
      - stick in screen space;
      - commit to the next edge at t ≥ 0.5;
      - corner arcs;
      - `headingAngle`;
      - U-turn spin state.
      - Extend the "never leaves the road" test to sample arc positions; existing driving tests
        keep passing. (AC1, AC3)
- [ ] T3 Vehicle art: 8 facings for the police car, getaway car and van.
      - `facing8`.
      - Spin and hop on U-turn.
      - Check with gallery screenshots. (AC4)
- [ ] T4 Add the dev-only `?drive` tuning overlay and tune by hand in the browser; write
      ADR-004; commit.
- [ ] ⏸ T5 Chris drives with keys, mouse and thumb (emulated, and on a phone if possible) and
      confirms it feels right. Record the result in the playtest note. (AC5)

## B. Rookie Cop
- [ ] T6 `MissionDirector` + goal handlers refactor.
      - No behaviour change: all of 002's e2e and unit tests still pass.
- [ ] T7 Missions schema:
      - new goal types (`checkpoints`, `siren`, `escort`, `find`, `catch.robbers`);
      - `requires` against `badges` and `owned`;
      - badge award.
      - Update the Goal union in `architecture.md`.
      - Tests. (AC7, AC8)
- [ ] T8 Map:
      - `downtown.json` covers the full district: Tower, park and paths, pond, second crossing,
        chief, flags;
      - lane graph per vehicle class.
      - Test: walkers stay off roads; the car can't use paths. (AC10 part)
- [ ] T9 Chief with a star bubble, and the mission board with stars, padlocks and replay.
      (AC6, AC15)
- [ ] T10 Net launcher:
      - `systems/net.ts` cone + tests;
      - `Net` entity;
      - net icon on the Action button;
      - catch on hit;
      - the robber generalised from `RobberChase`. (AC11)
- [ ] T11 Time-Out Tower: the van drives there, robbers are visible inside, and they sneak out at
      the next robber mission's intro. (AC12)
- [ ] T12 Ambient `TrafficCar`s: wander on roads, wait for the siren, ducks and the player; check
      perf.
- [ ] T13 Mission **First Day**: checkpoint flags, siren goal, Traffic Helper. Voice lines + e2e.
      (AC6)
- [ ] T14 Mission **Donut Dash**: ends at the Tower; the net works. Update the e2e test. (AC6)
- [ ] T15 Mission **Duck Crossing**: `systems/escort.ts` + tests; ducks follow; traffic waits for
      the siren; the "easier" step is that the ducks wait. e2e. (AC6, AC14)
- [ ] T16 Cop badge ceremony + HUD badge slot; saved. e2e + unit tests. Commit. (AC7, AC17 part)
- [ ] ⏸ T17 Quick play of the 3 Rookie missions (Chris and/or James). Record findings.

## C. Pro Cop
- [ ] T18 `Economy.spend` + `systems/shop.ts` + `content/shop.json`, with tests. (AC9)
- [ ] T19 ShopScene: picture card, buy button, "not yet" wobble with a count of minigames still
      needed. Shop door in the Plaza. e2e. (AC9)
- [ ] T20 Police bike: art (8 facings), stats, road and park-path lane graph, vehicle picker at
      the station. (AC10)
- [ ] T21 Pro lock: padlocks on the board and the chief, until the player has both the badge and
      the bike. Unit test + e2e. (AC8)
- [ ] T22 Who Took It?:
      - `systems/whoTookIt.ts` + tests;
      - `WhoTookItScene`;
      - pad at the station;
      - `minigames.json` entry.
      - (AC13)
- [ ] T23 Mission **Rooftop Run**: Smudge's scooter flees through the park and alleys; catch with
      bike + net. e2e. (AC6)
- [ ] T24 Mission **Lost Puppy**: `find` handler; bark volume grows as you get closer; paw prints;
      3 spots; return to owner; the "easier" step is louder barks. e2e. (AC6, AC14)
- [ ] T25 Mission **Double Trouble**: two robbers that split up, catch both, then Who Took It? at
      the station. e2e. (AC6, AC13)
- [ ] T26 Three new Cop errands that appear after missions; economy test still holds. (AC16)
- [ ] T27 Hints for every goal (unit test: every goal has a target), plus voice lines for
      everything. (AC18)
- [ ] T28 Save round-trip + migrate from a spec 002 save; e2e reload. (AC17)
- [ ] T29 Perf: `SCENARIO=double`, Pixel 7 + 4× throttle; record the result. Real-phone touch
      check. (AC20)
- [ ] T30 Update `docs/playtests/TEMPLATE.md` for 003; tick all ACs with evidence; update the
      roadmap and README; commit; hand over for James's playtest. (AC19, AC21)
