# James's Block City — Game Design Doc

Mirrors the living design doc. If they disagree, ask the human which is current.

## 1. Overview

James's Block City is an isometric, blocky, comic-action city game. You pick a job (Cop, Firefighter
or Builder), drive loud vehicles around a block city, and earn coins by playing minigames and helping
people with errands. Once you've proven yourself in your first job, you can switch jobs any time.
The whole story takes about 2–4 hours.

- **Player:** James, age 6, plus kids 6–7. Can't read yet — nothing requires reading.
- **Platforms:** Chrome on laptops (mouse/keyboard) and Chrome on Android phones (touch), landscape.
- **Sessions:** missions, minigames and errands take 2–8 min each; autosave after every one.
- **Feel:** big, bouncy, noisy, silly. Things tumble and wobble, nobody gets hurt, you can't really lose.

### Design pillars
1. **Vroom and wee-oo.** Driving with sirens is the core joy. Every vehicle has spinning wheels, a horn
   and a siren button.
2. **Pick your job, then switch it.** Three jobs, each with its own vehicle, tool and minigames.
3. **Help people, earn coins.** Money comes only from minigames, errands and missions.
4. **Never stuck, never scared.** No reading, no killing, slapstick action only. Missions and the
   open city can't be failed; a minigame round can end in a friendly "Oops, try again".

## 2. Jobs and core loop

Loop: **do your job (missions, minigames, errands) → earn coins → spend on something visible →
unlock the next mission or job.**

| Job | Vehicle | Tool | Missions are about | Minigames | Home base |
| --- | --- | --- | --- | --- | --- |
| Cop | Police car (later police bike, helicopter) | Net launcher | Chasing the Bandit Brothers, traffic safety | Traffic Helper, Who Took It? | Police station, Downtown |
| Firefighter | Fire truck with ladder | Water hose | Cartoon fires on skyscrapers, pet rescues | Window Splash, Ladder Rescue | Fire station, Skyscraper Heights |
| Builder | Cement mixer truck | Block blaster (opens Build It!) | Building dock, lighthouse, bridge | Block Stack, Copy the Build, Cement Pour | Construction site, Harbor |

### Picking and switching jobs
1. **Start:** three uniforms on a rack at City Hall. Tap one = first job.
2. **Rookie:** play that job's 3 Rookie missions (~25 min) to earn its badge.
3. **Job Center opens** in City Hall after the first badge. Tap a uniform to switch (spin + sparkle).
   Each new job starts at its own Rookie missions.
4. **Quick change:** with all three badges, a uniform button on the HUD switches jobs anywhere.

### Ways to earn coins
- **Minigames (2–3 min):** at the job's home base or when someone asks. Pay 5 / 15 / 30 by performance;
  a finished round always pays at least 5. Mistakes cost hearts; out of hearts = "Oops, try
  again" (no coins lost, more hearts next try). Each minigame belongs to one job.
- **Boat rescues (3–5 min):** once the dock is built, the lifeguard there has rescues for
  firefighters and police officers. They pay like Pro missions and can be played again.
- **Errands (1–3 min):** townspeople show a picture bubble (kitten, pizza, balloon). Types: Find,
  Deliver, Return (loot robbers dropped). ~20 across the city; new ones appear after each mission.
- **Missions (5–8 min):** story missions pay the most and unlock places, vehicles, next missions.

