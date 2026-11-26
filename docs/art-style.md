# Art & Audio Style

Reference images: the concept art lives in Chris's Gemini chat "James's Block City Concept Art"
(the stud-free versions: police chase, firefighter, builder). Export them to `docs/concept-art/`
when available. **The images guide mood and palette only; all game art is drawn in code.**

## Look — hard rules
- **Isometric 2D**, 2:1 dimetric projection. Flat sprites, not 3D voxels, no real-time 3D.
- **Smooth, flat-topped blocks with soft bevels. No studs, pegs, or bumps — anywhere.**
  Must not resemble any toy-brick brand.
- Thick dark outline (2 px at 1× scale, `#2B2D42`) on every shape.
- Every block shows three faces: top = base color lightened 15%, left = base, right = base darkened 20%.
- Buildings: clean white with big blue windows ("very modern"). District accent colors on trims/roofs.
- Characters: short, stubby, smooth round heads (no peg on top), dot eyes, big smile. 4 facing directions
  (NE, NW, SE, SW). Robbers: black-and-white striped shirt, black eye mask.
- Everything bounces: squash & stretch on landing, wobble on bump, sparkle on coins.
- Interiors: roof lifts off + front walls fade (dollhouse). Occluding buildings fade to 35% opacity.
- HUD: coin icon + number top-left; joystick bottom-left (touch only); Action (large) and Siren
  buttons bottom-right; job/uniform button top-right when unlocked. Round, chunky, outlined.

## Minigames and the home screen (spec 008)
- Every minigame has the same top bar: picture + score in a pill top-left, star meter, clock + time
  bar, hearts under the score. Backdrops are sky bands, a sun, drifting clouds and hills.
- The home screen shows the skyline on its island, the three heroes by their vehicles, the sea
  with the boat, and the name in bouncing blocks. Play stays in the middle.
- The sea moves: one wave tile slides slowly under the whole world.

## Drawing rules (spec 009)
These keep the art tight. Check new art against them in the gallery (`?gallery=all`).
- **Parts stay inside the shape they belong to.** Face parts are laid out by `faceLayout` and
  drawn clipped to the head; hair, masks and shirt details are clipped to the head or the body.
  If a part can stick out, clip it or inset it; never rely on it "just fitting".
- **Every shape has the outline,** inner details included. Things made of several blobs (clouds,
  bushes, hearts, a chef's hat) get one outline round the clump, not one per blob.
- **Outline width follows size.** World art uses 2 px at 1×. An icon's outline is 11% of its
  half-size, so the same picture looks the same in a bubble, on a card and on a button.
- **Rounded joins and caps** on every baked texture (`art/bake.ts`). No spiky corners, no line
  that stops short.
- **One light.** It comes from the upper left, as on the blocks: the right side of a body, a hat,
  a wall or a box is the shaded side, whichever way the thing faces.
- **Nothing is cut off.** A texture leaves room for the tallest thing it can show (the character
  frame has head room for the chef's hat).
- **Wheels lie in the side of the vehicle:** a disc in the plane of travel, with a hub and spokes
  that turn. Far-side wheels are drawn first so the body hides them.
- **Characters:** stand frame + two step frames (left leg, right leg). `walkFrame(t)` gives the
  frame for a walk. Hats sit on a rim line above the eyes; nothing sticks up like a peg.
- **Motion:** hops rise with `Quad.easeOut` and squash a little on landing (`landSquash`); pulses
  and wobbles use `Sine.easeInOut`; things pop in with `Back.easeOut` and out with `Back.easeIn`.
  A move with no easing looks mechanical: only fades, drifting clouds and fast shakes are linear.

## Parkside (spec 010)
- Family homes: two floors, a door with a porch roof and a step, window boxes, a roof that
  overhangs on every side, a brick chimney. Roofs in every accent colour.
- Pink blossom trees (the tree kind in `donutPink`) mixed with the green ones; mailboxes by the
  garden gates.
- Shops have a striped awning and a sign on the roof (a giant cone, a puppy, a book); the library
  has a porch of white columns; the school has a rainbow band and a bell tower with a clock.

## Geometry
- Tile: 64 × 32 px (2:1). One block unit = one tile footprint; block height unit = 32 px on screen.
- Render at device pixel ratio up to 2. Game logical size 1280 × 720, `Scale.FIT`, landscape.

## Palette (starting values; tune by eye against concept art)
| Role | Hex |
| --- | --- |
| Outline | `#2B2D42` |
| Police blue | `#2F6FDE` |
| Fire red | `#E63946` |
| Builder yellow | `#FFC233` |
| Harbor teal | `#2EC4B6` |
| Building white | `#F4F6FA` |
| Window blue | `#7EC8F2` |
| Grass | `#7BD35A` |
| Road | `#5A5F6B` |
| Sidewalk | `#D9DCE3` |
| Coin gold | `#FFD23F` |
| Water | `#3FB8E0` |
| Sand | `#F3DC9C` |

## Block renderer spec (implemented in spec 001)
`drawIsoBlock(g, {w, d, h, color, bevel=4, outline=2})` → draws one rectangular block of `w × d`
tiles footprint and `h` height units, three faces, rounded/bevelled top edges, outline.
Output is baked into a texture (`scene.textures` via RenderTexture or `generateTexture`) keyed by
its params so each unique block is drawn once.

## Sound
- Siren is the star: each vehicle has its own siren/horn, spammable.
- Micro-sounds: block click, coin ding (pitch rises in streaks), boing on bump, splat on hose.
- Wind whoosh grows with height on skyscrapers.
- Voice prompts replace all text. Placeholder: Web Speech API (`speechSynthesis`), en-US, rate 0.95,
  pitch 1.2. Real recordings will later replace them by the same prompt id.
- SFX generated with jsfxr presets checked into `src/audio/sfx.ts` (no external files needed yet).
- Music: bouncy loop per district, faster during chases/minigames. Placeholder: none or a simple
  generated loop until real tracks are chosen.
