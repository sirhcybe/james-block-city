# 001 — Isometric Foundation

## Goal
A project skeleton that renders a small stud-free isometric block plaza and lets a little person walk
around it with keyboard, mouse, and touch — fast on an Android phone. This is the riskiest technical
piece, so it comes first.

## User stories
- As James, I can open a link in Chrome and see a bright block city right away, with no words to read.
- As James on the laptop, I can walk my person around with the arrow keys or by clicking where to go.
- As James on the phone, I can walk with my thumb or by tapping where to go.
- As James, when I walk behind a tall building, it fades so I can still see myself.

## In scope
- Vite + TypeScript + Phaser project, lint, unit tests, Playwright smoke, GitHub Pages build.
- Iso math module (grid↔screen, depth) with tests.
- Code-drawn block renderer per `docs/art-style.md` (three faces, bevel, outline, **no studs**), texture cache.
- City Plaza only (~16 × 16 tiles): ground, sidewalks, one road ring, fountain, City Hall, 2 white towers,
  3 small buildings, trees. Hardcoded or JSON layout.
- Player character (code-drawn, 4 facing directions, simple walk bob).
- InputMapper: keyboard (arrows/WASD), mouse click-to-go, mouse click-and-hold steering, touch floating
  joystick + tap-to-go. Screen-relative movement.
- A* pathfinding for go-to; collisions with buildings.
- Depth sorting and occlusion fade.
- Camera follows player with soft lerp; clamped to map.
- Title scene: big Play button (icon only) → City.
- Landscape scaling (1280×720 logical, FIT); "rotate your phone" picture overlay in portrait.

## Out of scope
Vehicles, robbers, HUD buttons other than joystick, coins, missions, audio, saving, other districts.

## Acceptance criteria
- [x] AC1 `npm run dev`, `npm run build`, `npm test`, `npm run lint` all succeed on a clean checkout.
      _Evidence:_ Verified on a fresh `git clone` + `npm ci`: lint clean, 52 unit tests pass, build OK, dev server serves the app.
- [x] AC2 Plaza renders isometrically; every block shows 3 shaded faces and outlines; zero studs/pegs.
      _Evidence:_ `tests/unit/blocks.test.ts` (3 flat faces, nothing above the top face); visual check of `?gallery` and the plaza in Chrome.
- [x] AC3 Arrow keys/WASD move the player in screen directions (up arrow = up the screen).
      _Evidence:_ `tests/unit/input.test.ts` (keys + screenDirToGrid), `tests/unit/player.test.ts` (up = up the screen), e2e "arrow up walks the player up the screen" (desktop + Pixel 7).
- [x] AC4 Clicking or tapping a reachable tile walks the player there along a path around buildings; any
      manual input cancels it.
      _Evidence:_ e2e "click / tap a tile walks there around buildings; manual input cancels" (mouse on desktop, touch tap on Pixel 7); unit tests for PathFinder and path cancel.
- [x] AC5 Touch joystick appears where the left thumb lands, moves the player, disappears on release.
      _Evidence:_ e2e touch-joystick test (CDP touch drag on Pixel 7: joystick active under the thumb, player moves right, hidden on release); InputMapper unit tests; screenshot check.
- [x] AC6 Player never walks through buildings or off the map.
      _Evidence:_ `tests/unit/player.test.ts`: 20,000 random-input frames on the plaza never overlap a building or leave the map; WalkGrid collision tests.
- [x] AC7 Player draws in front of/behind buildings correctly at every position; a building that hides the
      player fades to ~35% and restores when clear.
      _Evidence:_ `tests/unit/occlusion.test.ts`; e2e "walking behind a tower fades it" (alpha < 0.5 behind, restored after); screenshots behind tower-east and house-east.
- [x] AC8 No text is required anywhere to start playing.
      _Evidence:_ Title is a picture + icon-only Play button; e2e asserts empty DOM text and starts the game by pressing the button.
- [x] AC9 Holds ≥ 55 fps in Chrome DevTools with Pixel 7 emulation + 4× CPU throttle while walking.
      _Evidence:_ See tasks.md T16: Pixel 7 emulation + 4× throttle, real GPU, 93 fps uncapped average (10.7 ms/frame). Headed DevTools and a real phone still to spot-check at the 002 playtest.
- [x] AC10 Unit tests cover gridToScreen/screenToGrid round-trip, depth ordering, and screen→grid direction mapping.
      _Evidence:_ `tests/unit/projection.test.ts` (round-trip, depth order) and `tests/unit/input.test.ts` (screen→grid direction).
- [x] AC11 Playwright smoke passes on desktop Chrome and Pixel 7 profiles with no console errors.
      _Evidence:_ `npm run e2e`: 10 passed (2 skipped by design: touch-only tests on desktop) across desktop-chrome and pixel-7, no console errors.

## Open questions
- None blocking.
