# 004 — Plan

## A. Jobs
- **`src/systems/jobs.ts`** (pure, unit-tested):
  - `jobAvailable(job, content)`: the job has missions;
  - `canSwitch(save)`: at least one badge;
  - `outfitFor(job)`: `player` / `playerFire` / `playerBuilder` looks;
  - `JOBS`: the boss marker, vehicle id, tool and colour of each job.
- **`GameState.switchJob(job)`** saves the job. The director's boss and the mission vehicle come
  from the job (`MissionDirector` already looks up `BOSS[job]`).
- **`src/scenes/JobCenterScene.ts`:** three uniform cards with padlocks; a tap switches with a
  spin and sparkle, and the menu closes with `{ job }`.
- **`CityScene`:**
  - a Job Center pad at City Hall (`job-center` marker);
  - on `menuClosed { job }`: swap the player's outfit, refresh the boss bubbles and the HUD tool.

## B. Skyscraper Heights
- **`content/heights.json`** (16×16) is merged at (16, 16). It has:
  - roads joining the Plaza (the Plaza's bottom row opens at x 17–18 and 29–30) and Downtown
    (Downtown's east column opens at y 19–20 and 29–30);
  - the fire station (`firestation` building kind), skyscrapers (`skyscraper` kind, the tallest
    with a helipad), the grill (prop) and trees;
  - markers: `fire-chief`, `fire-truck`, `fire-board`, `window-splash`, `ladder-rescue`, flags,
    fire spots, rescue spots, `kid-heights`, `balloon-spot`.
- **`MapDef` gains `fires: { id, gx, gy, z }[]`**: a fire's place, with z in block units (a floor
  height). `mergeMaps` shifts them like markers.

## C. Fire truck, fires and the hose
- **`src/art/vehicles.ts`:** `FIRE_TRUCK` (long and red, a ladder box on the roof, a light bar).
- **`src/systems/fire.ts`** (pure):
  - `FireState` (hp 0..1; a spray rate; it regrows slowly unless easier; easier after 3 bursts;
    out at hp ≤ 0);
  - `reach(shooter, fire, mode, ladder)`: distance and height rules;
  - `pickFire(...)`: the nearest fire in reach.
- **`src/entities/Fire.ts`:** a grumpy flame sprite at (gx, gy, z). It flickers and scales with
  hp, and puffs "pfft" when it goes out.
- **`src/entities/HoseSpray.ts`:** water droplets drawn from the nozzle (the truck's ladder top, or
  the player's hands) to the fire.
- **`CityScene`:**
  - the HUD Action button shows `hose` when the current job is fire and a fire is in reach;
  - Action starts a 0.7 s burst;
  - fire entities live in a `fires` map; handlers ask the world to light them and put them out.

## D. Missions
- **`missions.json`:** `siren-school`, `kitty-floor-10`, `toaster-trouble` (rookie);
  `barbecue-blaze`, `fireworks-fiasco`, `tallest-tower` (pro, `requires: ["badge:fire",
  "owned:long-ladder"]`).
- **Goal handlers:**
  - `SprayHandler`: light the fires; notify `sprayed` for each one put out; hint at the nearest
    fire, or at the truck when on foot and the fire is high.
  - `RescueHandler`: the truck must be stopped within 2 tiles of `at`. The ladder sprite rises to
    the pet's height (it needs the long ladder if the pet is above standard reach), the pet slides
    down, and then `rescued` is notified.
  - `InsideHandler` (new goal `inside { at, room }`): hint at the door; walking onto it launches
    `InteriorScene`; on return, `insideDone`.
- **`src/scenes/InteriorScene.ts`:** a side-on kitchen with three flames. Tap a flame (or press
  Action) to spray it; two sprays each. The toast pops out, then you leave.

## E. Minigames
- **`src/systems/windowSplash.ts`:** the `WindowSplashModel` (3×3 windows, pop-up timing, score).
  **`src/scenes/WindowSplashScene.ts`** draws it.
- **`src/systems/ladderRescue.ts`:** the `LadderRescueModel` (hold to raise, release to check
  against the cat's floor with a tolerance; the tolerance widens after 3 misses; speed rises with
  plays). **`src/scenes/LadderRescueScene.ts`** draws it.
- Both extend `MinigameScene` (`minigameKit.ts`) and have `minigames.json` entries.

## F. Content, shop, errands, voice
- **`shop.json`:** `long-ladder` 90 (`job: fire`). `GameState.shopShelf()` filters to the current
  job.
- **`errands.json`:**
  - `deliver-cake`: the baker gives a cake to take to the fire chief (after Siren School);
  - `find-balloon`: a kid's balloon is lost in the park strip (after Barbecue Blaze).
- **`voice.json`:** all the new lines.
- **Character looks:** `playerFire`, `playerBuilder`, `fireChief`, `kidHeights`.

## Data and save
- The save is unchanged in shape. `job` now changes. The new owned ids are `helmet-fire` and
  `long-ladder`, and the new badge is `fire`.

## Risks
- **Tall towers:** they mean big textures and heavy occlusion. Keep the footprints 2×2, bake once,
  and run the perf scenario `SCENARIO=fire`.
- **The fire truck is long (1.6 tiles):** check that it stays on the road in curves (the "never
  off-road" driving test, re-run on the bigger map).
- **The map grows to 32×32:** more chunks to bake (4). Check memory on the phone at the playtest.

## Test approach
- **Unit:**
  - jobs rules;
  - fire model and reach;
  - Window Splash and Ladder Rescue models;
  - content (missions, hints, requires);
  - map (Heights connected, places reachable);
  - shop by job;
  - errands after missions.
- **E2E:**
  - Job Center switch (locked, then unlocked);
  - one flow per Fire mission;
  - both minigames from their pads;
  - the kitchen interior.
- **Perf:** `SCENARIO=fire`.
