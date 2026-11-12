# James's Block City

An isometric, blocky, comic-action city game for a 6-year-old (James) and kids aged 6–7.
Pick a job (Cop, Firefighter, Builder), drive loud vehicles, catch goofy robbers, and earn
coins through minigames and errands. Runs in Chrome on laptops and Android phones.

**Status:** every spec on the roadmap is built (001–007):
- three jobs (Cop, Firefighter, Builder) with 6 missions each, and 7 minigames;
- the Job Center, the Shop, your apartment, and 19 errands;
- four districts, the Golden Block Heist finale and parade;
- installable as an app, and playable offline;
- a grown-up corner (hold the gear on the title for 2 seconds).

Next: playtest with James on a real Android phone, plus a timed playthrough
(`docs/playthrough.md`). Each spec's "Decisions made while building" section lists choices to
review. Development is spec-driven; see `specs/README.md`.

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

Playtest specs 003–007 with James (`docs/playtests/TEMPLATE.md`) on a real Android phone, and time a
full playthrough (`docs/playthrough.md`). Then write new specs from what James enjoys (the roadmap
is complete).
