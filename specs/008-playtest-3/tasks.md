# 008 — Tasks

- [ ] T1 Stuck firefighter mission: per-job need line, Shop arrow, bought line (files:
  `systems/jobs.ts`, `missions/MissionDirector.ts`, `scenes/CityScene.ts`, `content/voice.json`;
  verify: unit + e2e)
- [ ] T2 Stretch script + bigger district files + `sea.json` + world offsets (files:
  `scripts/stretch-map.mjs`, `content/*.json`, `content/world.ts`, `content/schema.ts`; verify:
  `world.test.ts`)
- [ ] T3 New props (bench, lamp, flowers, buoy, palm, rock) and sea waves (files: `art/props.ts`,
  `art/buildings.ts`, `scenes/CityScene.ts`; verify: screenshots)
- [ ] T4 Objective guide + HUD arrow + flag beams (files: `systems/guide.ts`, `scenes/HudScene.ts`,
  `scenes/CityScene.ts`, `missions/handlers.ts`; verify: `guide.test.ts`, e2e)
- [ ] T5 Boat model, entity, art, boarding (files: `systems/boat.ts`, `entities/Boat.ts`,
  `art/boats.ts`, `scenes/CityScene.ts`; verify: `boat.test.ts`, e2e)
- [ ] T6 Lifeguard + four rescues (files: `content/missions.json`, `systems/missions.ts`,
  `missions/*`; verify: e2e)
- [ ] T7 Build It! model, blueprints, scene, city hook (files: `systems/buildJob.ts`,
  `content/blueprints.json`, `scenes/BuildItScene.ts`; verify: `buildJob.test.ts`, e2e)
- [ ] T8 Minigame kit: top bar, levels, hearts, Oops/retry; all seven scenes (files:
  `systems/round.ts`, `scenes/minigameKit.ts`, minigame scenes and models; verify: unit + e2e)
- [ ] T9 Title screen (files: `scenes/TitleScene.ts`; verify: smoke e2e, screenshot)
- [ ] T10 Docs: GDD, AGENTS rule, architecture, ADR-011, roadmap, playtest template; full e2e;
  tick ACs
