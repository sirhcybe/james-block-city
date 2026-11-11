# 004 — Job Center + Firefighter

> Written by the agent on 2026-11-10 from `docs/game-design.md`. Chris chose to have 003–005
> built straight through, so this spec was not reviewed before it was built. Every choice the GDD
> doesn't make is listed under "Decisions made while building", for Chris to check.

## Goal
1. A second job: the Firefighter, with a fire truck, a water hose, six missions, two minigames and
   a kitchen you go inside.
2. A Job Center at City Hall where you switch jobs once you have earned your first badge.

## Depends on
003 — Cop job. Built. The Firefighter reuses the mission director, the boss bubble, the mission
board, the Shop, the badge ceremony and the minigame kit.

## User stories
- As James, once I have my police badge, I go to City Hall, tap the red uniform, and spin into a
  firefighter.
- As James, I drive the big red fire truck with its siren to where the grumpy flames are, and
  spray them until they go "pfft".
- As James, I raise the ladder to rescue a kitten from floor 10.
- As James, I go into a kitchen and put out a toaster that's on fire.
- As James, I play Window Splash and Ladder Rescue to earn coins, and buy the extra-long ladder
  to reach the tallest tower.

## In scope

### A. Job Center
- **The uniform rack.** A picture pad in front of City Hall opens the Job Center: three uniform
  cards (Cop, Firefighter, Builder).
- **When you can switch.** Before your first badge, every card except your current job shows a
  padlock, and a voice says to earn a badge first. A job with no missions yet (the Builder, until
  spec 005) shows a padlock too.
- **Switching** plays a spin and sparkle. Then:
  - the player's outfit changes (blue cap, red helmet, yellow hard hat);
  - that job's boss starts offering missions;
  - that job's vehicle and tool are used.
- The job is saved, and the game starts as Cop for a new player, as today.

### B. Skyscraper Heights (the Firefighter's district)
- It sits south of the Plaza and east of Downtown's south half (tiles 16–31 × 16–31, ADR-005).
- **Roads** join the Plaza (2 roads) and Downtown (2 roads).
- **Buildings:**
  - the fire station, with the fire chief and the fire truck;
  - three skyscrapers, the tallest with a helipad on its roof;
  - a little park strip with a barbecue grill.
- The Fire mission board and two minigame pads stand by the station.

### C. Fire truck and hose
- **The fire truck:** big and red, with a ladder on top. It has a siren and flashing lights, and
  road assist like the police car.
- **The hose** is the Firefighter's tool, on the Action button:
  - the button shows a hose picture whenever a fire is in reach;
  - each press sprays a burst of water at the nearest fire in reach (aim help);
  - fires shrink and go "pfft";
  - nobody is ever trapped in danger.
- **Reach:**
  - on foot, ground fires within 3 tiles;
  - from the truck, fires within 3.5 tiles, up to floor 10 with the standard ladder and floor 14
    with the extra-long ladder (ADR-006).
  - A fire that is too high says so in pictures and voice: a ladder picture, and "you need a
    longer ladder".
- **Easier after about 3 tries:** after 3 bursts on the same fire, every burst puts out twice as
  much, and the fire stops growing back.

### D. Fire missions
- **Rookie** (they earn the Fire badge):
  1. **Siren School:**
     - meet the fire chief and get your helmet;
     - drive the fire truck through 3 flags;
     - press the siren;
     - spray the practice fire at the station.
  2. **Kitty on Floor 10:**
     - drive to the tall yellow tower;
     - park, and the ladder goes up;
     - the kitten slides down to its owner.
  3. **Toaster Trouble:**
     - walk into a house in the Plaza;
     - inside the kitchen, spray the three grumpy little flames (toaster, curtain, pan);
     - the toast pops out.
- **Pro** (need the Fire badge and the extra-long ladder):
  4. **Barbecue Blaze:** spray the three fires around the grill in the park strip.
  5. **Fireworks Fiasco:** a crate of fireworks went off; spray four sparkly window fires on two
     towers (floors 3–6).
  6. **The Tallest Tower:**
     - spray the fire on the top floor (floor 12; needs the extra-long ladder);
     - rescue the parrot from the roof.
- Every mission:
  - gives 1–3 stars and always ends in a win;
  - can be replayed from the Fire mission board;
  - pays its full reward on replays.

### E. Minigames (Fire)
- **Window Splash:**
  - grumpy flames pop up in a tower's windows, whack-a-mole style;
  - tap one to splash it;
  - flames you miss just go "pfft" by themselves.
  - It gets faster on replay.
- **Ladder Rescue:**
  - a cat waits at a window;
  - hold to raise the ladder, and let go at the cat's floor so it slides down;
  - a miss lowers the ladder to try again;
  - the "close enough" window gets wider after 3 misses;
  - the ladder is faster on replay.
- Both are about 2 minutes, pay 5 / 15 / 30 and can't be failed.

### F. Shop, errands, voice, save
- **Shop:** the extra-long ladder for 90 coins. The Shop shows the items for your current job.
- **Errands:** 2 new errands that appear after Fire missions:
  - deliver a cake to the fire chief (Deliver);
  - find a kid's lost balloon in the park strip (Find).
- **Voice:** lines for every intro, hint, rescue and the Fire badge.
- **Save:**
  - the job, the `fire` badge, the `long-ladder` and the `helmet-fire`;
  - the stars;
  - no save version change.

