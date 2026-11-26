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
- [x] AC1 The city has at least 50% more land than before (counted in tiles, Parkside on vs off).
  *(unit `parkside.test.ts` "AC1": 2222 → 3364 land tiles, +51%. The land as a plain 55 × 21
  rectangle came to +49%, because the old count includes a pond and the lighthouse island, so
  Parkside got a beach.)*
- [x] AC2 Every road, old and new, is one network; Parkside joins the old streets in at least four
  places; roads stay two tiles wide.
  *(unit "AC2" ×2: eight joins, every Parkside lane node reachable from the police car, traffic
  7 and 8 start on lane nodes; spec 008's "roads still two tiles wide" and "all roads are one
  network" tests still pass over the bigger map. e2e "AC2 a car drives from the old streets down
  into Parkside", desktop and Pixel 7.)*
- [x] AC3 Every Parkside townsperson, errand spot and stroller path can be walked to from the
  spawn; strollers stay on walkable ground.
  *(unit "AC3" ×2; `roads.test.ts` "every walker route stays on sidewalk / plaza / grass tiles".)*
- [x] AC4 Parkside's landmarks (homes, school, ice cream shop, pet shop, library, playground,
  garden, pond) are drawn to `docs/art-style.md`, checked by eye in the gallery and in the city.
  *(unit "AC4": every landmark kind present, nothing on a road or in the water, nothing old left
  on Parkside's ground. By eye 2026-11-26: contact sheet of the new textures at render scale 2,
  and city screenshots of the homes, the shop street, the school, the park and the beach.)*
- [x] AC5 The three new errands can be played start to finish, by foot and from a vehicle.
  *(unit "AC5": valid, pictures, voice lines, people and spots in Parkside, items used by no
  other errand. e2e, desktop and Pixel 7: the ball on foot; the kite picked up from the car on
  the coast road and handed over from the car; the carrots handed over on foot and delivered
  from the car. The school kid and the ball's garden are walk-only, like the other find spots.)*
- [x] AC6 The boat can still sail from the dock to every rescue, and around to the new south
  coast; nothing in the sea overlaps the new land.
  *(unit "AC6": paths from the boat's mooring to all six rescue spots, off the beach and the far
  south-west corner; the south islands sit off the new coast, on sand.)*
- [x] AC7 Frame rate holds (measured old against new); boot time and texture memory growth are
  measured and recorded.
  *(2026-11-26, `main` against this branch side by side, Pixel 7 emulation, software rendering,
  render scale 1.5: walking 29 → 29 fps and driving 12 → 12 fps in the old city; at matched old
  spots 6.6–10.7 fps on both, and 7–7.4 fps in Parkside; boot 4.6 s → 4.4 s (noise). Texture
  memory 368 → 422 MB of canvas pixels (+15%), ground 141 → 183 MB. Recorded in ADR-013 with a
  follow-up for the ground textures. **Still to do on a real phone:** `scripts/perf.mjs`.)*
- [x] AC8 `npm run build`, `npm test`, `npm run lint` pass; the e2e suite passes.
  *(2026-11-26: build, lint, 237 unit tests. Full e2e run on the final code, desktop and Pixel 7
  emulation in one go: 139 passed, 7 skipped (the suite's own per-project skips), none failed.)*

## Decisions made while building
- **Theme:** homes with gardens, a shop street (ice cream, pet shop, library), a school, and a
  park with a pond, a playground and a community garden. Chosen here; easy to swap.
- **A beach** along the south coast, to clear +50% land (see AC1). The boat can land there.
- **Errands are offered from the start** (no mission gate), so the new neighborhood has a reason
  to visit straight away.
- **Fixed for every Deliver errand:** the giver now says "Can you take this to...", as you come up
  or as they hand it over. Before, that line was said when you reached the receiver.
- **New faces:** a school kid, a kid in the park, a gardener in a straw hat (new hat), a pet shop
  keeper. Not in the Shop: the straw hat is the gardener's.
- **Moved:** the two small islands south of the old coast and three buoys; deleted: five trees and
  eight flower beds that stood on the old south edge, now Parkside's pavements.

## Open questions
- None. The neighborhood's theme (homes, school, park) was chosen here; Chris can swap any of it.
