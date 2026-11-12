# 006 — Plan

- **Save:**
  - `SaveV2` adds `hat: string | null` and `paint: string | null`;
  - `migrate()` turns v1 into v2;
  - `defaultSave()` is v2.
- **Apartment model:** `src/systems/apartment.ts` (pure) has the 6×4 grid, `place`, `move`,
  `remove`, `free`, `fromSave`/`toSave`, and unit tests.
- **Shop:**
  - `ShopItem` gains `tab: 'job' | 'hats' | 'car' | 'home'`;
  - `requires` accepts `badge:any`;
  - `GameState` gets `wear(hat)` and `applyPaint(paint)`.
  - `ShopScene` gets picture tabs and a 4 × 2 grid of cards; tap a card to buy or wear.
- **Looks:**
  - characters get the hats `pirate` and `duck` (chef already exists);
  - `lookFor(job, owned, hat)` gives a composite look name such as `playerFire+pirate`, baked on
    demand (`ensureLook`).
- **Own car:**
  - the `OWN_CAR` look, baked in 5 paints at boot (`own-car`, `own-car-red`, …);
  - `VehicleId` adds `own-car`, which is in every job's vehicle list;
  - it spawns at the `own-car` marker when owned.
- **Apartment:**
  - `house-east` becomes kind `apartment` (house art plus a heart sign);
  - `home-door` marker and door pad;
  - `ApartmentScene` (drag and drop with Phaser input; the tray; the hat stand; the back arrow).
- **Errands:**
  - `Errand.voice?` (the offer line);
  - errands with no `after` and not a Return are offered at start;
  - 11 new errands, 5 new townspeople with markers and spots;
  - new icons (teddy, flower, ice cream, letter, fish, book, present, apple, shell; furniture;
    hats; car).
- **Tests:**
  - unit: apartment, save migration, shop tabs and prices, looks, errand count and reachability;
  - e2e: apartment drag and reload, hat, own car and paint, shop tabs.
