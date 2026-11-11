# 005 — Plan

## A. Harbor
- **`content/harbor.json`** (16×32) is merged at (32, 0). The Plaza's east column opens at y 1–2
  and 13–14; the Heights' east column opens at local y 3–4 and 13–14.
- **New building kinds:** `wall`, `dock`, `lighthouse`, `boatshop`, `bridge`, `office`.
  `BuildingDef.site: true` marks a build spot: it is not drawn or blocking until built.
- **Markers:**
  - `foreman`, `mixer-truck`, `builder-board`;
  - pads `block-stack`, `copy-the-build`, `cement-pour`;
  - flags `bflag-1..3`;
  - `<spot>-at` parking places;
  - `island`, `boat-owner`, `keeper`, `wrench-spot`.
  - Pour spots `pour-1..3` go in the Plaza, Heights and Downtown files.

## B. Building
- **`src/systems/build.ts`** (pure):
  - `SiteState` (blocks needed and added, `add(n)`, `built`);
  - `blastReach(from, mode, site)`: 6 tiles from the truck, 3 on foot;
  - `pickSite(...)`.
- **`src/entities/BuildSite.ts`:** the building image shown as a tinted ghost during the goal. It
  grows with progress (alpha and a vertical squash), and a block flies in for every press.
- **`CityScene`:**
  - the blaster on Action when `job === 'builder'` and a site in reach is active;
  - built sites are drawn at load from `owned: built:*`;
  - the walk grid is rebuilt when something is built (the bridge and dock make water tiles
    walkable; the others block their footprint).
- **`BuildHandler`** (`build { spot }`): activates the site, hints at its parking place or at the
  truck, and notifies `built`.

## C. Mixer truck
- `MIXER_TRUCK` look (body, cabin in front, striped drum).
- The siren button plays a horn while riding it.

## D. Content
- Missions: `hard-hat-day`, `dock-it`, `mixer-mayhem` (rookie); `lighthouse-lights`,
  `boat-shop`, `bridge-to-the-island` (pro, `requires: ["badge:builder", "owned:giant-drum"]`).
- Shop: `giant-drum` 90.
- Errands: `find-wrench`, `deliver-pizza`.
- Voice lines.

## E. Minigames
- **`src/systems/builderMinigames.ts`:** `BlockStackModel`, `CopyBuildModel`, `CementPourModel`,
  with tests.
- **Scenes:** `BlockStackScene`, `CopyBuildScene`, `CementPourScene` (all `MinigameScene`).

## F. Quick change
- The HUD shows a uniform button (top-right) when the player has all 3 badges. A tap opens the
  Job Center through `CityScene.openMenu('JobCenter')`.

## Tests
- **Unit:** the build model and reach; the minigame models; content (order, requires, hints);
  the map (connected, sites, island reachable only after the bridge).
- **E2E:** Builder job switch + quick-change button; one flow per mission; the three minigames;
  built things surviving a reload.
- **Perf:** `SCENARIO=build`.
