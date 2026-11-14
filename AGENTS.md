# AGENTS.md — rules for coding agents

You are building **James's Block City**, a browser game for a 6-year-old. Read this file fully
before doing anything, then read the spec you were asked to implement.

## Workflow (spec-driven)

1. Work on exactly one spec folder at a time (`specs/NNN-name/`). Never build beyond its scope.
2. Order inside a spec: `spec.md` (what + acceptance criteria) → `plan.md` (how) → `tasks.md` (steps).
   If `plan.md` or `tasks.md` is missing, write it first and stop for human review.
3. Do tasks in order. Tick each `- [ ]` in `tasks.md` when done and verified.
4. A spec is done only when every acceptance criterion in its `spec.md` is checked off with evidence
   (a test, or a note of how it was verified manually in Chrome desktop + Android-size viewport).
5. If a spec is ambiguous or conflicts with `docs/`, stop and ask. Don't guess on design.
6. Record any significant technical choice as a new ADR in `docs/decisions/`.
7. Commit after each completed task group with a clear message.

## Sources of truth

- What the game is: `docs/game-design.md`
- How it looks/sounds: `docs/art-style.md`
- How it's built: `docs/architecture.md`
- Order of work: `docs/roadmap.md`

## Non-negotiable product rules

- **Player is 6 and can't read.** No UI text is required to play. Use icons, arrows, and voice prompts
  (Web Speech API placeholder until real recordings exist). Numbers (coin count) are fine.
- **No killing, no weapons that hurt, nothing scary.** Slapstick only. See "Comic action rules" in the GDD.
- **You can play the Cop but never the robber.** Cops chase robbers.
- **No fail states in missions or the open city.** No game over, no failing timers. Getting bonked =
  1s dizzy, no coin loss. The one exception (playtest 2026-11-12, spec 008): a **minigame round** has
  hearts, and running out ends it with a friendly "Oops, try again": no coins lost, more hearts on
  the next try. Never add a fail state anywhere else without asking.
- **Coins come only from minigames, errands, and missions.** Never from smashing/bumping things.
- **Art: isometric 2D, smooth flat-topped blocks, NO studs/pegs.** It must not look like a toy-brick brand.
  Don't use LEGO/DUPLO names, logos, or likenesses anywhere in code, assets, or text.
- **Targets: Chrome on laptops (mouse/keyboard) and Chrome on Android phones (touch).** Landscape.
  Hold 60 fps on a mid-range Android phone; touch targets ≥ 64 CSS px.

## Engineering rules

- TypeScript strict mode. Phaser 3 + Vite. No other game engine.
- Game logic that doesn't need rendering (iso math, input mapping, mission/errand state, economy,
  save data) lives in plain TS modules with Vitest unit tests.
- Content (missions, errands, minigame tuning, shop items) is JSON in `src/content/`, validated at
  load with the schemas in `docs/architecture.md`.
- All art is generated in code (see `docs/art-style.md`) unless a spec says otherwise.
- Keep everything playable offline; no external runtime network calls.
- `npm run dev`, `npm run build`, `npm test`, `npm run lint` must all work before a spec is called done.
