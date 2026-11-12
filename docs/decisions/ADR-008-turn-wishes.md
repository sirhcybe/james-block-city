# ADR-008: Arrow keys ask for the next turn

**Status:** accepted · 2026-11-11 · updates ADR-004 (how a held stick picks a road)

## Context
In the 2026-11-11 playtest Chris said the driving "is very hard to turn corners a lot of the time".
A simulation drove at every junction on the map and switched to a key that points at a side road
at different distances before the junction. Turns taken, before this change:

| Key | Example (heading down-right) | Turned |
|---|---|---|
| A diagonal toward the road | Up-Right for the up-right road | 23–100%; failed in the last tile |
| A single arrow tied with straight on | Right for the up-right road | 23% |
| A single arrow behind the car | Up for the up-right road | 0–65% |

Three causes:
- **Ties went straight on.** Every single arrow key sits exactly between two roads on screen.
  ADR-004 sent ties straight on (to stop flip-flopping), so a single arrow could never turn.
- **"Behind" meant spin round.** Up while heading down-right is 117° off, over the 110° U-turn
  line, so the car spun round unless the junction was within 1.2 tiles.
- **The turn locked in early.** A turn was only accepted before its corner curve began, about a
  tile before the junction. Pressing as the car reached the junction did nothing.

## Decision
- **A changed stick prefers the turn on a tie.** `LaneDriver` remembers the stick that put it on
  its current heading (when it pulled away, turned or spun round). On a tie, a stick more than
  20° away from that one picks the turn. The same stick that set the heading still goes straight
  on, so holding one key never zig-zags.
- **Turn wishes look ahead 3 nodes.** If a junction up to 3 nodes ahead has a road the stick asks
  for (closer than straight on, within 100°), the car keeps going straight to it. It doesn't spin
  round or stop at the plain nodes on the way.
- **Late turns are still taken.** A turn asked for after its curve would have started, but before
  the car reaches the junction, is taken on a tighter curve (down to 0.12 tile), at corner speed.
  A short visual blend hides any jump.

## Consequences
- After: 85–100% of those turns are taken at every distance tried (0.3 to 2.5 tiles). It's 100%
  for every key when pressed 1.5 tiles out. New unit tests pin it: every such key at 1.5 tiles,
  and at least 90% at 0.6 tiles.
- The AC1 sweep (32 sticks × every 5th node × every heading × 30 s: at most one U-turn, no
  flip-flop) and the Downtown ↔ Plaza travel tests still pass unchanged.
- A stick pointing behind the car still spins it round, unless a junction just ahead offers a road
  the stick wants. ADR-004's flip-flop argument still holds: turns only go to roads within 100° of
  the stick, and going straight on never changes the heading.
