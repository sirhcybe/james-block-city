# 001 — Tasks

- [ ] T1 Scaffold Vite + TS (strict) + Phaser 3; add ESLint, Prettier, Vitest, Playwright; npm scripts
      `dev/build/test/lint/e2e`; `vite.config.ts` with `base: './'` for Pages. (verify: AC1)
- [ ] T2 GitHub Actions workflow: lint + test + build, deploy `dist/` to GitHub Pages on `main`.
- [ ] T3 `src/config.ts` with tile sizes, speeds, palette. 
- [ ] T4 `src/iso/projection.ts` + unit tests (round-trip, depth order). (AC10)
- [ ] T5 `src/art/blocks.ts`: drawIsoBlock + texture cache; a dev-only gallery route `?gallery` showing
      sample blocks for visual check. (AC2)
- [ ] T6 `src/content/plaza.json` + zod schema; CityScene renders ground, roads, sidewalks, buildings, trees. (AC2)
- [ ] T7 `src/iso/grid.ts` WalkGrid from plaza data; `src/iso/path.ts` EasyStar wrapper + tests.
- [ ] T8 `src/art/characters.ts` player frames; `src/entities/Player.ts` movement + collision. (AC6)
- [ ] T9 `src/input/InputMapper.ts` keyboard + mouse; `screenDirToGrid` + tests. (AC3, AC10)
- [ ] T10 Click/tap-to-go with path following; manual input cancels. (AC4)
- [ ] T11 `TouchJoystick` in HudScene; ignore emulated mouse from touch. (AC5)
- [ ] T12 Depth sorting for moving sprites; occlusion fade system. (AC7)
- [ ] T13 Camera follow + bounds; portrait "rotate phone" picture overlay.
- [ ] T14 TitleScene with icon-only Play button. (AC8)
- [ ] T15 `window.__jbc` debug hook (dev/test only); Playwright smoke on desktop + Pixel 7. (AC11)
- [ ] T16 Performance check with Pixel 7 emulation + 4× throttle; record fps in this file. (AC9)
- [ ] T17 Tick all ACs in spec.md with evidence; commit.
