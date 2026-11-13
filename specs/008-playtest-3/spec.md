# 008 — Playtest round 3: bigger city, boats, Build It!, livelier minigames

> Written by the agent on 2026-11-13 from the playtest notes in `docs/playtests/2026-11-12.md`.
> Chris asked for the notes to be addressed straight through, so this spec was not reviewed before
> it was built. The choices the notes don't make are under "Decisions made while building".

## Goal
Fix what the third playtest found: one stuck mission, flat minigames, a cramped map with no
pointers, water you can't use, a dull build mechanic, and a bare title screen.

## Depends on
007 — Finale and polish (built).

## User stories
- As James the firefighter, when the chief needs me to get the long ladder he says **ladder**, an
  arrow takes me to the Shop, and buying it sends me straight back to the chief.
- As James, I can see my score, how close the next star is and how much time is left in every
  minigame, and the games speed up as I get better.
- As James, if I let cars go while a duck is crossing I lose a heart, and if I lose them all I
  get an "oops, try again" (small, friendly, never scary).
- As James, the city has more room, and when I can't find a flag an arrow shows me the way.
- As James, once I've built the dock I can hop in the rescue boat and sail, and the lifeguard has
  rescues for me as a firefighter or a police officer.
- As James the builder, I build by dragging planks, bricks and beams onto a picture and picking
  the hammer, trowel or wrench to fix them.
- As James, the first screen looks like my city.

## In scope

### A. The stuck firefighter mission
- The boss's "you need the upgrade" line names the right thing for each job (bike, ladder, drum).
- While a job is only waiting on its Shop upgrade, the objective arrow points at the Shop.
- Buying the upgrade says "go and see the chief", and the arrow moves to the chief.

### B. Minigames
- **One shared top bar** in every minigame: score with its picture, a **star meter** (the bar
  fills toward the 1/2/3-star marks), a **time bar**, and **hearts** where the game has them.
- **Levels inside a round:** every few points the game levels up (a banner, a jingle) and gets a
  little faster or trickier. Replays still start a bit harder.
- **Streaks:** several right in a row show a streak pop and give a heart back.
- **A small failure state.** Mistakes cost a heart:
  - Traffic Helper ("Ducks Crossing"): turning the light green while someone is still on the
    crossing. The car honks, the duck flaps back to the kerb.
  - Who Took It?: tapping the wrong suspect.
  - Window Splash: a flame that burns all the way down leaves the window sooty.
  - Ladder Rescue: stopping the ladder at the wrong floor.
  - Block Stack: a block that falls off.
  - Cement Pour: overflowing the mould.
  - Copy the Build has no hearts (there is nothing to get wrong, only time).
  When the hearts run out the round stops with **"Oops!"**: a retry button and a back button, no
  coins. The next try has more hearts. Finishing a round always pays at least 5 coins as before.
- Nicer pictures: sky, clouds and hills behind every game; score pops fly off what you scored on.

### C. World and finding your way
- The city is about 50% bigger in tiles: wider blocks with room around every building, more sea
  to the east and south, small islands. New street furniture (benches, lamps, flower beds).
- **Objective arrows.** During a mission, if the player isn't getting closer to the objective for
  a few seconds, an arrow appears: above the target when it's on screen, on the screen edge
  pointing the way when it isn't. It stays until the player gets there. Flags also get a tall
  glowing beam so they can be seen from far away.
- The 20-second idle hint (arrow + voice) stays as it is.

### D. Boats and rescues
- Building the dock (Dock It) moors a **rescue boat** beside it. Any job can hop in from the dock
  and sail anywhere on the sea; it can't leave the water, and you get out at a dock or a shore.
- A **lifeguard** stands by the dock and offers four rescues once the dock is built:
  - Firefighter: **Barge Blaze** (spray the fires on a barge from the boat) and **Castaway Cat**
    (fetch a kitten off the rock island and bring it back).
  - Cop: **Duckling Patrol** (pick up three ducklings on floaties) and **Sailboat Tow** (tow a
    broken sailboat back to the dock).
  - A builder is told to come back as a firefighter or a police officer.
- These rescues are extras: the finale does not need them.

### E. Build It! (Builder)
- Pressing the blaster at a build spot opens **Build It!**: a picture of the thing with empty
  slots, and a tray of materials.
  - Drag each piece (wood plank, brick, steel beam) onto a slot of the same material.
  - Then pick the fastener: **hammer** for wood, **trowel** for bricks, **wrench** for steel.
  - A wrong slot or tool is a boing and a wobble, and after two wrong tools the right one glows.
  - A bar of pieces shows how far along you are. When every piece is fixed, the building pops up
    in the city.
- Leaving part-way keeps the build spot waiting; nothing is lost.
- The giant mixer drum makes pieces snap from further away.

### F. Home screen
- A lively title: block letters, sky with drifting clouds, the skyline, the three heroes, the
  police car, fire truck and mixer driving past, the sea with the boat, the Play button in the
  same place, and the badges earned so far.

### G. Across the board
- Sea with moving waves; boats, buoys, islands; brighter ground details.
- Flags, pads and pickups bob and glow.

## Out of scope
- Robber chases on water, fishing, a boat shop that sells boats.
- New jobs, new districts, music.
- Real voice recordings.

## Acceptance criteria
- [ ] AC1 A firefighter with the badge and no long ladder hears the ladder line, the arrow points
  at the Shop, and after buying the ladder the fire chief offers Barbecue Blaze.
- [ ] AC2 Every minigame shows score, star meter and time bar; six have hearts.
- [ ] AC3 Traffic Helper: green while a walker is crossing costs a heart; no hearts = Oops with
  retry, no coins; retry has more hearts.
- [ ] AC4 The merged world is ≥ 45% bigger in tiles than 48 × 32, every marker a mission uses is
  reachable, and every job vehicle starts on a road.
- [ ] AC5 The objective arrow appears when no progress is made for 5 s during a mission and goes
  away at the target.
- [ ] AC6 After the dock is built the boat can be boarded from the dock, sails on water only, and
  can be left at the dock.
- [ ] AC7 The four rescues can be played to the end as fire and cop.
- [ ] AC8 Build goals are finished by Build It!, by drag-and-drop and by the test hook.
- [ ] AC9 The title shows the new art and Play still starts the game.
- [ ] AC10 `npm run build`, `npm test`, `npm run lint` pass; the e2e suite passes on desktop and
  Pixel 7 emulation.

## Decisions made while building
- **"Small failure state" versus the "no fail states" rule.** Chris asked for it, so the rule is
  now: *missions and the open city never fail; a minigame round can end in a friendly "Oops, try
  again" with no coin loss.* `AGENTS.md` and the GDD say so.
- **"Ducks Crossing"** was read as the Traffic Helper minigame (ducks cross at the light). The
  Duck Crossing mission is unchanged apart from the arrows.
- **The map** is stretched by a script (`scripts/stretch-map.mjs`), not redrawn by hand: it
  widens blocks and leaves roads two tiles wide, so every landmark keeps its neighbours.
- **The boat steers freely** (not on lanes): open water has no roads to snap to.
- **Rescues come from a lifeguard**, not the job bosses, so the bosses' "all done" logic and the
  finale's list don't change.