### Villains: the Bandit Brothers
Smudge and Pickles (placeholder names). Striped shirts, eye masks, goofy. They steal silly things
(every donut, the mayor's rubber duck, the last left sock). Their wobbly getaway car drops loot,
which becomes Return errands. The player can never play as them.

## 3. World

One isometric map, 72 × 48 tiles (the city is 60 × 40; the rest is open sea with small islands),
four districts around a central plaza. Everything open from start. Blocks are six tiles wide with
room round every building (playtest 2026-11-12: the first map was cramped).

| District | Where | Landmarks | Home of |
| --- | --- | --- | --- |
| City Plaza | Center | City Hall (Job Center), Shop, your apartment, fountain | Start, job switching, spending |
| Downtown | NW | Police station, bank, donut shop, Time-Out Tower (jail), traffic lights | Cop |
| Skyscraper Heights | NE | Fire station, towers of 10/15/20 floors, rooftop helipad | Firefighter |
| Harbor | S | Construction site, dock, lighthouse, boat shop, bridge to tiny island | Builder |

- Roads: a simple loop plus a cross through the middle. Road assist keeps vehicles in lane and rounds corners.
- A bus stop in each district = one-tap fast travel.
- Tall buildings fade see-through when the player is behind them.
- Map edges are water/park with a fence. Nothing to fall off.
- **The sea:** building the dock moors a rescue boat beside it. Any job can hop in from the dock
  and sail anywhere on the water; you get out at a dock or a beach.
- **Objective arrows:** during a mission, a few seconds without getting closer to the objective
  shows an arrow (on the target, or on the screen edge pointing the way) until you get there.
- Pedestrians hop out of the way with "whoa!" and are never hit. Ones with bubbles give errands.

## 4. Comic action rules
1. No weapons that hurt. Net launcher, bumps, water, block blaster (adds blocks). No guns/swords/harmful explosions.
2. Catching is a comedy beat: netted robber wobbles, "Aw, nuts!", waddles into the police van.
   At Time-Out Tower they sit in the corner, then sneak out for the next mission.
3. Bumps go boing: cars bounce/spin and right themselves; cones/cans tumble and reset. Pays nothing.
4. Getting bonked costs nothing: 1 s dizzy stars. No lost coins, no game over, no failing timers.
   The only "lives" are a minigame's hearts, and running out just means another go.
5. Fire is a friendly foe: grumpy-faced flames go "pfft". Nobody trapped in danger; rescues are pets, cake, a parrot.
6. Robbers are funny, not scary. No threats, no kidnapping.
- **Can't get stuck:** after 20 s idle/wandering, bouncing arrow + voice hint. After ~3 tries the robber's
  car runs out of gas / the fire shrinks / the minigame slows.

## 5. Progression

21 story missions (3 Rookie + 3 Pro per job, plus a 3-part finale) ≈ 2 h; minigames, errands, shop and
decorating add 1–2 h. Pro missions open after the Rookie badge plus one ~90-coin Shop upgrade
(≈3 minigames). Every mission gives 1–3 stars (1 for finishing, 2 bonus) and always ends in a win.

| Job | Rookie | Pro upgrade | Pro |
| --- | --- | --- | --- |
| Cop | First Day · Donut Dash · Duck Crossing | Police bike, 90 | Rooftop Run · Lost Puppy · Double Trouble |
| Firefighter | Siren School · Kitty on Floor 10 · Toaster Trouble | Extra-long ladder, 90 | Barbecue Blaze · Fireworks Fiasco · The Tallest Tower |
| Builder | Hard Hat Day · Dock It · Mixer Mayhem | Giant mixer drum, 90 | Lighthouse Lights · Boat Shop · Bridge to the Island |
| Finale: Golden Block Heist (all 3 Pro badges) | Tower Fire → Helicopter Chase → Rebuild the Tower; glowing job stations allow mid-mission switching | — | Parade, night lights, play forever |

### Minigames
| Minigame | Job | How it plays |
| --- | --- | --- |
| Traffic Helper | Cop | Tap the light to stop cars so ducks and kids can cross |
| Who Took It? | Cop | Five suspects; tap the one with the clue (frosting, feather, sock) |
| Window Splash | Firefighter | Flames pop up in windows whack-a-mole style; spray them |
| Ladder Rescue | Firefighter | Raise the ladder to the right floor so cats slide down |
| Block Stack | Builder | A block swings on a crane; tap to drop and stack high |
| Copy the Build | Builder | Copy a small picture by tapping colored blocks into a grid |
| Cement Pour | Builder | Hold to pour; let go at the line |

| Build It! | Builder | At a build spot: drag planks, bricks and beams onto the picture, then pick the hammer, trowel or wrench. No timer, no hearts |

Every minigame: 2–3 min, pays 5/15/30, gets slightly harder on replay **and** every few points
inside a round (levels). One shared top bar shows the score, a star meter, the time left and the
hearts. A streak of five wins a heart back.

### Boat rescues (after Dock It)
| Rescue | Job | What you do |
| --- | --- | --- |
| Barge Blaze | Firefighter | Sail to the smoking barge, spray both fires, sail home |
| Castaway Cat | Firefighter | Fetch the kitten from the rock island |
| Duckling Patrol | Cop | Pick up three ducklings on floaties |
| Sailboat Tow | Cop | Tow the broken sailboat back to the dock |

### Shop (every item ≤ ~3 minigames of coins)
- Job upgrades: police bike, extra-long ladder, giant mixer drum
- Vehicles/paint: own car (after first badge), colors, siren and horn sounds
- Hats: police cap, fire helmet, hard hat, chef, pirate, duck
- Apartment furniture: bed, table, lamp, cushions, bookshelf, TV, computer, fish tank (drag to place)

## 6. Controls

Screen-relative movement (push up = up the screen) — a 6-year-old won't think in iso diagonals.

| Action | Laptop | Android |
| --- | --- | --- |
| Move/drive | Arrows/WASD, or click-and-hold toward a direction | Floating thumb joystick (left half) |
| Go to a spot | Click ground/building → path there | Tap ground/building |
| Action (net, hose, build, talk, enter/exit vehicle) | Space or on-screen button | Big round button, bottom-right |
| Siren/horn | Q or button (S is WASD down) | Button above Action |
| Aim hose/ladder | Mouse position | Drag on right half |
| Switch job (all badges) | J or uniform button | Uniform button, top-right |
| Minigames | One click / click-hold | One tap / tap-hold |

- No reading anywhere. Picture menus, spoken goals, picture bubbles, bouncing arrows.
- Touch targets ≥ 64 CSS px; generous snapping for nets, blocks, road assist.
- One save slot, autosaved after every mission/minigame/errand/purchase (localStorage).
- Grown-up corner behind a 2-second press-and-hold: volume, reset save, unlock all jobs.

## 7. Parked ideas (not in scope)
Photo mode · day/night cycle · café job (bake, juice, snacks) · airport + plane · island hopping +
submarine · garden/trees · two-player same screen.
