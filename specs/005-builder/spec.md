# 005 — Builder

> Written by the agent on 2026-11-11 from `docs/game-design.md`. Chris chose to have 003–005 built
> straight through, so this spec was not reviewed before it was built. The choices the GDD
> doesn't make are listed under "Decisions made while building".

## Goal
The third job: the Builder.
- A cement mixer truck and a block blaster that adds blocks.
- Build spots around the Harbor where new things appear block by block.
- Six missions and three minigames.
- With all three badges, a quick-change uniform button on the HUD.

## Depends on
- 004 — Job Center + Firefighter. Built.
- The Builder reuses the job table, the mission director, the board, the Shop and the minigame kit.

## User stories
- As James, I put on the yellow hard hat, drive the cement mixer, and blast blocks at an empty
  spot until a dock, a boat shop or a lighthouse appears.
- As James, I build a bridge to the tiny island and walk across it.
- As James, I play Block Stack, Copy the Build and Cement Pour to earn coins.
- As James, once I'm a Cop, a Firefighter and a Builder, I tap the uniform button to switch jobs
  anywhere.

## In scope

### A. Harbor district
- **Where:** tiles 32–47 × 0–31 (ADR-005), east of the Plaza and Skyscraper Heights.
- **Land:**
  - roads joining the Plaza (2) and the Heights (2);
  - the construction site (a sandy yard) and the foreman's block;
  - the south block, where the boat shop gets built.
- **The shore:**
  - a boardwalk along the water, with the sea beyond;
  - a tiny island offshore.
- **Build spots** (outlined ghosts until built):
  - a practice wall;
  - the dock;
  - the boat shop;
  - the lighthouse (on the island);
  - the bridge to the island.
- **Built things stay built** (saved). Once the bridge and dock are built, you can walk on them.

### B. Mixer truck and block blaster
- **The cement mixer truck:** yellow, with a striped drum that spins while driving. It has a horn
  instead of a siren (the same button and a different sound), and road assist.
- **The block blaster** (the Builder's tool, on the Action button):
  - when an unbuilt spot in the current mission is in reach, the button shows the blaster;
  - each press flies a block to the spot, and the building grows a little;
  - spots take 6–10 blocks;
  - you can never fail.
- **Reach:** 6 tiles from the truck, 3 tiles on foot.
- **Easier step:** the giant mixer drum (the Pro upgrade) puts 2 blocks in per press.

### C. Builder missions
- **Rookie** (they earn the Builder badge):
  1. **Hard Hat Day:**
     - meet the foreman and get your hard hat;
     - drive the mixer through 3 cones;
     - build the practice wall.
  2. **Dock It:** build the dock, and a little boat sails in.
  3. **Mixer Mayhem:**
     - the cement must get to three places around town (the Plaza, Skyscraper Heights,
       Downtown);
     - then play Cement Pour.
- **Pro** (need the Builder badge and the giant mixer drum):
  4. **Lighthouse Lights:**
     - build the lighthouse on the island from the shore;
     - visit the keeper, and the light comes on.
  5. **Boat Shop:** build the boat shop, then tell the boat owner.
  6. **Bridge to the Island:** build the bridge, then walk across to the island.
- Every mission gives 1–3 stars, always ends in a win, can be replayed from the board, and pays in
  full on replays.

### D. Minigames (Builder)
- **Block Stack:**
  - a block swings on a crane; tap to drop it, and stack as high as you can;
  - a block that misses bounces off, with no penalty;
  - the swing slows down after 3 misses in a row, and is faster on replay.
- **Copy the Build:**
  - copy a small coloured picture by tapping squares, and each tap changes a square's colour;
  - pictures get bigger on replay.
- **Cement Pour:**
  - hold to pour, and let go at the line;
  - you score more the closer you are;
  - every pour scores at least 1;
  - the line moves faster on replay.
- All three are about 2 minutes, pay 5 / 15 / 30 and can't be failed.

### E. Quick change, Shop, errands, voice, save
- **Quick change:** with the Cop, Fire and Builder badges, a uniform button (top-right of the HUD)
  opens the uniform rack from anywhere.
- **Shop:** the giant mixer drum for 90 coins (Builder).
- **Errands:** 2 new errands:
  - find the foreman's lost wrench at the site (after Hard Hat Day);
  - take a pizza from the donut shop to the boat owner (after Boat Shop).
- **Voice:** lines for everything.
- **Save:** `builder` badge, `giant-drum`, `hardhat-builder`, and `built:<spot>` for every built
  thing.

## Out of scope
- Hats and paint in the Shop, the apartment (spec 006).
- The finale (spec 007).
- Building anything other than the five spots.
- Boats you can drive.
- Changing roads when the bridge is built: the bridge is for walking (cars stay on roads).

## Acceptance criteria
- [ ] AC1 The Harbor is on the map, reachable by road from the Plaza and the Heights, with five
      build spots and an island. Evidence: unit tests + screenshot.
- [ ] AC2 Once the player has a badge, the Builder uniform is open in the Job Center. As a Builder,
      the foreman offers missions, and the mixer truck is the job's vehicle. Evidence: e2e.
- [ ] AC3 The block blaster adds blocks to a build spot in reach.
  - The building grows until it is built, and is then saved and stays after a reload.
  - The blaster shows on Action only when a spot is in reach.
  - Evidence: unit tests (build model) + e2e.
- [ ] AC4 All 6 Builder missions can be completed with no reading. Evidence: one e2e flow per
      mission.
- [ ] AC5 The Builder badge (ceremony, saved) comes after the 3 Rookie missions, and Pro needs the
      badge plus the giant drum. Evidence: unit tests + e2e.
- [ ] AC6 After the bridge is built, the player can walk to the island. Evidence: unit test on the
      walk grid + e2e.
- [ ] AC7 Block Stack, Copy the Build and Cement Pour:
  - each runs as its own scene;
  - each pays 5/15/30 and can't be failed;
  - each gets harder on replay.
  - Evidence: unit tests + e2e.
- [ ] AC8 With all three badges, the HUD uniform button opens the Job Center anywhere; without
      them, there is no button. Evidence: e2e.
- [ ] AC9 Two new errands appear after Builder missions, and coins still come only from minigames,
      errands and missions. Evidence: unit test.
- [ ] AC10 Idle hints point at every Builder goal. Evidence: unit test.
- [ ] AC11 Spec 003 and 004 saves and tests still work. Evidence: test runs.
- [ ] AC12 At least 55 fps on Pixel 7 + 4× throttle while building in the Harbor. Evidence:
      `SCENARIO=build` perf record.

## Decisions made while building (agent, 2026-11-11; Chris to review)
1. **Mixer Mayhem** is "deliver cement to three places around town" (checkpoints), then Cement
   Pour. The GDD only gives the name.
2. **The bridge is for walking.** Cars stay on roads, so the lane graph never changes at runtime.
3. **The lighthouse** is built from the shore before the bridge exists (the blaster reaches 6
   tiles from the truck).
4. **The giant drum's effect:** 2 blocks per press. It is the Pro gate, like the bike and the
   ladder.
5. **Horn, not siren:** the mixer truck's siren button plays a horn. Traffic still stops for it,
   as for the siren.
