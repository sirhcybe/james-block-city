# 006 — Home & Shop

> Written by the agent on 2026-11-12 from `docs/game-design.md` and the code on `main` (specs
> 001–005 and the 2026-11-11 polish round). Chris asked for 006 and 007 to be completed straight
> through, so this spec was not reviewed before it was built. The choices the GDD doesn't make are
> listed under "Decisions made while building".

## Goal
Somewhere to spend coins on things you can see:
- your own apartment in the City Plaza, to decorate;
- a bigger, picture-only Shop: hats, your own car and its paint, and furniture;
- enough errands around the city (about 20) that there's always someone to help.

## Depends on
005 — Builder (built), plus the 2026-11-11 polish round.

## User stories
- As James, I walk into my apartment, drag the bed and the fish tank where I want them, and they
  are still there next time.
- As James, I buy a pirate hat and wear it in any job.
- As James, I buy my own car, paint it pink, and drive it as a cop, a firefighter or a builder.
- As James, I see picture bubbles all over town and help people for coins.

## In scope

### A. The apartment
- **Where:** the house on the east side of the Plaza becomes "your apartment". It has a heart over
  the door and a door pad.
- **Inside** (its own scene, like the kitchen):
  - a room with a 6×4 floor grid;
  - a tray along the bottom with the furniture you own but haven't placed;
  - a hat stand.
- **Furniture:**
  - drag an item from the tray onto the floor and it snaps to a square;
  - drag a placed item to move it, or back to the tray to put it away;
  - one item per square;
  - it is saved (`apartment` in the save) and comes back exactly the same after a reload.
- **Hat stand:** tap a hat you own to wear it, and tap it again to go back to your uniform's hat.
- **Leaving:** the blue back arrow (and Esc), like every other scene.

### B. The Shop, grown
- **Tabs:** four picture tabs across the top:
  - the job upgrade (a star, as today);
  - hats;
  - car and paint;
  - furniture.
- **Cards:** tap a card to buy it. The price is a number with a coin.
  - Too few coins gives the same "not yet" wobble and picture count of minigames as today.
  - Tapping an owned hat or paint card wears or applies it.
- **Prices** are at most about three minigames (≤ 90), as the GDD asks:
  - **Hats:** chef 30, pirate 45, duck 60.
  - **Your own car:** 60, after your first badge.
  - **Paint** for it: red, teal, purple, pink; 15 each, once you own the car.
  - **Furniture:** lamp 15, cushions 15, table 20, bed 30, bookshelf 30, TV 45, computer 60, fish
    tank 75.
- **Hats** show on the player in every job and every outfit, and are saved.

### C. Your own car
- A small round family car, parked by the apartment once bought.
- Every job can drive it, with road assist and a horn.
- Paint changes its colour straight away, and the colour is saved.

### D. Errands (~20 in all)
- 11 new errands, for 19 in all, spread over all four districts. There are five new helpers:
  - a florist and a painter in the Plaza;
  - a teacher in Downtown;
  - a chef in Skyscraper Heights;
  - a grandpa at the Harbor.
- **The mix:**
  - **Find** (the lost thing lies somewhere and you bring it back): teddy, fish, kitten, feather,
    apple, shell;
  - **Deliver:** flowers, a book, a letter, a present, an ice cream.
- **When they appear:**
  - three are on offer from the start (an errand with no `after` and not a Return);
  - the rest appear after a mission, in any job.
- Each has its own picture, voice line, and 10 coins.
- Coins still only come from minigames, errands and missions.

### E. Save
- **SaveV2** adds `hat` and `paint`. A v1 save migrates by adding both as `null`.
- Older saves keep everything.

## Out of scope
- Siren and horn sound packs (GDD "vehicles/paint" list).
- A second apartment room, or rotating furniture.
- Drag-to-place outside the apartment.
- Hats for townspeople.
- The finale, PWA and grown-up corner (spec 007).

## Acceptance criteria
- [ ] AC1 The apartment can be entered from its door pad and left with the back arrow (or Esc).
      Evidence: e2e.
- [ ] AC2 Furniture you own can be placed, moved and put away by dragging. It snaps to the grid
      with one item per square, and the layout survives a reload. Evidence: unit tests (layout
      model) + e2e (drag + reload).
- [ ] AC3 The Shop has 4 picture tabs, and every item costs at most 90. Buying can't make coins
      negative, and owned hats and paint can be worn or applied by tapping. Evidence: unit tests +
      e2e.
- [ ] AC4 A worn hat shows in every job's outfit, and it is saved. Evidence: unit test (look
      names) + e2e (reload).
- [ ] AC5 The own car can be bought after the first badge. It is parked by the apartment, every
      job can drive it, and paint recolours it (saved). Evidence: e2e.
- [ ] AC6 There are at least 19 errands, at least 3 on offer from the start, and the rest unlock
      after missions. Every find spot and every giver and receiver is on the map and reachable.
      Evidence: unit tests.
- [ ] AC7 Version 1 saves (specs 002–005) load into SaveV2 with nothing lost. Evidence: unit test.
- [ ] AC8 No words are needed anywhere new, the existing tests pass, and performance holds (walk
      scenario ≥ 55 fps on Pixel 7 + 4×). Evidence: test runs + perf record.

## Decisions made while building (agent, 2026-11-12; Chris to review)
1. **The apartment** is the east house of the Plaza (`house-east`), not a new building.
2. **Hats and paint are chosen** by tapping owned cards in the Shop and the hat stand at home. A
   separate wardrobe screen was not built.
3. **"Own car (after first badge)"** means any badge. It is drivable by every job.
4. **Sound packs** for siren and horn are left out (parked).
5. **19 errands**, not exactly 20. Some givers have two errands; the bubble shows one at a time.
