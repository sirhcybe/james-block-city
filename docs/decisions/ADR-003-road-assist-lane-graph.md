# ADR-003: Road assist on a centre-line lane graph

**Status:** accepted · 2026-11-09

## Context
Spec 002 needs vehicles that a 6-year-old can drive with one thumb: they must stay on the road,
keep to a lane, and turn where the stick points at intersections (`docs/architecture.md`, "road
assist"). They must also allow tap-to-go along roads, and the robber AI needs the same roads.

## Decision
- Roads are two tiles wide. `src/iso/roads.ts` builds a **lane graph from the tile map**: a node on
  every grid point whose four surrounding tiles are road. This puts nodes on the **centre line**
  between the two lanes, with edges of length 1 between orthogonal neighbours. A node with three or
  more links is an intersection. No hand-authored road data: change the map and the graph follows.
- A vehicle (`LaneDriver`) is always on an edge `from → to` at progress `t`. It is drawn half a tile
  to the **right of travel** (its lane), eased smoothly after turns.
- It only decides at nodes, with `chooseBranch(input, heading, options)`:
  - with stick input, the branch closest to the stick wins;
  - a U-turn happens only when the stick clearly points back;
  - with no input, it goes straight on or follows a bend, and stops at a T-junction to wait.
  Pushing the stick backwards mid-road turns around on the spot (cartoon physics).
- Tap-to-go is a BFS path over the same graph. The robber AI is the same driver with a custom
  chooser (maximise distance from the police).

## Consequences
- The car can never leave the road (a 2-minute random-input unit test proves it), and pedestrians on
  sidewalks are never in a vehicle's path.
- Four-wide road areas would produce a grid of nodes. The map rule is two-wide roads only.
- The lane offset is cosmetic: two vehicles in opposite directions on one road never collide, while
  same-direction vehicles meet in the same lane (that's how bumps happen).
