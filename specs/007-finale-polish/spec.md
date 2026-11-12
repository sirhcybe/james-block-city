# 007 — Finale, polish, PWA, grown-up corner

> Written by the agent on 2026-11-12 from `docs/game-design.md` and the code on `main` plus 006.
> Chris asked for 006 and 007 to be completed straight through, so this spec was not reviewed
> before it was built. The choices the GDD doesn't make are listed under "Decisions made while
> building".

## Goal
Finish the game:
- the three-part **Golden Block Heist** finale, ending in a night-time parade;
- glowing job stations;
- the game installs on a phone and works **offline** (PWA);
- a **grown-up corner** for volume, resetting the save and unlocking everything;
- proof that the whole game can be played from start to end, with a time budget.

## Depends on
006 — Home & Shop (built).

## User stories
- As James, after all 18 missions the mayor needs me. The Bandit Brothers stole the Golden Block!
  - I put out their smoke fires as a firefighter;
  - I chase their helicopter as a cop;
  - I rebuild the Golden Block tower as a builder;
  - then the whole town has a parade with lights and fireworks.
- As James, I step on a glowing uniform pad and I'm a different job right away.
- As a grown-up, I install the game on the phone's home screen, and it works with no internet.
- As a grown-up, I hold the little gear on the title for 2 seconds to change the volume, reset the
  save, or unlock everything.

## In scope

### A. Golden Block Heist (finale)
- **When:** after all 18 job missions are done, the mayor shows a picture bubble (two robbers).
- **The parts.** Three missions with tier `finale`. Each starts by walking up to the mayor, and it
  switches your uniform to the right job with a spin.
  1. **Tower Fire:** the Bandit Brothers lit smoke fires on the tallest tower to cover their
     escape. Spray all three from the fire truck.
  2. **Helicopter Chase:**
     - they fly off in a wobbly little helicopter over the roads;
     - chase it in the police car, and net it (or bump its shadow 3 times);
     - it lands softly, they waddle to the van, and the Golden Block is back.
  3. **Rebuild the Tower:** build the Golden Block tower in the City Plaza with the mixer and
     blaster, then visit the mayor.
- **The parade.** After part 3:
  - night falls (a dark-blue tint with glowing windows);
  - the police car, fire truck, mixer and your own car parade round the Plaza;
  - fireworks go up, and everyone cheers.
  - It lasts about 30 s, then the morning comes back. Nothing has ended: you can **play forever**,
    and every mission can still be replayed from the boards.
- **Glowing job stations:** three uniform pads by City Hall (blue, red, yellow). They appear when
  the finale unlocks. Stepping on one switches job right away, even mid-mission. The mission of
  another job then waits for you, with no penalty.

### B. PWA and offline
- `manifest.webmanifest` gives:
  - the name, landscape orientation, colours;
  - icons at 192, 512 and maskable 512, drawn by a script and committed.
- **A service worker,** generated at build time, precaches every built file. The game then loads
  and plays with no network after the first visit, and a new build replaces the old cache.
- It is only registered in production builds, never in dev.

### C. Grown-up corner
- **Getting in:** a small gear in the corner of the title. Press and hold it for 2 seconds (a ring
  fills up) to open the grown-up corner. A tap does nothing, so a 6-year-old won't get in by
  accident.
- **Inside** (short text labels are allowed, because this page is for grown-ups):
  - **Sound:** off / quiet / loud;
  - **Voice:** off / quiet / loud;
  - **Unlock everything:** all three badges, all three job upgrades, and the finale;
  - **Reset save:** hold for 3 seconds;
  - **Back.**
- Settings live in their own storage key (`jbc.settings`), not in the save, so a reset keeps the
  volume.

### D. The whole game, end to end
- **An automated playthrough** (e2e): one save plays all 21 missions in order using the debug
  shortcuts, ending with the parade. It proves every mission unlocks the next and the game can be
  finished.
- **A time budget** (`docs/playthrough.md`):
  - minutes per mission and minigame, from the content (goal timers, minigame lengths);
  - the GDD target of 2–4 hours;
  - a table for a grown-up's timed playthrough.

### E. Small polish
- The `J` key opens the uniform rack once you have all three badges (GDD controls table).

## Out of scope
- A real helicopter vehicle for the player (the GDD lists it as a later police vehicle).
- Night as a lasting mode (day/night is a parked idea).
- Music.
- Real voice recordings.
- Push notifications.
- App-store packaging.

## Acceptance criteria
- [ ] AC1 The finale is locked until all 18 job missions are done. Then the mayor offers part 1,
      and each part unlocks the next. Evidence: unit tests.
- [ ] AC2 Each finale part switches the player to its job and can be completed with no reading,
      ending in the parade (night, convoy, fireworks), after which play continues. Evidence: e2e.
- [ ] AC3 The helicopter flies over the roads, can be netted, and lands softly to be caught.
      Evidence: e2e + screenshot.
- [ ] AC4 The glowing job stations switch the job right away (once the finale is unlocked).
      Evidence: e2e.
- [ ] AC5 The production build has a valid manifest with 192/512/maskable icons and a service
      worker. After one visit, the game reloads and starts with the network off. Evidence: e2e
      (offline reload) + manifest unit test.
- [ ] AC6 The grown-up corner:
  - opens only after a 2-second hold;
  - sound and voice levels work and survive a reload;
  - "unlock everything" opens all jobs, upgrades and the finale;
  - reset needs a 3-second hold and starts a fresh save.
  - Evidence: e2e + unit tests (settings).
- [ ] AC7 One automated playthrough completes all 21 missions in one save, in order. Evidence: e2e.
- [ ] AC8 A time budget for the whole game is written down, with a table for a grown-up's timed
      run. Evidence: `docs/playthrough.md`. A real timed run is for Chris and James at the
      playtest.
- [ ] AC9 The `J` key opens the Job Center with all three badges, and not before. Evidence: e2e.
- [ ] AC10 All unit and e2e tests pass, lint and build are clean, and the parade holds ≥ 55 fps on
      Pixel 7 + 4× (`SCENARIO=parade`). Evidence: test runs + perf record.

## Decisions made while building (agent, 2026-11-12; Chris to review)
1. **"All 3 Pro badges"** means all 18 job missions done. There are no separate Pro badges, so the
   HUD stays three badges.
2. **The finale is three missions** (one per job). Each switches your uniform automatically, so a
   6-year-old never has to work out which job comes next. The glowing stations are there for
   switching by choice.
3. **The helicopter** is the robbers' getaway vehicle. It flies along the roads at a fixed height,
   which keeps the chase on road assist.
4. **The grown-up corner** is on the title screen only.
5. **Night** lasts only during the parade.