## Out of scope
- The Builder job and Harbor (spec 005).
- The quick-change uniform button on the HUD (needs all three badges; spec 005 at the earliest).
- Hats as Shop items, the apartment.
- Fire that spreads.
- Rooftop helicopter rides.
- Other interiors (only the kitchen).

## Acceptance criteria

### Job Center
- [x] AC1 Before any badge, the Job Center shows padlocks on the other jobs, and switching is not
      possible. After the Cop badge, tapping the Firefighter card switches job (spin + sparkle),
      and it is saved. Evidence: unit test (rules) + e2e.
      _Evidence:_ unit tests "Job Center rules"; e2e "Job Center: locked before a badge…".
- [x] AC2 After a switch:
  - the player's outfit matches the job;
  - the job's boss is the one offering missions;
  - the mission board shows that job's missions;
  - the Shop shows that job's upgrade.
  - Evidence: e2e.
      _Evidence:_ e2e Job Center (fire chief offers Siren School, job saved); unit test (shop shows the long ladder for fire); screenshot of the Job Center and the red outfit.

### Firefighter
- [x] AC3 Skyscraper Heights is on the map:
  - it is reachable by road from the Plaza and from Downtown;
  - the fire station, three skyscrapers and the park strip are there.
  - Evidence: unit tests (roads connect, places reachable) + screenshot.
      _Evidence:_ unit tests "Skyscraper Heights map" (road links both ways, places reachable); screenshots.
- [x] AC4 The fire truck drives with road assist, a siren and lights. Evidence: e2e + screenshot.
      _Evidence:_ e2e Siren School (drive through flags, siren); screenshots of the truck in 8 facings via `?gallery=vehicles`.
- [x] AC5 The hose:
  - puts out a fire in reach with aim help;
  - shows the hose on the Action button only when a fire is in reach;
  - respects height (standard vs. extra-long ladder);
  - gets easier after 3 bursts.
  - Evidence: unit tests of the fire model and reach + e2e.
      _Evidence:_ unit tests "Fire and hose" (bursts, regrow, easier, reach by height/ladder); e2e Siren School (hose aim appears next to the fire) and Fireworks.
- [x] AC6 All 6 Fire missions can be completed from start to finish with no reading. Evidence: one
      e2e flow per mission.
      _Evidence:_ `tests/e2e/fire.spec.ts`, one flow per mission.
- [x] AC7 Finishing the 3 Rookie Fire missions awards the Fire badge with the ceremony, and it is
      saved. Evidence: e2e + unit test.
      _Evidence:_ e2e Toaster Trouble (badges = cop, fire; ceremony voice); unit test (`earnedBadges`).
- [x] AC8 Pro Fire missions stay locked until the Fire badge and the extra-long ladder. Evidence:
      unit test.
      _Evidence:_ unit test "Pro Fire missions need the Fire badge AND the extra-long ladder"; e2e Tallest Tower (no offer without the ladder).
- [x] AC9 Toaster Trouble happens inside a kitchen: a separate scene you walk into from a door,
      and come back out of. Evidence: e2e.
      _Evidence:_ e2e Toaster Trouble (Interior scene runs, HUD hidden, back to the city).
- [x] AC10 Window Splash and Ladder Rescue:
  - each runs as its own scene;
  - each pays 5/15/30 and can't be failed;
  - each gets harder on replay;
  - Ladder Rescue gets easier after misses.
  - Evidence: unit tests + e2e.
      _Evidence:_ unit tests (Window Splash, Ladder Rescue); e2e pads pay 30 and 15.
- [x] AC11 Two new errands appear after Fire missions, and coins still only come from minigames,
      errands and missions. Evidence: unit test.
      _Evidence:_ unit test "2 new Fire errands"; the coin-source test still holds.

### Quality
- [x] AC12 Idle hints point to the current goal of every Fire mission. Evidence: unit test (every
      goal has a target).
      _Evidence:_ unit test "every goal points at something on the map" (Fire); each handler has `hint()`.
- [x] AC13 Spec 003 saves still load, and all spec 003 tests still pass. Evidence: test runs.
      _Evidence:_ all unit tests (150) and the 003 e2e suite pass with 004 in place.
- [x] AC14 At least 55 fps on Pixel 7 emulation with 4× CPU throttle while spraying fires from the
      truck in Skyscraper Heights (the tallest towers on screen). Evidence: `SCENARIO=fire` perf
      record.
      _Evidence:_ fire scenario 77 fps avg on Pixel 7 + 4× (production build).

## Decisions made while building (agent, 2026-11-10; Chris to review)
1. **The Cop is still the first job.** The uniform rack is the Job Center, and it unlocks after
   the first badge. The GDD's "tap a uniform at the start" is left for the finale/polish spec,
   because changing the very first minute again would undo what James has learned.
2. **Hose aim:** the hose auto-aims at the nearest fire in reach. There is no mouse or second-thumb
   aiming, to stay simple for a 6-year-old.
3. **Floors:** the towers are 8, 10 and 13 blocks tall; "floor 10" and "floor 20" in the GDD
   become the top floors of the towers that fit on screen.
4. **Interiors:** one kitchen, as its own scene, entered through a door pad.
5. **Ladder reach:** the standard ladder reaches 10 blocks, not 8, so Kitty on Floor 10 works
   without the Pro upgrade.
6. **Shop:** it shows only your current job's upgrade, so a 6-year-old doesn't buy the wrong one.
