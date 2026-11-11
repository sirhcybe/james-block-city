# 003 — Cop Job Complete

> **Approved by Chris on 2026-11-09.** The mission stories are the agent's proposals, approved as written.

## Goal
1. Fix the car controls so James feels "my car goes where I push" (finding from the 2026-11-09 playtest).
2. Turn the slice into the whole Cop job:
   - 3 Rookie missions earn the Cop badge;
   - a Shop with the police bike opens the 3 Pro missions;
   - the net launcher;
   - Time-Out Tower;
   - the second Cop minigame, Who Took It?

## Depends on
002 — Vertical slice. Built. The playtest note is in `docs/playtests/2026-11-09.md`. AC12 (real
Android phone) is still open and gets checked again here, as AC20.

## User stories
- As James, when I hold a direction, my car goes that way. It doesn't flip around or wobble, and it
  turns corners smoothly.
- As James, I go to the police chief, hear what's wrong, and go fix it. Each mission is a different
  silly problem.
- As James, I shoot a net at the robber's car and he gets tangled ("Aw, nuts!").
- As James, I see the Bandit Brothers sitting in Time-Out Tower after I catch them.
- As James, I earn a shiny Cop badge, then buy a police bike in the Shop and zoom through
  places the car can't go.
- As James, I play Who Took It? and point at the robber with frosting on his face.

## In scope

### A. Driving feel (playtest fix — do first)
- **Steering by screen angle.** Compare the stick with the four road directions *as they look
  on screen*.
  - If the stick is within 90° of the car's heading, keep going. A tie between two road
    directions always goes to the current heading.
  - Turn around only when the stick is well behind the car (more than about 110° away), and not
    within 0.3 s of the last turn or bend.
  - Result: holding one key or one thumb direction never makes the car flip back and forth.
- **Curves through corners.** Turns and bends follow a short arc through the intersection.
- **Facing.** The sprite turns through an in-between diagonal facing (8 facings for vehicles), so
  it no longer snaps between 4 facings.
- **U-turns.** A U-turn is a quick, cartoon 180° spin with a little hop, not an instant flip.
- **T-junctions.** With no input at a T-junction the car rolls to a gentle stop. Any push picks
  the closest branch, as now.
- **Tuning.** Speed, acceleration and turn feel are tuned by hand. A dev-only `?drive` overlay
  shows the knobs so they can be tuned live in the browser.

### B. Cop job content
- **Downtown grows** to its full north-west district (open question 3). It gains:
  - Time-Out Tower;
  - a park with paths, where the bike can go and the car can't;
  - a duck pond;
  - a second traffic-light crossing.
- **Police chief** at the police station gives missions. A star picture bubble means a mission is
  ready. Walking up to the chief starts it with a voice intro.
- **A mission board** on the station wall has one picture card per mission with its best stars.
  Tapping a card replays that mission.
- **Net launcher** (Cop tool):
  - When a robber is in range ahead, the Action button turns into a net icon.
  - Pressing it fires a slow, big net with a lot of aim help ("generous snapping").
  - A netted getaway car wobbles to a stop. One net catches him; three bumps still work too.
  - Missing costs nothing.
- **Time-Out Tower:**
  - After a catch, the van drives to the Tower. Caught robbers can be seen sitting in the
    corner through a big window.
  - At the start of the next robber mission they "sneak out", shown with a tiptoe animation.
- **Rookie missions** (count toward the Cop badge):
  1. **First Day:**
     - meet the chief and get your cap;
     - drive through 3 checkpoint flags (learn to drive), pressing the siren once;
     - play Traffic Helper once.
  2. **Donut Dash:** the existing mission, now ending at Time-Out Tower. You can catch him with the net.
  3. **Duck Crossing:**
     - a mother duck and 3 ducklings are lost on the road;
     - walk to them, and they follow you in a line;
     - lead them to the pond. Use the siren to make the traffic cars wait as you cross.
- **Cop badge:** a big badge ceremony (sparkles, voice) after the 3 Rookie missions. The badge
  shows on the HUD and is saved in `badges`.
- **Shop** (in the Plaza, picture-only):
  - one item, the police bike, for 90 coins;
  - the coin price is shown as a number with a coin icon;
  - tapping an item you can't afford yet shows a "not yet" wobble and says how many minigames
    you still need, as a picture count. No error sound.
  - Buying saves to `owned`.
- **Police bike:**
  - your second Cop vehicle, picked at the police station with picture buttons;
  - faster acceleration, a small siren;
  - road assist on roads and on park paths.
- **Pro missions** (need the badge and the bike):
  4. **Rooftop Run:** Smudge grabs the mayor's rubber duck and runs off on a scooter through the
     park paths and back alleys. Chase him on the bike and net him.
  5. **Lost Puppy:**
     - a "Find" mission;
     - follow barks that get louder and paw-print trails to 3 hiding spots;
     - the puppy is in the last one;
     - take it back to its owner.
  6. **Double Trouble:**
     - both Bandit Brothers flee in two getaway cars that split up;
     - catch both (any order);
     - then play Who Took It? at the station to find which one has the last left sock.
