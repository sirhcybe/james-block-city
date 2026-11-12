# 007 — Plan

- **Finale content:**
  - `missions.json` gets `finale-tower-fire` (fire), `finale-helicopter` (cop) and
    `finale-rebuild` (builder), all with tier `finale`;
  - part 1 `requires` all 18 job missions, and each later part requires the one before;
  - perches `finale-fire-1..3` (on the tallest tower) and `heli-start`;
  - the `golden-tower` build site (kind `goldentower`) in the Plaza, plus `golden-tower-at`;
  - the station markers `station-cop/fire/builder`.
- **Director:**
  - `nextMission` ignores finale missions for the job boss;
  - the mayor offers the next unlocked finale mission (`finaleOffer()`);
  - `begin()` switches the job when the mission's job differs (world `setJob`);
  - finishing `finale-rebuild` emits `EV.parade`.
- **Helicopter:**
  - the `HELICOPTER` vehicle look (a body plus a rotor bar, with the two robbers riding);
  - `RobberLooks.altitude` keeps `car.hop` up while fleeing and lowers it on the catch;
  - a shadow ellipse follows it on the road.
- **Parade** (`CityScene.parade()`):
  - a night overlay in `HudScene` under the buttons;
  - convoy vehicles go round the Plaza ring with `goToward` corners;
  - firework sprites, cheering townspeople;
  - after 30 s the night tint fades out;
  - `owned: finale-done` is saved.
- **Stations:** spots of kind `station` (a glowing uniform pad tinted per job), active once the
  finale unlocks; stepping on one calls `switchJob(force)` and `applyJob`.
- **PWA:**
  - `public/manifest.webmanifest`;
  - `scripts/make-icons.mjs` (Playwright renders an SVG to PNGs, run once, output committed);
  - a Vite plugin in `vite.config.ts` writes `dist/sw.js` with the precache list and build hash;
  - `src/pwa.ts` registers it when `import.meta.env.PROD`.
- **Settings:**
  - `src/systems/settings.ts` (pure: load/save, levels 0/0.5/1, unit-tested);
  - `sfx.setVolume`, `voice.setVolume`;
  - `GrownUpScene` (from the Title gear hold).
- **Playthrough:** `tests/e2e/playthrough.spec.ts` and `docs/playthrough.md`.
- **The J key:** CityScene `keydown-J` opens the Job Center when there are 3 badges.
