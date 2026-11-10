# James's Block City

An isometric, blocky, comic-action city game for a 6-year-old (James) and kids aged 6–7.
Pick a job (Cop, Firefighter, Builder), drive loud vehicles, catch goofy robbers, and earn
coins through minigames and errands. Runs in Chrome on laptops and Android phones.

**Status:** spec 001 (isometric foundation) done: a walkable block plaza. Development is
spec-driven — see `specs/README.md`.

```sh
npm install
npm run dev      # http://localhost:5173  (?gallery = art gallery, ?play = skip the title)
npm test         # unit tests (Vitest)
npm run e2e      # Playwright smoke: desktop Chrome + Pixel 7 (run `npx playwright install chromium` once)
npm run lint
npm run build
```

## Where things are

| Path | What it is |
| --- | --- |
| `AGENTS.md` | Rules for any coding agent working in this repo (read first) |
| `CLAUDE.md` | Points Claude Code at `AGENTS.md` |
| `docs/game-design.md` | The full game design doc (source of truth for *what* the game is) |
| `docs/art-style.md` | Visual and audio rules, palette, block-drawing spec |
| `docs/architecture.md` | Tech stack, folder layout, systems, data schemas |
| `docs/roadmap.md` | All milestones and which spec covers each |
| `docs/decisions/` | Architecture decision records (ADRs) |
| `specs/` | One folder per feature: `spec.md` → `plan.md` → `tasks.md` |

## Next step

Implement `specs/002-vertical-slice`, then playtest with James.
