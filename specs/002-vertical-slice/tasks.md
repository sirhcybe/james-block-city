# 002 — Tasks

- [x] T1 Extend map with Downtown slice JSON + loader merge.
      (`src/content/downtown-slice.json`, `mergeMaps` + `loadWorld()`; Downtown sits west / screen
      up-left of the Plaza, joined by a road at rows 7–8.)
- [x] T2 `iso/roads.ts` lane graph + `chooseBranch` + tests. (AC2, AC13) — see ADR-003.
- [x] T3 Vehicle base + PoliceCar art (4 dirs, wheels spin, light bar); enter/exit with Action. (AC1)
- [x] T4 Road-assist driving with joystick/keys/tap-to-go along lanes. (AC2) (`entities/LaneDriver.ts`)
- [x] T5 HudScene: Action + Siren buttons, coin counter. Siren sfx + light flash. (AC3)
      Siren key is **Q** (S stays WASD down), decided 2026-11-09.
- [x] T6 `audio/sfx.ts` presets + `audio/voice.ts` with gesture unlock; `content/voice.json` lines.
      (Blips are jsfxr presets; the siren is a two-tone WebAudio oscillator sweep.)
- [x] T7 `systems/economy.ts` (award sources only) + tests. (AC8, AC13)
- [x] T8 `systems/save.ts` SaveV1 + tests; wire coins/missions/errands/minigamePlays. (AC10, AC13)
      (`systems/GameState.ts` wires economy, save, missions, errands and inventory together.)
- [x] T9 Robber + GetawayCar flee AI, wobble, donut drops, bump counter, catch sequence, out-of-gas. (AC4, AC5)
      (`entities/RobberChase.ts` + pure `systems/chase.ts`.)
- [x] T10 `systems/missions.ts` + `content/missions.json` "donut-dash"; stars; tests. (AC5, AC13)
- [x] T11 Pickups + Townsperson bubble + `systems/errands.ts` "return-donuts". (AC6)
- [x] T12 TrafficHelperScene + `content/minigames.json`; scoring tiers + tests; launch from police station marker. (AC7, AC13)
      (Pad marker `traffic-helper` on the sidewalk by the traffic light, next to the police station block.)
- [x] T13 Pedestrians hop away; Bumpable props tumble + reset. (AC11)
- [x] T14 `systems/hints.ts` idle arrow + voice. (AC9)
- [ ] T15 Playwright flow + perf check (Pixel 7, 4× throttle); test on a real Android phone. (AC12)
      Playwright flows and the emulated perf check are done (below). **Still needed: a real Android
      phone in Chrome**, which a human has to do and fits naturally into the playtest.
- [x] T16 `docs/playtests/TEMPLATE.md`. (AC14)
- [ ] T17 Tick all ACs with evidence; commit; tell the human it's ready for James's playtest.
      All ACs are ticked except AC12's real-phone half; committed.

## T15 performance record (2026-11-09)

`node scripts/perf.mjs` against `npm run dev`. It uses installed Chrome with the real GPU (Intel UHD 630,
D3D11), Pixel 7 emulation (915×412 landscape, dpr 2.625, so render scale 1.5) and vsync off, so fps is
uncapped throughput.

| Scenario | CPU throttle | Avg fps | p95 frame |
| --- | --- | --- | --- |
| Chase (driving, siren every second, Pickles fleeing, donuts dropping, pedestrians) | 4× | 84 | 29.6 ms |
| Walk (spec 001 baseline) | 4× | 84 | 22.8 ms |
| Chase | 1× | 169 | 20.5 ms |

- Under 4× throttle, CityScene update averages about 3.2 ms per frame and WebGL render about 3.2 ms.
  Occlusion went from 2.7 ms to 0.75 ms after switching from `getPixelAlpha` to cached per-texture
  alpha masks (`src/art/alphaMask.ts`, built at city load).
- The p95 tail is about 20 ms **even unthrottled at 169 fps**, and a CPU profile shows about 55% of
  time in native "(program)" work, not game JS. It comes from headless Chrome's compositor with vsync
  off, not the game. Only a real phone can settle it.
- Headless swiftshader (used by `npm run e2e`) renders only about 16 fps and Phaser smooths the frame
  time, so the game runs in slow motion there. The e2e tests wait on game state, not wall-clock time.

## Notes for the playtest / next spec
- Replays: every finished Donut Dash pays its 20 coins again, and the donut errand is re-offered
  whenever Pickles drops new donuts (so James can keep earning). Revisit if coins come too easily.
- Pickles "sneaks out again" 12 s after being caught, which restarts the mission.
- Tuning knobs for road-assist feel are in `src/config.ts` (`CAR_MAX_SPEED`, `CAR_ACCEL`,
  `CAR_BRAKE`) and `src/systems/chase.ts` (`DEFAULT_CHASE`).
