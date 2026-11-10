# 002 — Vertical Slice: Donut Dash

## Goal
The smallest version of the real game that James can playtest: drive a police car with a siren,
chase a robber, play one minigame, do one errand, and earn coins. The question this answers:
**are driving, catching and the minigame fun on their own?**

## Depends on
001 — Isometric Foundation (done).

## User stories
- As James, I start as a Cop at the police station and hear what to do.
- As James, I hop in the police car, drive with my thumb or arrow keys, and spam the siren.
- As James, I chase Pickles' wobbly getaway car and bump it until he gives up — then he waddles into the van.
- As James, I pick up donuts he dropped and bring them back to the donut shop for coins.
- As James, I help ducks cross the road at the traffic light and get coins.
- As James, I see my coins go up and they're still there next time.

## In scope
- Map grows to Plaza + a 16×16 slice of Downtown: police station, donut shop, one traffic-light
  intersection, road loop.
- Police car: code-drawn, 4 directions, spinning wheels, flashing light bar. Enter/exit with Action
  when near. Road assist per `docs/architecture.md`.
- Siren button (Q / on-screen; S stays WASD down) with sound + light flash; spammable.
- Robber (Pickles) + getaway car: flees along roads away from player; wobble; drops 5 donut pickups
  along the route; 3 bumps (or 3 net shots — bumps only for this slice) → stops, "Aw, nuts!" voice,
  robber waddles into a police van; then sneaks off (resets for replay).
- Mission "Donut Dash" (JSON-driven, first use of `systems/missions.ts`): goTo police car → catch → done.
  Reward 20 coins, 1–3 stars (bonus for donuts collected, bonus for catching within 90 s — never a fail).
- Errand "Return the Donuts" (Return kind): donut-shop owner with donut bubble; deliver collected donuts; 10 coins.
- Minigame "Traffic Helper" (own scene over City): tap/click the light to stop cars so ducks cross;
  ~2 min; pays 5/15/30; can't fail; slows down after misses.
- HUD: coin counter (icon + number), Action button, Siren button, joystick (touch only).
- Hints: 20 s idle → bouncing arrow to next goal + voice line.
- Voice placeholder via Web Speech API for ~10 lines (`content/voice.json`).
- SFX via jsfxr: siren, horn, boing, coin ding (rising pitch streak), net/bump, duck quack.
- Save: coins, missionsDone, errandsDone, minigamePlays (SaveV1).
- Pedestrians (3–5) that hop out of the way of vehicles; never hit.
- Bumpable cones and trash cans that tumble and reset (pay nothing).

## Out of scope
Other jobs, Job Center, Shop, net launcher, other districts, music, apartment, real voice recordings.

## Acceptance criteria
- [x] AC1 From Title, James reaches driving the police car in ≤ 3 taps/clicks with zero text needed.
      _Evidence:_ e2e "AC1: Title → driving the police car in 2 taps" (Play, then tap the car: the player walks over and hops in) on desktop + Pixel 7; empty DOM text.
- [x] AC2 Car stays on the road via road assist; at intersections joystick/arrow picks the closest branch.
      _Evidence:_ `tests/unit/driving.test.ts` (2 min of random stick never leaves the road; right-hand lane; turns toward the stick at the crossing; tap-to-go along roads) + `roads.test.ts` (`chooseBranch`); ADR-003.
- [x] AC3 Siren plays and lights flash on every press; holding/spamming never errors or stacks badly.
      _Evidence:_ e2e "AC3": 8 rapid Q presses + the on-screen button all register, lights flash, siren restarts instead of stacking (one oscillator at a time); no errors.
- [x] AC4 Robber flees, wobbles, drops 5 donuts; 3 bumps catches him with the comedy sequence; no harm depicted.
      _Evidence:_ e2e "AC2/AC4/AC5": Pickles flees along roads, donuts drop, 3 bumps → catch sequence (spin, "Aw, nuts!", hops out, waddles into the police van, van drives off); screenshots checked. Unit: `ChaseState` drops exactly 5.
- [x] AC5 Mission can't be failed; after ~3 missed catch attempts the getaway car runs out of gas.
      _Evidence:_ `MissionRun` has no fail state (unit); `ChaseState` runs out of gas after 3 missed attempts or 75 s (unit); stars 1–3 (unit).
- [x] AC6 Donuts can be returned to the shop for 10 coins; errand marked done and saved.
      _Evidence:_ e2e "AC6/…": returning donuts to the owner pays 10, errand `done` and in the save after reload; unit tests for `ErrandBook` + `GameState`.
- [x] AC7 Traffic Helper runs as its own scene, pays 5/15/30 by score, never shows a fail, returns to City.
      _Evidence:_ e2e: walking onto the pad launches `TrafficHelper` over the paused city (HUD asleep), pays 30 for score 17, returns to the city; unit tests: tiers 5/15/30, never fails, slows after misses, harder on replay.
- [x] AC8 Coins never come from bumping/smashing anything.
      _Evidence:_ `Economy` only has `award(minigame|errand|mission)` (unit test asserts no other method and rejects other sources); e2e shows bumping a cone and Pickles leaves coins at 0.
- [x] AC9 Idle 20 s → arrow + voice hint pointing to the current goal.
      _Evidence:_ e2e "AC9": 20 s idle → arrow + voice `hint-car`; input clears it. Unit: `IdleHints`.
- [x] AC10 Reloading the page keeps coins and completed mission/errand.
      _Evidence:_ e2e reload keeps coins (40), `errandsDone`, `minigamePlays`; unit "GameState … survives a reload" covers `missionsDone` too.
- [x] AC11 Pedestrians are never hit; bumped props reset within 5 s.
      _Evidence:_ Unit: every walker route stays off road tiles (`roads.test.ts`), vehicles never leave the road (`driving.test.ts`); e2e: a bumped cone resets in under 5 s of game time (`Bumpable` resets after 2.5 s).
- [ ] AC12 ≥ 55 fps on Pixel 7 emulation + 4× throttle during the chase; works with touch on a real Android phone in Chrome.
      _Evidence:_ Emulated: Pixel 7 + 4× throttle on a real GPU, 84 fps average during the chase (tasks.md T15). **Not yet done: real Android phone in Chrome with touch**, to do at the playtest.
- [x] AC13 Unit tests: economy, save load/migrate, mission state machine, road-assist branch choice, minigame scoring tiers.
      _Evidence:_ `npm test`: 90 unit tests incl. economy, save load/migrate, mission state machine, `chooseBranch`, minigame scoring tiers.
- [x] AC14 A playtest note template exists at `docs/playtests/TEMPLATE.md`.
      _Evidence:_ `docs/playtests/TEMPLATE.md`.
