# 004 — Tasks

> Written 2026-11-10. Chris chose to build 003–005 straight through, so there are no ⏸ stops; the
> next playtest covers it.

## A. Jobs
- [x] T1 `systems/jobs.ts` + tests (`jobAvailable`, `canSwitch`, outfits, job table);
      `GameState.switchJob`; the shop shelf filtered by job. (AC1, AC2)
      Done: `systems/jobs.ts` (JOBS table, `uniformState`, `outfitFor`), `GameState.switchJob`, shop shelf by job; tests in `fire.test.ts`.
- [x] T2 `JobCenterScene` (uniform cards, padlocks, spin + sparkle) and the City Hall pad; outfit
      swap in the city. e2e: locked before the badge, switch after it, saved. (AC1, AC2)
      Done: `JobCenterScene` + `job-center` pad at City Hall; spin + sparkle, outfit swap, voice. e2e Job Center.

## B. Skyscraper Heights
- [x] T3 `content/heights.json`:
  - roads that join the Plaza and Downtown;
  - the fire station, skyscrapers (helipad) and the park strip with the grill;
  - markers and `fires`.
  - `MapDef.fires`, and `mergeMaps` shifting them.
  - Building art: `firestation`, `skyscraper`; the grill prop.
  - Unit tests: connected by road, places reachable, still never off-road. (AC3)
      Done: `content/heights.json` at (16,16), `MapDef.perches`, `firestation`/`skyscraper` art (helipad on the tallest), grill prop; tests: road links both ways, places reachable; the driving tests still pass on the bigger map.

## C. Truck, fires, hose
- [x] T4 `FIRE_TRUCK` art (8 facings, ladder); the truck parked at the station; the fire job drives
      it. (AC4)
      Done: `FIRE_TRUCK` (cabin in front, ladder rails + rungs, light bar on the cabin); parked at the station; the fire job hops into it.
- [x] T5 `systems/fire.ts` + tests (hp, bursts, regrow, easier, reach by height and ladder,
      `pickFire`); `Fire` entity and `HoseSpray`; the hose on Action; aim help. (AC5)
      Done: `systems/fire.ts` + tests; `entities/Fire.ts` (flicker, shrinks, pfft); droplet spray; hose on Action only with a fire in reach; "too high" voice. Ladder reach 10 / 14 (ADR-006).

## D. Fire missions
- [x] T6 Handlers `spray`, `rescue`, `inside`; goal schema `inside` + events. Fire chief, the Fire
      board pad, voice lines.
      Done: `SprayHandler`, `RescueHandler`, `InsideHandler`; `inside` goal; fire chief and the Fire board; voice lines.
- [x] T7 `InteriorScene` (kitchen). (AC9)
      Done: `scenes/InteriorScene.ts` (kitchen, 3 flames × 2 sprays, toast pops). e2e Toaster Trouble.
- [x] T8 Missions content (6) with `requires`; fire badge; long ladder in the shop; 2 errands. Unit
      tests: order, Pro lock, badge, hints, errands. (AC6–AC8, AC11, AC12)
      Done: 6 Fire missions, Fire badge, `long-ladder` 90, `deliver-cake` + `find-balloon`; unit tests.
- [x] T9 e2e: one flow per Fire mission. (AC6, AC7, AC9)
      Done: `tests/e2e/fire.spec.ts` (Siren School, Kitty, Toaster, Barbecue + Fireworks, Tallest Tower).

## E. Minigames
- [x] T10 Window Splash: model + tests + scene + pad. (AC10)
      Done: `WindowSplashModel` + tests, `WindowSplashScene`, pad. e2e pays by tier.
- [x] T11 Ladder Rescue: model + tests + scene + pad. (AC10)
      Done: `LadderRescueModel` + tests (easier after 3 misses, faster on replay), `LadderRescueScene`, pad.

## F. Wrap-up
- [x] T12 Perf `SCENARIO=fire`; record it. (AC14)
      Done: `SCENARIO=fire` in `scripts/perf.mjs`. Production build, Pixel 7 + 4×: fire 77 fps avg (p95 29 ms); Double Trouble 72 fps (p95 33 ms).
- [x] T13 Docs:
  - ADR-006 (jobs and fire);
  - architecture goal union;
  - playtest template;
  - roadmap and README;
  - tick the ACs with evidence;
  - commit. (AC13)
      Done: ADR-006, architecture, playtest template, roadmap, README, ACs.