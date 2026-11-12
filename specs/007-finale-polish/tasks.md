# 007 — Tasks

> Written 2026-11-12. Built straight through by Chris's choice (no ⏸ stops).

- [x] T1 Finale content, mayor offers, auto job switch, unit tests. (AC1)
      Done: 3 finale missions (`requires` all 18 job missions, then a chain), `finaleOffer`, the mayor's bubble, `forceJob` on begin; finale kept off the job boards; unit tests in `home.test.ts`.
- [x] T2 Helicopter look, altitude and shadow; the Golden Block tower art and site; the stations.
      (AC3, AC4)
      Done: `HELICOPTER` (rotor spins between frames, tail), `RobberLooks.altitude` + shadow + soft landing; `goldentower` art + Plaza site; three glowing station pads.
- [x] T3 Parade: night overlay, convoy, fireworks, play forever. (AC2)
      Done: `CityScene.parade()` (convoy round the Plaza ring, fireworks, cheering), HUD night tint with twinkling lights, `finale-done` saved, morning after 30 s.
- [x] T4 PWA: manifest, icons, service worker, registration, and the offline e2e. (AC5)
      Done: `public/manifest.webmanifest`, `scripts/make-icons.mjs` → `public/icons/*`, Vite plugin writing `sw.js` (precache, `ignoreVary`), `src/pwa.ts`; e2e offline reload.
- [x] T5 Settings model + the grown-up corner (hold to open, levels, unlock, reset) + e2e. (AC6)
      Done: `systems/settings.ts` + tests, `sfx.level`/`voice.level`, `GrownUpScene`, gear hold on the Title; e2e (tap vs hold, levels, unlock, 3 s reset).
- [x] T6 The J key; the automated playthrough; `docs/playthrough.md`. (AC7, AC8, AC9)
      Done: `J` key; `tests/e2e/finale.spec.ts` whole-game playthrough (21 missions, 8.5 min headless); `docs/playthrough.md`.
- [x] T7 Perf `SCENARIO=parade`; docs (ADR-010, architecture, README, roadmap, template); ACs;
      full test run; commit. (AC10)
      Done: `SCENARIO=parade`; ADR-010, architecture, README, roadmap, template. Parade 52–54 fps (walk 61–63 on the same run; that machine measured walk at 89–97 on 2026-11-10/11), so AC10's perf part is left open.