- **Who Took It?** minigame:
  - five suspects in a line-up, and one has the clue (frosting, a feather, a sock);
  - tap the right one;
  - about 2–3 min, pays 5/15/30, can't fail. A wrong tap gets a funny "not me!" shrug;
  - gets harder on replay;
  - played at the police station (pad) and as part of Double Trouble.
- **Errands:** 3 more Cop errands that appear after missions (Return / Find / Deliver), for example
  the mayor's duck and a lost sock. Same `ErrandBook` rules as now.
- **Voice:** new lines for every mission intro, hint, catch and badge (placeholder speech).
- **Save:** badges, owned items, stars per mission. Older saves keep working (migrate if the
  schema changes).

## Out of scope
- Other jobs and the Job Center.
- The uniform rack (spec 004). The game still starts as Cop.
- Shop items other than the police bike.
- Helicopter.
- Skyscraper Heights and Harbor (they stay water/park).
- Music.
- Real voice recordings.
- Apartment.

## Acceptance criteria

### Driving feel
- [x] AC1 Holding any single direction (8 keyboard directions, any stick angle) for 30 s from any
      start never makes the car flip back and forth.
      - Measure: no more than 1 U-turn in a row without a different input in between.
      - Never more than 2 direction changes on the same node within 1 s.
      - Evidence: unit test that sweeps the stick angle × start positions.
      _Evidence:_ `tests/unit/driving.test.ts` AC1 sweep (32 directions × every 5th node × each heading × 30 s): at most 1 U-turn, never more than 2 changes on one node within 1 s, never off the road. Plus the Downtown ↔ Plaza travel tests (2026-11-10).
- [x] AC2 At every intersection, the branch closest to the stick *as seen on screen* is taken.
      When the stick sits exactly between two branches and one is straight ahead, the car goes
      straight ahead. Evidence: unit test.
      _Evidence:_ `tests/unit/roads.test.ts` (`pickBranch` ties go straight, closest branch on screen) and the crossing-turn test in `driving.test.ts`.
- [x] AC3 Turns follow a smooth arc and the vehicle never leaves the road, including mid-arc.
      Evidence: the existing 2-minute random-input unit test, extended to the arcs.
      _Evidence:_ `driving.test.ts` "never leaves the road whatever the stick does (curves and spins included)" samples the position every frame for 2 minutes.
- [x] AC4 Vehicles show 8 facings and U-turns are a 180° spin animation. Evidence: screenshots in
      the gallery and in the city.
      _Evidence:_ `?gallery=vehicles` (8 headings of every vehicle) and city screenshots; spin state unit test (`dir8` 4 after a U-turn).
- [ ] AC5 A grown-up confirms that driving with keys and with the thumb feels like "it goes where I
      push" (Chris; and James at the next playtest). Evidence: playtest note.
      _Evidence so far:_ Chris on 2026-11-10: "driving is better" plus the travel fix (`docs/playtests/2026-11-10.md`). James's check is still to do at the next playtest.

