# 001 — Tasks

- [x] T1 Scaffold Vite + TS (strict) + Phaser 3; add ESLint, Prettier, Vitest, Playwright; npm scripts
      `dev/build/test/lint/e2e`; `vite.config.ts` with `base: './'` for Pages. (verify: AC1)
- [x] T2 GitHub Actions workflow: lint + test + build, deploy `dist/` to GitHub Pages on `main`.
      (`.github/workflows/ci.yml`; also runs the Playwright smoke. Pages must be set to "GitHub Actions"
      in the repo settings.)
- [x] T3 `src/config.ts` with tile sizes, speeds, palette.
- [x] T4 `src/iso/projection.ts` + unit tests (round-trip, depth order). (AC10)
- [x] T5 `src/art/blocks.ts`: drawIsoBlock + texture cache; a dev-only gallery route `?gallery` showing
      sample blocks for visual check. (AC2)
- [x] T6 `src/content/plaza.json` + zod schema; CityScene renders ground, roads, sidewalks, buildings, trees. (AC2)
- [x] T7 `src/iso/grid.ts` WalkGrid from plaza data; `src/iso/path.ts` EasyStar wrapper + tests.
- [x] T8 `src/art/characters.ts` player frames; `src/entities/Player.ts` movement + collision. (AC6)
- [x] T9 `src/input/InputMapper.ts` keyboard + mouse; `screenDirToGrid` + tests. (AC3, AC10)
- [x] T10 Click/tap-to-go with path following; manual input cancels. (AC4)
- [x] T11 `TouchJoystick` in HudScene; ignore emulated mouse from touch. (AC5)
- [x] T12 Depth sorting for moving sprites; occlusion fade system. (AC7)
- [x] T13 Camera follow + bounds; portrait "rotate phone" picture overlay.
- [x] T14 TitleScene with icon-only Play button. (AC8)
- [x] T15 `window.__jbc` debug hook (dev/test only); Playwright smoke on desktop + Pixel 7. (AC11)
- [x] T16 Performance check with Pixel 7 emulation + 4× throttle; record fps in this file. (AC9)
- [x] T17 Tick all ACs in spec.md with evidence; commit.

## T16 performance record (2026-11-09)

`node scripts/perf.mjs` against `npm run dev`. It uses installed Chrome with the real GPU (Intel UHD 630,
D3D11), Pixel 7 emulation (915×412 landscape, dpr 2.625, so render scale 1.5) and walks in six
directions for 12 s, including behind both towers.

| CPU throttle | Avg fps (uncapped) | p95 frame |
| --- | --- | --- |
| 1× | 204 | 20.4 ms |
| 4× | 93 | 18.2 ms |

Headless Chrome paces frames at about 33 fps with or without throttling, so these numbers are taken
with vsync and the frame-rate limit disabled. At 4× throttle the average frame takes about 10.7 ms,
well inside the 16.7 ms budget for 60 fps. A manual DevTools check on a headed Chrome and a real
Android phone are still worth doing during the 002 playtest.

## Notes for later specs
- **Key conflict:** the GDD maps Siren to `S`, but `S` is also WASD "down". Spec 002 needs a
  decision (e.g. siren on `Q`/`E` or Shift).
- Tapping a spot where a building is drawn on top walks to that building, as the GDD says
  ("tap ground/building"). Low things such as the fountain rim never capture a tap on walkable ground.
