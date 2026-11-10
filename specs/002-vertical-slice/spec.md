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
- [ ] AC1 From Title, James reaches driving the police car in ≤ 3 taps/clicks with zero text needed.
- [ ] AC2 Car stays on the road via road assist; at intersections joystick/arrow picks the closest branch.
- [ ] AC3 Siren plays and lights flash on every press; holding/spamming never errors or stacks badly.
- [ ] AC4 Robber flees, wobbles, drops 5 donuts; 3 bumps catches him with the comedy sequence; no harm depicted.
- [ ] AC5 Mission can't be failed; after ~3 missed catch attempts the getaway car runs out of gas.
- [ ] AC6 Donuts can be returned to the shop for 10 coins; errand marked done and saved.
- [ ] AC7 Traffic Helper runs as its own scene, pays 5/15/30 by score, never shows a fail, returns to City.
- [ ] AC8 Coins never come from bumping/smashing anything.
- [ ] AC9 Idle 20 s → arrow + voice hint pointing to the current goal.
- [ ] AC10 Reloading the page keeps coins and completed mission/errand.
- [ ] AC11 Pedestrians are never hit; bumped props reset within 5 s.
- [ ] AC12 ≥ 55 fps on Pixel 7 emulation + 4× throttle during the chase; works with touch on a real Android phone in Chrome.
- [ ] AC13 Unit tests: economy, save load/migrate, mission state machine, road-assist branch choice, minigame scoring tiers.
- [ ] AC14 A playtest note template exists at `docs/playtests/TEMPLATE.md`.