### Cop job
- [x] AC6 The chief offers the next mission with a picture bubble, and walking up starts it with
      a voice intro. All 6 missions can be completed from start to finish with zero reading.
      Evidence: one e2e flow per mission.
      _Evidence:_ `tests/e2e/cop.spec.ts`: one flow per mission (First Day starts by walking up to the chief; the others via the chief's `startMission` path), no DOM text.
- [x] AC7 Finishing all 3 Rookie missions awards the Cop badge with a ceremony. The badge is
      saved and shown on the HUD. Evidence: e2e + unit test.
      _Evidence:_ unit test "GameState awards the badge once, saves it"; e2e Duck Crossing (badge saved, ceremony voice line).
- [x] AC8 Pro missions stay locked (a padlock picture on the board, and the chief doesn't offer
      them) until the player has both the badge and the police bike. Evidence: unit test of
      `requires`.
      _Evidence:_ unit test "Pro missions stay locked until … BOTH the badge and the police bike"; padlocks on the board (screenshot); e2e Pro lock + Shop.
- [x] AC9 The Shop sells the police bike for 90 coins.
      - Buying it can't push coins below 0.
      - Coins only go down by buying.
      - It is saved in `owned`.
      - Evidence: unit test (economy `spend`) + e2e.
      _Evidence:_ unit tests `Economy.spend` and "buying the police bike costs 90"; e2e Pro lock + Shop (not yet = no change; 100 → 10 coins; saved in `owned`).
- [x] AC10 The police bike can be driven on roads and park paths, and the car can't use park
      paths. Evidence: unit test on the lane graph.
      _Evidence:_ unit test "the bike can use park paths; the car cannot" (`cop.test.ts`).
- [x] AC11 The net launcher catches a robber from one hit, with big aim help.
      - A miss costs nothing.
      - The Action button shows a net icon only when a robber is in range.
      - Evidence: unit test of the target cone + e2e catch.
      _Evidence:_ unit tests (cone, centre-line preference, homing hit, free miss); e2e Donut Dash (no net aim from far away; one net catches Pickles with fewer than 3 bumps).
- [x] AC12 After a catch, the robber can be seen in Time-Out Tower. He sneaks out at the start of
      the next robber mission. Evidence: screenshot + e2e state check.
      _Evidence:_ e2e Donut Dash (`tower` = ['pickles'] after the catch, [] after the sneak-out at the replay, `tower-sneak` voice line); screenshot of the tower.
- [x] AC13 Who Took It?
      - runs as its own scene;
      - pays 5/15/30;
      - a wrong tap gives a shrug and never a fail;
      - it gets harder on replay;
      - it can be played from the pad and inside Double Trouble.
      - Evidence: unit test + e2e.
      _Evidence:_ unit tests (right/wrong taps, tiers 5/15/30, smaller clue + shuffling on replay, always finishes); e2e Double Trouble (played inside the mission at the station pad).
- [x] AC14 Every mission gives 1–3 stars and always ends in a win. After about 3 failed tries, each
      gets easier: the robber runs out of gas, the ducks wait for you, the puppy barks louder.
      Evidence: unit tests.
      _Evidence:_ unit tests: chase out of gas (spec 002), escort "after 3 stops they hurry and stop waiting", find "gets easier after a while". Every mission ends in a win with 1–3 stars (`MissionRun.stars`).
- [x] AC15 The mission board shows each mission's best stars and replays it on tap. Evidence: e2e.
      _Evidence:_ e2e Donut Dash replays from the board; screenshot of the board (stars + padlocks).
- [x] AC16 There are 3 new errands, and they appear after missions. Coins still only come from
      minigames, errands and missions. Evidence: unit test + the economy test.
      _Evidence:_ unit tests "3 new Cop errands, each offered once its mission is done", deliver goes to the destination, and the coin-source test; e2e Rooftop Run (find-rubber-duck offered).
- [x] AC17 Saves made by spec 002 still load. After a reload you keep your badges, owned items and
      stars. Evidence: unit test (migrate) + e2e reload.
      _Evidence:_ unit test "a 002 save … migrates and offers First Day"; e2e "Reload keeps badges, owned items and stars".

### Quality
- [x] AC18 Idle hints (20 s) point to the current goal of every mission. Evidence: unit test that
      every mission goal has a hint target.
      _Evidence:_ unit test "every goal points at something on the map"; each handler has a `hint()`; spec 002 e2e AC9 checks `hint-chief` then `hint-car`.
- [x] AC19 Unit tests cover:
      - steering and arcs;
      - `requires` / unlocks;
      - `spend`;
      - net targeting;
      - the escort follow logic;
      - Who Took It? scoring;
      - save migration.
      _Evidence:_ `tests/unit/cop.test.ts`, `driving.test.ts`, `roads.test.ts` (steering/arcs, requires, spend, net, escort, find, Who Took It?, migration).
- [ ] AC20 At least 55 fps on Pixel 7 emulation with 4× CPU throttle during Double Trouble (two
      robbers). Works with touch on a real Android phone in Chrome (this carries over spec 002's AC12).
      _Evidence so far:_ Pixel 7 + 4× throttle: Double Trouble 81 fps avg (p95 20 ms). **Not yet done: real Android phone with touch.**
- [x] AC21 A playtest note template for 003 is in `docs/playtests/TEMPLATE.md`, updated with this
      spec's question.
      _Evidence:_ `docs/playtests/TEMPLATE.md` has the spec 003 question and table.

## Decisions made while building (agent, 2026-11-10; Chris to review)
Chris chose to build 003–005 straight through, so these were decided without a stop:
1. **Net numbers:** a 70° cone, 5 tiles long, and the net flies at 9 tiles/s and homes in. The
   plan's 2.5 tiles/s could never reach a fleeing car (ADR-005).
2. **Vehicle picker:** the bike is parked next to the car once bought; you tap the one you want,
   instead of using picture buttons.
3. **Siren on foot:** the siren button also works on foot, as a police whistle. It stops traffic
   for the ducks.
4. **Easier steps:**
   - Ducks: after 3 stops they hurry and stop waiting at the kerb.
   - Puppy: after 45 s on one spot, the barks go to full volume.
5. **The chief's offers:** the chief offers missions in order. The first mission is no longer
   started automatically at boot: a voice says "the chief is waiting" and the chief shows a
   flag bubble.
6. **New errands:**
   - `return-socks`, after Double Trouble;
   - `find-rubber-duck`, after Rooftop Run;
   - `deliver-balloon`, after Lost Puppy.
7. **Smudge's getaway car** is teal, so the two brothers' cars look different.

## Decisions (Chris, 2026-11-09)
1. **Car controls.** The bug found in code (holding one direction flips back and forth at corners)
   is what felt wrong. Part A fixes it.
2. **The 6 missions.** The mission stories are approved as written.
3. **Map size.** Downtown grows to its full north-west district.
4. **Net vs. Action.** The Action button turns into the net only when a robber is close.
5. **Spec size.** Keep it as one spec, with play stops at T5 and T17.
6. **Replays.** Replays keep paying the full mission reward.
