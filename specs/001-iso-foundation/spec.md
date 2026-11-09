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
- [ ] AC1 `npm run dev`, `npm run build`, `npm test`, `npm run lint` all succeed on a clean checkout.
- [ ] AC2 Plaza renders isometrically; every block shows 3 shaded faces and outlines; zero studs/pegs.
- [ ] AC3 Arrow keys/WASD move the player in screen directions (up arrow = up the screen).
- [ ] AC4 Clicking or tapping a reachable tile walks the player there along a path around buildings; any
      manual input cancels it.
- [ ] AC5 Touch joystick appears where the left thumb lands, moves the player, disappears on release.
- [ ] AC6 Player never walks through buildings or off the map.
- [ ] AC7 Player draws in front of/behind buildings correctly at every position; a building that hides the
      player fades to ~35% and restores when clear.
- [ ] AC8 No text is required anywhere to start playing.
- [ ] AC9 Holds ≥ 55 fps in Chrome DevTools with Pixel 7 emulation + 4× CPU throttle while walking.
- [ ] AC10 Unit tests cover gridToScreen/screenToGrid round-trip, depth ordering, and screen→grid direction mapping.
- [ ] AC11 Playwright smoke passes on desktop Chrome and Pixel 7 profiles with no console errors.

## Open questions
- None blocking.
