# James's Block City

An isometric, blocky, comic-action city game for a 6-year-old (James) and kids aged 6–7.
Pick a job (Cop, Firefighter, Builder), drive loud vehicles, catch goofy robbers, and earn
coins through minigames and errands. Runs in Chrome on laptops and Android phones.

**Status:** specs 003–005 built:
- three jobs (Cop, Firefighter, Builder), each with 6 missions;
- 7 minigames, the Job Center, the Shop, and mission boards;
- four districts (Downtown, City Plaza, Skyscraper Heights, Harbor).

Next: playtest with James on a real Android phone (`docs/playtests/TEMPLATE.md`), then spec 006 (Home
& Shop). Development is spec-driven; see `specs/README.md`.

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

Playtest specs 003–005 with James (`docs/playtests/TEMPLATE.md`), including a real Android phone.
Then write spec 006 from the findings. Each spec's "Decisions made while building" section lists
choices to review.
