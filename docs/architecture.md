# Architecture

## Stack
Phaser 3, TypeScript (strict), Vite, Vitest, Playwright, ESLint + Prettier. See ADR-001.

## Folder layout (target)
```
src/
  main.ts                 # Phaser game config, scale, scenes
  config.ts               # constants: tile size, speeds, palette import
  iso/                    # pure TS: projection, depth, grid, pathfinding wrapper  (unit-tested)
  input/                  # InputMapper: keyboard/mouse/touch -> GameActions          (unit-tested)
  art/                    # drawIsoBlock, character/vehicle builders, texture cache
  audio/                  # sfx presets, Voice (speechSynthesis wrapper), music
  scenes/
    BootScene.ts          # generate textures, load content JSON
    TitleScene.ts         # picture menu (no text required)
    CityScene.ts          # the isometric world
    HudScene.ts           # overlay: coins, buttons, joystick, hints
    minigames/            # one scene per minigame, launched over CityScene
  entities/               # Player, Vehicle, Robber, Townsperson, Bumpable, Fire, BuildSpot
  missions/               # MissionDirector + one GoalHandler per goal type (ADR-005)
  systems/                # pure-ish TS state + logic                                 (unit-tested)
    economy.ts            # coins, rewards, shop purchases
    jobs.ts               # JOBS table (boss, vehicle, tool, outfit), switching rules (ADR-006)
    missions.ts           # mission state machine driven by JSON goals
    errands.ts            # errand lifecycle
    save.ts               # versioned localStorage save
    hints.ts              # idle detection -> arrow + voice hint
  content/                # JSON: map, missions, errands, minigames, shop, voice lines
tests/
  unit/                   # Vitest
  e2e/                    # Playwright smoke (desktop Chrome + Pixel 7 emulation)
```

## Core concepts

### Isometric projection (`src/iso/`)
- Grid coords `(gx, gy)` in tiles, `gz` in height units. Tile 64×32.
- `gridToScreen(gx, gy, gz) = { x: (gx - gy) * 32, y: (gx + gy) * 16 - gz * 32 }`
- `screenToGrid` is the inverse (gz = 0).
- Depth: `depth = (gx + gy) * 100 + gz` (plus small per-entity offsets). Recompute for moving sprites
  every frame. Multi-tile buildings sort by their front-most (max gx+gy) tile.
- Occlusion fade: if a building's screen bounds overlap the player and its depth is greater than the
  player's, tween its alpha to 0.35.

### Input (`src/input/`)
All devices map to one `GameActions` object read once per frame:
```ts
interface GameActions {
  move: { x: number; y: number };   // screen-relative, length 0..1
  goTo: { gx: number; gy: number } | null; // tap/click destination (one frame)
  action: boolean;                  // pressed this frame
  siren: boolean;                   // held
  aim: { x: number; y: number } | null; // screen point
  switchJob: boolean;
}
```
`screenDirToGrid(move)` rotates the screen vector by the iso transform so "up" moves up the screen.
Touch: floating joystick on the left half (appears where the thumb lands); buttons ≥ 64 CSS px.

### Movement
- On foot: free movement on walkable tiles, collision with buildings.
- Vehicles: **road assist** — the vehicle snaps to the nearest lane centerline and only chooses
  direction at intersections; joystick picks the branch closest to the input direction *as seen on
  screen*, rounding corners with short curves (ADR-003, ADR-004).
- `goTo`: A* (EasyStar.js) over the walk/road grid; follow the path; any manual input cancels it.

### Content-driven systems
Missions, errands, minigame tuning and shop items are JSON, validated at load (zod).

```ts
// content/missions.json  (zod: src/systems/missions.ts; ADR-005)
type Goal =
  | { type: 'goTo'; target: string }                 // named map marker, or a vehicle id
  | { type: 'catch'; robbers: { id: string; vehicle: 'car' | 'scooter'; start: string; drops?: string }[]; bumps: number }
  | { type: 'checkpoints'; flags: string[] }         // drive through every flag (any order)
  | { type: 'siren' }                                // press the siren while driving
  | { type: 'escort'; group: string; from: string; to: string } // lead the ducks
  | { type: 'find'; item: string; spots: string[] }  // follow barks; it's in the last spot
  | { type: 'minigame'; id: string }
  | { type: 'errand'; id: string }
  | { type: 'build'; spot: string }                 // blast blocks at a build spot (ADR-007)
  | { type: 'spray'; fires: string[] }
  | { type: 'rescue'; pet: string; at: string; perch: string } // ladder up to a perch
  | { type: 'inside'; at: string; room: string };   // walk in through a door to a room scene
interface Mission {
  id: string; job: 'cop' | 'fire' | 'builder'; tier: 'rookie' | 'pro' | 'finale';
  icon: string;                  // picture on the boss's bubble and the mission board
  voiceIntro: string; voiceDone: string; // voice line ids
  goals: Goal[];                 // in order
  reward: { coins: number; unlocks?: string[] };
  requires?: string[];           // mission ids / 'badge:<job>' / 'owned:<item>'
  bonus?: StarBonus[];           // each adds a star (finishing = 1)
}

// content/errands.json
interface Errand {
  id: string; kind: 'find' | 'deliver' | 'return';
  giver: string;                 // townsperson marker id
  icon: string;                  // bubble picture key
  item: string; destination?: string; // deliver: who gets it
  spot?: string;                 // find: where the lost thing lies
  reward: number;                // coins
  job?: 'cop' | 'fire' | 'builder';
  after?: string;                // offered once this mission is done
}

// content/shop.json
interface ShopItem { id: string; icon: string; price: number; job?: string; requires: string[] }

// content/minigames.json
interface MinigameDef {
  id: string; job: 'cop' | 'fire' | 'builder';
  durationSec: number; tiers: [number, number, number]; // score thresholds -> 5/15/30 coins
  difficultyStepPerReplay: number;
}
```

### Save (`src/systems/save.ts`)
```ts
interface SaveV1 {
  version: 1; coins: number; job: 'cop'|'fire'|'builder'|null;
  badges: string[]; missionsDone: Record<string, number /*stars*/>;
  errandsDone: string[]; owned: string[]; minigamePlays: Record<string, number>;
  apartment: { item: string; gx: number; gy: number }[];
}
```
Key `jbc.save`. Write after every mission, minigame, errand, purchase. Migrate by version.

### Voice (`src/audio/voice.ts`)
`Voice.say(lineId)` looks up text in `content/voice.json` and speaks via `speechSynthesis`.
Later, if `public/voice/<lineId>.mp3` exists, play that instead. Never show the text on screen.

## Performance budget
60 fps on a mid-range Android phone in Chrome. Bake all block art into textures at boot; avoid
per-frame Graphics redraws. Cull off-screen sprites. Target initial download < 3 MB.

## Testing
- Unit (Vitest): iso math, input mapping, road assist lane choice, economy, save migration,
  mission/errand state machines.
- E2E (Playwright): boots without console errors in desktop Chrome and Pixel 7 emulation;
  canvas present; a scripted input drives the police car.
