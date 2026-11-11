# 004 — Tasks

> Written 2026-11-10. Chris chose to build 003–005 straight through, so there are no ⏸ stops; the
> next playtest covers it.

## A. Jobs
- [ ] T1 `systems/jobs.ts` + tests (`jobAvailable`, `canSwitch`, outfits, job table);
      `GameState.switchJob`; the shop shelf filtered by job. (AC1, AC2)
- [ ] T2 `JobCenterScene` (uniform cards, padlocks, spin + sparkle) and the City Hall pad; outfit
      swap in the city. e2e: locked before the badge, switch after it, saved. (AC1, AC2)

## B. Skyscraper Heights
- [ ] T3 `content/heights.json`:
  - roads that join the Plaza and Downtown;
  - the fire station, skyscrapers (helipad) and the park strip with the grill;
  - markers and `fires`.
  - `MapDef.fires`, and `mergeMaps` shifting them.
  - Building art: `firestation`, `skyscraper`; the grill prop.
  - Unit tests: connected by road, places reachable, still never off-road. (AC3)

## C. Truck, fires, hose
- [ ] T4 `FIRE_TRUCK` art (8 facings, ladder); the truck parked at the station; the fire job drives
      it. (AC4)
- [ ] T5 `systems/fire.ts` + tests (hp, bursts, regrow, easier, reach by height and ladder,
      `pickFire`); `Fire` entity and `HoseSpray`; the hose on Action; aim help. (AC5)

## D. Fire missions
- [ ] T6 Handlers `spray`, `rescue`, `inside`; goal schema `inside` + events. Fire chief, the Fire
      board pad, voice lines.
- [ ] T7 `InteriorScene` (kitchen). (AC9)
- [ ] T8 Missions content (6) with `requires`; fire badge; long ladder in the shop; 2 errands. Unit
      tests: order, Pro lock, badge, hints, errands. (AC6–AC8, AC11, AC12)
- [ ] T9 e2e: one flow per Fire mission. (AC6, AC7, AC9)

## E. Minigames
- [ ] T10 Window Splash: model + tests + scene + pad. (AC10)
- [ ] T11 Ladder Rescue: model + tests + scene + pad. (AC10)

## F. Wrap-up
- [ ] T12 Perf `SCENARIO=fire`; record it. (AC14)
- [ ] T13 Docs:
  - ADR-006 (jobs and fire);
  - architecture goal union;
  - playtest template;
  - roadmap and README;
  - tick the ACs with evidence;
  - commit. (AC13)
