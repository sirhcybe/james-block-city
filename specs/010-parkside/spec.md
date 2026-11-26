# 010 — Parkside: a new neighborhood

## Goal
The city grows by half: a fifth district, Parkside, along the south coast. Family homes with
gardens, a little shop street, a school, and a big park with a pond and a playground. Its streets
carry on from the city's streets, people live and stroll there, and a few of them need help.

Asked for by Chris on 2026-11-26: "Make the city 50% bigger by adding a new neighborhood."

## User stories
- As James, I want a new part of town to drive into, with houses, a school and a playground, so
  the city feels bigger and there is somewhere new to explore.
- As James, I want people in the new neighborhood to ask me for help, so there is a reason to go.
- As Chris, I want everything that already works (missions, the boat, minigames) to stay where it
  is and keep working.

## In scope
- A new district piece, Parkside, south of the old city: two rows of blocks and a new south
  coast road. The old north–south streets carry on into it.
- New landmarks, drawn to the art rules: family homes, a school, an ice cream shop, a pet shop, a
  library, a playground, a community garden, a pond. Blossom trees and mailboxes for the streets.
- People: strollers and three townspeople with new errands (a lost ball, a kite that blew away,
  carrots for the pet shop bunny). New pictures for ball, kite and carrot.
- Two more traffic cars, so the new streets are not empty.
- The sea grows with the island: the little south islands and buoys move off the new coast.
- Docs: game design (world), architecture, roadmap, an ADR.

## Out of scope
- New missions, jobs or minigames; fast travel (the GDD's bus stops).
- Moving anything in the old districts, except the trees and flowers on their south edge, which
  now stand where Parkside's pavements are.
- Changes to the boat rescues (they are all on the east side).

## Acceptance criteria
- [ ] AC1 The city has at least 50% more land than before (counted in tiles, Parkside on vs off).
- [ ] AC2 Every road, old and new, is one network; Parkside joins the old streets in at least four
  places; roads stay two tiles wide.
- [ ] AC3 Every Parkside townsperson, errand spot and stroller path can be walked to from the
  spawn; strollers stay on walkable ground.
- [ ] AC4 Parkside's landmarks (homes, school, ice cream shop, pet shop, library, playground,
  garden, pond) are drawn to `docs/art-style.md`, checked by eye in the gallery and in the city.
- [ ] AC5 The three new errands can be played start to finish, by foot and from a vehicle.
- [ ] AC6 The boat can still sail from the dock to every rescue, and around to the new south
  coast; nothing in the sea overlaps the new land.
- [ ] AC7 Frame rate holds (measured old against new); boot time and texture memory growth are
  measured and recorded.
- [ ] AC8 `npm run build`, `npm test`, `npm run lint` pass; the e2e suite passes.

## Open questions
- None. The neighborhood's theme (homes, school, park) was chosen here; Chris can swap any of it.
