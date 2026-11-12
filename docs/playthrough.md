# Whole-game playthrough and time budget

The GDD aims for a story of **2–4 hours**: 21 missions (about 2 h), plus minigames, errands, the
Shop and decorating (1–2 h). This page has the budget, worked out from the content, and a table
for a grown-up's timed run. The automated playthrough (`tests/e2e/finale.spec.ts`, "the whole game
in one save") proves the game can be finished. It plays all 21 missions in order in one save, with
the debug shortcuts standing in for the driving.

## Budget from the content (spec 007, 2026-11-12)

| Part | Count | Minutes each (6-year-old) | Minutes |
| --- | --- | --- | --- |
| Job missions (Rookie + Pro × 3 jobs) | 18 | 4–7 (walking and driving to places, the goals, the celebration) | 72–126 |
| Finale parts | 3 | 5–8 | 15–24 |
| Minigames inside missions (Traffic Helper, Who Took It?, Cement Pour) | 3 | 1.5–2 | 5–6 |
| Minigames to afford the three Pro upgrades (90 coins each) | about 6–9 | 1.5–2 | 9–18 |
| **Story total** | | | **about 1 h 40 – 2 h 55** |
| Errands (optional, 19 in all, 10 coins each) | 19 | 1–3 | 19–57 |
| Shop and apartment (hats, car, paint, 8 furniture: 545 coins more) | about 15–25 minigames | 1.5–2 | 23–50 |
| **With everything** | | | **about 2 h 20 – 4 h 20** |

**Where the numbers come from:**
- **Coins.**
  - Missions pay 595 coins in all, and errands 190.
  - The three job upgrades cost 270, and the rest of the Shop costs 545.
  - A Pro upgrade is needed after a job's three Rookie missions, which pay 55. So each job needs
    about 35 more coins first: 2–3 minigames.
- **Minigames** last 90–120 s each (`content/minigames.json`) and pay 5/15/30 by tier, about 15 on
  average (`COINS_PER_MINIGAME`).
- **Missions** have bonus-star timers of 45–150 s on their main goal. A child's whole mission,
  with the walk to the boss, the drive, the goal and the celebration, is several times that.

## Timed run by a grown-up (to fill in)

Play from a fresh save. Use the grown-up corner's reset if needed. Write down the clock time after
each milestone.

| Milestone | Clock | Notes |
| --- | --- | --- |
| Cop badge (3 Rookie missions) | | |
| Police bike bought | | |
| Cop Pro missions done | | |
| Fire badge | | |
| Extra-long ladder bought | | |
| Fire Pro missions done | | |
| Builder badge | | |
| Giant mixer drum bought | | |
| Builder Pro missions done | | |
| Finale part 1 / 2 / 3 | | |
| Parade | | |

**James's run:** do the same, and note where he needed help (see `docs/playtests/TEMPLATE.md`).
