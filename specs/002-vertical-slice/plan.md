# 002 — Plan

## Approach
Extend 001. Introduce the content-driven systems now (missions, errands, economy, save) so later specs
only add JSON and entities. Minigame is a separate Phaser scene launched with `scene.launch` and
paused City; it emits `minigame:complete {id, score, coins}`.

## Files / modules
- `src/content/downtown-slice.json`, merge into map loader; road lane graph (nodes at lane centers,
  edges along roads, intersections flagged).
- `src/iso/roads.ts` — lane graph + `chooseBranch(inputDir, options)` (unit-tested).
- `src/entities/Vehicle.ts` (base) and `PoliceCar.ts` — follows lane graph, speed, wheel spin, lights.
- `src/entities/Robber.ts`, `GetawayCar.ts` — flee: at intersections pick branch maximizing distance
  from player; wobble tween; drop pickups on a timer; `bumps` counter; `outOfGas()` after N misses.
- `src/entities/Pickup.ts`, `Townsperson.ts` (bubble icon), `Pedestrian.ts` (hop away), `Bumpable.ts`.
- `src/systems/economy.ts` — `award(source: 'minigame'|'errand'|'mission', amount)`; there is
  deliberately no other way to add coins.
- `src/systems/missions.ts` — runs Goal[] from `content/missions.json`; emits progress events.
- `src/systems/errands.ts` — find/deliver/return lifecycle.
- `src/systems/save.ts` — SaveV1, debounced write, version migration stub.
- `src/systems/hints.ts` — idle timer, target from active goal.
- `src/audio/sfx.ts` (jsfxr presets), `src/audio/voice.ts` (speechSynthesis, unlock on first input).
- `src/scenes/minigames/TrafficHelperScene.ts` + `content/minigames.json` tuning.
- `src/scenes/HudScene.ts` — coins, Action, Siren, joystick, hint arrow.
- `docs/playtests/TEMPLATE.md`.

## Risks
- Android audio/speech require a user gesture: unlock on Title's Play tap.
- Road assist feel is the make-or-break: expose speeds/turn rates in `config.ts` for quick tuning.
- Robber AI too fast for a 6-year-old: cap its speed at 80% of police car; rubber-band if far ahead.

## Test approach
Vitest for systems + roads. Playwright: scripted path through Title → car → siren press; assert coins
increase only after minigame/errand completion via `window.__jbc`. Manual: real Android phone.
