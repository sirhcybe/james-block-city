# 009 — Art polish: tighter sprites and animation

## Goal
Every sprite and animation is drawn carefully: parts fit inside the shapes they belong to, lines
join cleanly, and nothing is cut off. The style stays the same (clean, cartoony, blocky, no studs),
with more detail.

Asked for by Chris on 2026-11-14: "The graphics need to be more detailed and have less sloppiness,
like cheeks that don't fit on faces. Keep the clean, cartoony, blocky style but tighten up every
sprite and animation."

## User stories
- As James, I want the people, cars and buildings to look neat and finished, so the city feels
  like a real cartoon.
- As Chris, I want no sprite with parts that stick out, float, or get cut off.

## In scope
- Characters: face parts (cheeks, eyes, smile, mask, hair) stay inside the head; hats sit on the
  head and are never cut off by the frame; walking uses both legs.
- Vehicles: wheels sit in the plane of the car's side, riders are drawn like the other people,
  more detail (bumpers, grille, doors, mirrors).
- Props, mission props, pickups, animals, effects, boats: every shape outlined, joins rounded.
- Icons (bubbles, pads, HUD, shop, minigames): one outline rule for all, no unoutlined parts.
- Buildings and ground: detail pass that keeps the look rules in `docs/art-style.md`.
- HUD, menus, title screen and minigame art: same rules.
- Animations: walk cycle, idle, hops, bounces, pop-ins and effects reviewed and tidied.
- A dev gallery (`?gallery=all`) that shows every baked texture for checking by eye.

## Out of scope
- New gameplay, new content, new sounds.
- Changing the projection, tile size, palette roles or the no-studs rule.
- Hand-drawn or imported image files: all art stays generated in code.

## Acceptance criteria
- [ ] AC1 On every front-facing character frame, the cheeks, eyes, smile and mask lie inside the
  head circle (unit test on the face layout).
- [ ] AC2 No character frame, with any hat, has drawn pixels on the top row of its texture
  (nothing is cut off).
- [ ] AC3 Walking alternates legs: the walk cycle uses a left-step and a right-step frame.
- [ ] AC4 Baked textures use rounded line joins and caps.
- [ ] AC5 Every icon, prop, vehicle, boat, building and HUD texture has been checked by eye in the
  gallery at 2× after the pass, in the city and in each minigame and menu.
- [ ] AC6 The city still holds its frame-rate budget (`scripts/perf.mjs` no worse than before).
- [ ] AC7 `npm run build`, `npm test`, `npm run lint` pass; the e2e suite passes.

## Open questions
- None.
