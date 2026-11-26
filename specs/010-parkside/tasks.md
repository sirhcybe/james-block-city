# 010 — Tasks

- [ ] T1 Layout: `parkside.json` tiles, roads, buildings, props, walkers, markers; world piece; sea
  grows, south islands move; south-edge trees go (files: `content/*.json`, `content/world.ts`;
  verify: unit world tests, top-down render)
- [ ] T2 New building kinds and art: home, school, playground, icecream, petshop, library, garden;
  mailbox prop (files: `content/schema.ts`, `art/buildings.ts`, `art/props.ts`,
  `scenes/CityScene.ts`; verify: gallery, city screenshots)
- [ ] T3 People: strollers, three townspeople, errands with ball/kite/carrot pictures and voice
  lines, two traffic cars (files: `content/errands.json`, `content/voice.json`, `art/icons.ts`,
  `art/menu.ts`, `art/missionProps.ts`, `scenes/CityScene.ts`; verify: unit, e2e)
- [ ] T4 Tests: unit (AC1–AC3, AC6) and e2e (AC5, drive in) (files: `tests/unit/parkside.test.ts`,
  `tests/e2e/parkside.spec.ts`)
- [ ] T5 Perf and memory, old against new; docs (GDD, architecture, roadmap, ADR-013); full e2e;
  tick ACs
