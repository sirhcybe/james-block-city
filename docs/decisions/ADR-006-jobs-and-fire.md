# ADR-006: Jobs, the Job Center, and the fire model

**Status:** accepted · 2026-11-10 · spec 004

## Context
Spec 004 adds the second job. Each job has:
- its own boss, vehicle and tool;
- its own outfit, mission board and Shop upgrade.

The GDD says the Job Center opens after the first badge. The Firefighter needs fires at many
heights (ground fires, tower windows), a hose a 6-year-old can use, rescues from high up, and one
interior.

## Decision
- **The job table.** `src/systems/jobs.ts` has a `JOBS` table with each job's boss marker,
  vehicle, tool, outfit, the gift on its first mission, and its board marker. Code reads the
  table, never `if (job === 'cop')`:
  - the director's boss and gifts;
  - which vehicles you can hop into;
  - the Shop shelf;
  - the board.
- **Switching rules** (`uniformState`):
  - Your current job is always shown.
  - Other jobs are locked until you have any badge, or if they have no missions yet.
  - Switching keeps a running mission only if it belongs to the new job.
- **The first job is still the Cop.** Changing the very first minute (tap a uniform at City
  Hall) is left for the finale/polish spec.
- **Fires are perches.** A perch is a map point with a height (`MapDef.perches`). Fires and pets
  live on perches, and goals reference them by id.
- **The fire model** (`systems/fire.ts`):
  - `FireState`: hp, bursts, slow regrowth, and an easier step after 3 bursts;
  - `reach`: on foot, ground fires within 3 tiles; from the truck, within 3.5 tiles (plus a little
    for height). The standard ladder reaches 10 blocks and the extra-long ladder 14;
  - `pickFire`: the hose auto-aims at the nearest fire in reach, and the Action button shows the
    hose only then.
- **The new goal types:**
  - `rescue { pet, at, perch }`: stop the truck near `at`; the ladder graphic rises to the perch,
    and the pet slides down to its owner;
  - `inside { at, room }`: a door pad launches a separate room scene (`InteriorScene`), which
    emits `interiorDone`.
- **Minigames** extend the shared `MinigameScene` (`scenes/minigameKit.ts`), with pure models in
  `systems/fireMinigames.ts`.

## Consequences
- **Builder (spec 005)** needs a `JOBS` entry (already present), a vehicle, a tool handler
  (`blast`), and content.
- **The ladder reach of 10** is higher than the spec's first draft (8), so that "Kitty on
  Floor 10" works with the standard ladder. The spec was updated.
- **Map growth.** The map is 32×32 with four 16×16 ground chunks, three of them land. Measured on
  a production build: 77 fps in the fire scenario and 72 fps in Double Trouble (Pixel 7 + 4×
  throttle).
