# 003 — Cop Job Complete

> **DRAFT by the agent. Waiting for Chris to review.** The GDD gives only the mission *names*. Each
> mission's content below is a proposal, and the choices to make are listed under Open questions.
> No code is written until this spec, plan.md and tasks.md are approved.

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
- [ ] AC1 Holding any single direction (8 keyboard directions, any stick angle) for 30 s from any
      start never makes the car flip back and forth.
      - Measure: no more than 1 U-turn in a row without a different input in between.
      - Never more than 2 direction changes on the same node within 1 s.
      - Evidence: unit test that sweeps the stick angle × start positions.
- [ ] AC2 At every intersection, the branch closest to the stick *as seen on screen* is taken.
      When the stick sits exactly between two branches and one is straight ahead, the car goes
      straight ahead. Evidence: unit test.
- [ ] AC3 Turns follow a smooth arc and the vehicle never leaves the road, including mid-arc.
      Evidence: the existing 2-minute random-input unit test, extended to the arcs.
- [ ] AC4 Vehicles show 8 facings and U-turns are a 180° spin animation. Evidence: screenshots in
      the gallery and in the city.
- [ ] AC5 A grown-up confirms that driving with keys and with the thumb feels like "it goes where I
      push" (Chris; and James at the next playtest). Evidence: playtest note.

### Cop job
- [ ] AC6 The chief offers the next mission with a picture bubble, and walking up starts it with
      a voice intro. All 6 missions can be completed from start to finish with zero reading.
      Evidence: one e2e flow per mission.
- [ ] AC7 Finishing all 3 Rookie missions awards the Cop badge with a ceremony. The badge is
      saved and shown on the HUD. Evidence: e2e + unit test.
- [ ] AC8 Pro missions stay locked (a padlock picture on the board, and the chief doesn't offer
      them) until the player has both the badge and the police bike. Evidence: unit test of
      `requires`.
- [ ] AC9 The Shop sells the police bike for 90 coins.
      - Buying it can't push coins below 0.
      - Coins only go down by buying.
      - It is saved in `owned`.
      - Evidence: unit test (economy `spend`) + e2e.
- [ ] AC10 The police bike can be driven on roads and park paths, and the car can't use park
      paths. Evidence: unit test on the lane graph.
- [ ] AC11 The net launcher catches a robber from one hit, with big aim help.
      - A miss costs nothing.
      - The Action button shows a net icon only when a robber is in range.
      - Evidence: unit test of the target cone + e2e catch.
- [ ] AC12 After a catch, the robber can be seen in Time-Out Tower. He sneaks out at the start of
      the next robber mission. Evidence: screenshot + e2e state check.
- [ ] AC13 Who Took It?
      - runs as its own scene;
      - pays 5/15/30;
      - a wrong tap gives a shrug and never a fail;
      - it gets harder on replay;
      - it can be played from the pad and inside Double Trouble.
      - Evidence: unit test + e2e.
- [ ] AC14 Every mission gives 1–3 stars and always ends in a win. After about 3 failed tries, each
      gets easier: the robber runs out of gas, the ducks wait for you, the puppy barks louder.
      Evidence: unit tests.
- [ ] AC15 The mission board shows each mission's best stars and replays it on tap. Evidence: e2e.
- [ ] AC16 There are 3 new errands, and they appear after missions. Coins still only come from
      minigames, errands and missions. Evidence: unit test + the economy test.
- [ ] AC17 Saves made by spec 002 still load. After a reload you keep your badges, owned items and
      stars. Evidence: unit test (migrate) + e2e reload.

### Quality
- [ ] AC18 Idle hints (20 s) point to the current goal of every mission. Evidence: unit test that
      every mission goal has a hint target.
- [ ] AC19 Unit tests cover:
      - steering and arcs;
      - `requires` / unlocks;
      - `spend`;
      - net targeting;
      - the escort follow logic;
      - Who Took It? scoring;
      - save migration.
- [ ] AC20 At least 55 fps on Pixel 7 emulation with 4× CPU throttle during Double Trouble (two
      robbers). Works with touch on a real Android phone in Chrome (this carries over spec 002's AC12).
- [ ] AC21 A playtest note template for 003 is in `docs/playtests/TEMPLATE.md`, updated with this
      spec's question.

## Open questions (for Chris)
1. **Car controls.** Is what's described in A what felt wrong? Or was it something else, such as
   too fast, too slow, the camera, tap-to-go, or the thumb stick? Anything specific you noticed
   should go in here.
2. **The 6 missions.** These are my proposals; the GDD only has the names.
   - "Rooftop Run" is on a bike, so I made it a park and alley chase rather than rooftops. Is
     that OK?
   - Are the rest of the plots OK?
3. **Map size.** Should Downtown grow to its full north-west quarter of the 48×48 map now? The
   other districts would stay water and park. Or should the missions fit into a smaller Downtown?
4. **Net vs. Action.** The Action button turns into a net only when a robber is in range.
   Otherwise it is enter/exit as now. Is that OK, or should there be a separate Net button?
5. **Spec size.** This is a big spec, about 30 tasks.
   - Option: split it into 003 (driving fix, net, Rookie missions, badge) and 004 (Shop, bike,
     Pro missions, Who Took It?). That shifts the roadmap numbers.
   - Option: keep it as one spec, but stop for a quick play after part A and after the Rookie
     missions.
6. **Replays.** In 002 each Donut Dash replay paid 20 again. Should replays pay less, for example
   5, so coins can't be farmed?
