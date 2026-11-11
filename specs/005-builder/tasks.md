# 005 — Tasks

> Written 2026-11-11. Built straight through by Chris's choice (no ⏸ stops).

- [x] T1 `harbor.json`, road links, building kinds and art, `site` flag; map unit tests. (AC1)
      Done: `content/harbor.json` at (32,0), road links to the Plaza and Heights, `wall`/`dock`/`lighthouse`/`boatshop`/`bridge`/`office`/`crane` art, `site` flag; unit tests.
- [x] T2 `systems/build.ts` + tests; `BuildSite` entity; the blaster on Action; built sites are
      saved and redrawn; the walk grid is rebuilt when something is built. (AC3, AC6)
      Done: `systems/build.ts` + tests, `entities/BuildSite.ts`, blaster on Action, `built:<id>` saved and redrawn, walk grid refreshed (ADR-007).
- [x] T3 `MIXER_TRUCK` + horn; the foreman, Builder board and pads. (AC2)
      Done: `MIXER_TRUCK` (striped drum) + horn; foreman, Builder board, three pads.
- [x] T4 `BuildHandler`; 6 Builder missions; badge; giant drum; 2 errands; content unit tests.
      (AC4, AC5, AC9, AC10)
      Done: `BuildHandler`; 6 missions; Builder badge; `giant-drum` 90; `find-wrench` + `deliver-pizza`; unit tests.
- [x] T5 Three minigames: models + tests + scenes + pads. (AC7)
      Done: `systems/builderMinigames.ts` + tests; `BlockStackScene`, `CopyBuildScene`, `CementPourScene`.
- [x] T6 HUD quick-change uniform button. (AC8)
      Done: HUD uniform button (top-right) with all three badges, via `OPEN_JOBS_KEY`.
- [x] T7 e2e: builder switch, quick change, one flow per mission, minigames, reload. (AC2–AC8)
      Done: `tests/e2e/builder.spec.ts` (6 tests).
- [x] T8 Perf `SCENARIO=build`; docs:
  - ADR-007;
  - architecture;
  - template;
  - roadmap and README;
  - tick the ACs;
  - commit. (AC11, AC12)
      Done: `SCENARIO=build` 91 fps avg (p95 17 ms) on Pixel 7 + 4× (production build); also fire 88, Double Trouble 85, walk 89. ADR-007, docs, ACs.