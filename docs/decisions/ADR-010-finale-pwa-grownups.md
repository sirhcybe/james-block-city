# ADR-010: Finale, offline play, and the grown-up corner

**Status:** accepted · 2026-11-12 · spec 007

## Context
Spec 007 finishes the game:
- the three-part Golden Block Heist and a parade;
- installing on a phone and playing with no network;
- a grown-up corner the child can't open by accident.

## Decision
- **The finale is three missions** with tier `finale`, one per job (`finale-tower-fire`,
  `finale-helicopter`, `finale-rebuild`).
  - Part 1 `requires` all 18 job missions, and each later part requires the one before.
  - Job bosses never offer them (`nextMission` skips the finale). The mayor does (`finaleOffer`),
    and the director draws the mayor's bubble while a part is on offer.
  - `begin()` switches the uniform when a mission belongs to another job (`forceJob`), which also
    makes a replay from another job safe.
  - Finale missions are not on the job boards.
- **The helicopter** is a robber vehicle with `altitude`.
  - It drives the car lane graph, drawn high (`hop`), with a shadow on the road. A net or three
    bumps of its shadow catch it, and it lands before the comedy catch.
  - Its rotor turns between the two wheel frames.
- **The parade** runs after `finale-rebuild` (`EV.parade`):
  - the HUD draws a night tint with twinkling windows under its buttons;
  - every job vehicle (and your car) goes round the Plaza ring by tap-to-go corners;
  - fireworks go up.
  - It lasts 30 s, then the day returns. `finale-done` is saved, which also keeps the glowing
    stations on.
- **Glowing stations:** three tinted uniform pads by City Hall. Once the finale is open, stepping
  on one is `forceJob` with a spin. A mission of another job is dropped without penalty (as with
  the Job Center).
- **PWA:**
  - a static `manifest.webmanifest`;
  - PNG icons drawn once by `scripts/make-icons.mjs` and committed;
  - `sw.js`, written by a small Vite plugin, precaches every built file plus `public/`. The cache
    is named by a hash of the file list.
  - The worker answers from the cache with `ignoreVary` (module scripts carry an `Origin` header
    that the precached copies don't) and falls back to the network.
  - It is registered only in production builds.
- **The grown-up corner:**
  - a gear on the title, opened by holding it for 2 s;
  - text labels allowed (it's for adults);
  - levels kept in `jbc.settings`, apart from the save;
  - "unlock everything" grants the badges, the upgrades and all job missions;
  - reset needs a 3 s hold, clears the in-memory save too (the game saves on page unload), and
    reloads.
- **The playthrough:** one e2e test plays all 21 missions in one save with the debug shortcuts,
  and `docs/playthrough.md` has the time budget.

## Consequences
- **A new build always replaces the offline cache.** The first visit after a deploy downloads it.
  The next launch uses it.
- **The parade convoy** moves the parked job vehicles to the Plaza and leaves them there. That is
  harmless, because every vehicle can be found by tapping it or with the hint arrow.
- **Future specs** (for example a playable helicopter) can reuse `altitude`.
