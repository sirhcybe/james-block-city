# 006 — Tasks

> Written 2026-11-12. Built straight through by Chris's choice (no ⏸ stops).

- [x] T1 SaveV2 + migration; apartment model; shop tabs/`badge:any`; `wear`/`applyPaint`; unit
      tests. (AC2, AC3, AC7)
      Done: `SaveV2` + migrate, `systems/apartment.ts`, Shop `tab` + `badge:any`, `wear`/`applyPaint`/`saveApartment`; `tests/unit/home.test.ts`.
- [x] T2 Icons (errand items, furniture, hats, car), hats on characters, composite looks; own-car
      looks. (AC4, AC5)
      Done: 25 new icons, pirate and duck hats, `lookFor` + `ensureLook` (composite looks baked on demand), `OWN_CARS` in five paints.
- [x] T3 Content:
  - shop items (hats, car, paint, furniture);
  - 11 errands with voice lines;
  - 5 townspeople, markers and spots;
  - the apartment building and door;
  - unit tests (counts, prices, reachability). (AC3, AC6)
      Done: 16 new Shop items, 11 errands with voice lines, florist/painter/teacher/chef/grandpa, `apartment` building + `home-door`.
- [x] T4 `ApartmentScene` (drag and drop, tray, hat stand, back) and the door pad. (AC1, AC2, AC4)
      Done: `ApartmentScene` (drag from the tray, move, drag back; hat stand; back arrow/Esc), door pad.
- [x] T5 `ShopScene` tabs and grid; the own car in the city; job vehicles. (AC3, AC5)
      Done: tabbed `ShopScene` (tap to buy or wear/apply), own car by the apartment for every job, HUD counter shows spending.
- [x] T6 e2e: apartment, hat, car, paint, shop; perf `walk`; docs (ADR-009, architecture,
      template, roadmap, README); tick the ACs; commit. (AC8)
      Done: `tests/e2e/home.spec.ts` (apartment drag + reload, hat across jobs + reload, own car + paint as a firefighter, errands at start); perf walk 66 fps on Pixel 7 + 4× (main measured the same 66 on the same machine that day); ADR-009, docs.