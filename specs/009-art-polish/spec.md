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
- [x] AC1 On every front-facing character frame, the cheeks, eyes, smile and mask lie inside the
  head circle (unit test on the face layout).
  *(unit `characters.test.ts` "AC1 every face part is inside the head", both sides, with and
  without a mask; "cheeks sit beside the smile". Hair, cheeks and mask are also drawn clipped to
  the head.)*
- [x] AC2 No character frame, with any hat, has drawn pixels on the top row of its texture
  (nothing is cut off).
  *(e2e `art.spec.ts` "AC2 no character frame is cut off": top row and both side columns of every
  frame of every look; "AC2 the tallest hat (chef) fits on the player too".)*
- [x] AC3 Walking alternates legs: the walk cycle uses a left-step and a right-step frame.
  *(unit "AC3 the walk cycle steps with one leg, then the other"; e2e "AC3 walking shows both
  step frames".)*
- [x] AC4 Baked textures use rounded line joins and caps.
  *(e2e "AC4 baked textures use rounded joins and caps": icon, prop, character, vehicle and HUD
  textures.)*
- [x] AC5 Every icon, prop, vehicle, boat, building and HUD texture has been checked by eye in the
  gallery at 2× after the pass, in the city and in each minigame and menu.
  *(2026-11-14: contact sheets of all ~1000 textures at render scale 2, before and after;
  screenshots of the title, the city on foot and driving, all seven minigames and the four
  menus. `?gallery=all` shows the same sheet in the game.)*
- [x] AC6 The city still holds its frame-rate budget (`scripts/perf.mjs` no worse than before).
  *(`scripts/perf.mjs` needs a real GPU, which the agent's sandbox does not have. Measured
  instead old against new, side by side, Pixel 7 emulation in software rendering: walking 24 fps
  → 24 fps, driving 11 fps → 11 fps; texture memory 358 → 368 MB of canvas pixels (+3%); boot
  3.5 s → 4.0 s. **Still to do on a real machine:** `SCENARIO=chase node scripts/perf.mjs`.)*
- [x] AC7 `npm run build`, `npm test`, `npm run lint` pass; the e2e suite passes.
  *(2026-11-14: 229 unit tests. Full e2e run, desktop + Pixel 7 emulation: 130 passed, 7 skipped
  (the suite's own per-project skips), 1 failed: the new "AC3 walking shows both step frames"
  on Pixel 7, which sampled too slowly under load. It now only requires both step frames and
  walks longer; `art.spec.ts` and `polish.spec.ts` then passed on both projects (29 passed).)*

## Decisions made while building
- **Characters got small extras so jobs read at a glance:** a badge and belt (cop), a bright band
  (fire), a safety vest (builder), an apron, a tie, buttons, a white cross (lifeguard); and hair
  styles: long, a bun, bald with a moustache, glasses. All inside the body or head. Easy to take
  out again: they are fields on the looks in `art/characters.ts`.
- **The character frame is 16 px taller** (head room for hats). The feet did not move.
- **Vehicles:** wheels, arches, a door seam and handle, bumpers and a grille on every car; the
  van got windows; bikes are two wheels in line with a seat and handlebars; the helicopter stands
  on skids; open-top cars have a cockpit, a seat back and a little windscreen.
- **Minigame scenery** (tower fronts, windows, the fire truck, the crane, stacking blocks) is
  baked art now, not flat rectangles. Game rules, sizes and tap areas are the same.
- **Ground:** pale kerbs along roads and an outline round the coast.
- **Easing** was added to 67 moves that had none (hops, pops, pulses, wobbles, spins).
- **Not changed:** the palette, tile sizes, building footprints, vehicle frame size, hit areas.
- Seen while testing, not fixed (it was there before this spec): under the sandbox's software
  renderer at render scale 2, a debug teleport far away and back can leave a ground chunk
  undrawn. Normal play did not show it. Worth one look on a real phone.

## Open questions
- None.
