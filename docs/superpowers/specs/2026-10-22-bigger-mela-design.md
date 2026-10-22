# Bigger mela: design


> **Scope change (2026-10-22, after Task 3 of the plan):** the owner stopped the plan here. What shipped on `bigger-mela`: `layout.js` and a bigger map, finally sized at about 90 × 132 m after trying 2× and 2.5× (lane 8 m wide, ring 62 m across with 20 slots for today's 16 stalls, KollabKit and the brand stall, jhoola ground 86 × 50 m), and **Maut ka Kuan** on the jhoola ground, watched from its rim like a ride. Not built: the 8 new stalls, carts, coming-soon plots, bigger crowds, the light pool and the other new rides.
Date: 2026-10-22
Status: approved 2026-10-22; partly built on branch `bigger-mela` (see the scope change above)
Part 1 of 2. Part 2 builds the five new attractions (Break Dance, Drop Tower, Toy Train, Maut ka Kuan, Bumper Cars) on the plots this part reserves. It gets its own spec.

## Goal

Exploring the bazaar takes about three minutes of walking instead of one, and the extra space is full of things to do, not empty ground. Today the whole map is 93 × 42 m and a full tour (lane, one lap of the ring, around the jhoola ground) takes about 60 seconds at walking pace. After this project the map is 229 × 136 m and the same tour takes about 3 minutes.

## Non-goals (for this project)

- The five new attractions themselves. Their plots are reserved and fenced, nothing more (part 2).
- New brand slots. The two reserve slots (`stall-ring-b`, `hoarding-entry-b`) move to new positions with the same IDs, so the database and admin page do not change.
- Fast travel (rickshaw, map teleport). The longer walk is the point; the Toy Train in part 2 is the shortcut.
- Changing stall sizes, ride sizes or walking speed. People, stalls and rides stay real-size; only the space between them grows.

## Decisions from brainstorming

| Question | Decision |
|---|---|
| How big | 2× the length and width of today's map, with an even bigger jhoola ground |
| Layout | One big ring (option A): same shape as today, doubled |
| Jhoola ground | 136 × 98 m (about 11× today's area), with two rows of food carts and three open plots for later rides |
| What fills the space | 8 new stalls you can visit, plus carts, crowds and lights |
| How to build it | All positions move into a new `layout.js` with pure, unit-tested walking and routing functions |

## The map

Axes as today: x runs east, z runs toward the gate (south is +z). All sizes in metres.

| Area | Today | New |
|---|---|---|
| Start of the entry lane (player spawns here) | z = +5 | z = +10 (spawn at z = +8) |
| Entry lane | 16 long, 6.4 wide | 28 long, 12.8 wide (x ±6.4) |
| Gate arch | z = −7.1, 8 m wide | z = −14.6, 15 m wide |
| Ring centre | (0, −32) | (0, −64) |
| Stalls | radius 24.5, 18 slots | radius 49, 30 slots (about 10.3 m apart) |
| Walkable ring | radius 21.2 | radius 45.7 (stall fronts stay the same distance from the walk edge as today) |
| Maidan (where crackers are lit) | radius 14.5 | radius 29 |
| Parikrama path (brick band) | radius 15.3 to 26.3 | radius 30.6 to 50.8 |
| Toy Train lane (kept clear, used in part 2) | none | radius 31 to 35, on the inner edge of the parikrama path |
| Corridor to the jhoolas | 7.6 wide | 15.2 wide (x ±7.6), from the ring to z = −124 |
| Jhoola ground | x −21 to 21, z −88 to −60.5 | x −68 to 68, z −219 to −121 |
| Whole map | 93 × 42 | 229 × 136 |

### Ring slots

Slot k sits at angle π/2 + k·2π/30 around the ring centre, as today's code does with 18 slots. Slot 0 is the lane opening and slot 15 is the corridor opening. Every existing stall keeps its neighbours and its order around the ring. The new stalls go in between.

| k | West side | k | East side |
|---|---|---|---|
| 0 | (lane opening) | 15 | (corridor opening) |
| 1 | Sharma Fireworks | 16 | Cart |
| 2 | Pappu Chaat | 17 | Mishra Halwai |
| 3 | **Momo Point** | 18 | Brand stall `stall-ring-b` (a cart stands here while the slot is off) |
| 4 | Laxmi Patakha | 19 | Kismat Chakra |
| 5 | Chudi Bazaar | 20 | **Bioscope** |
| 6 | **Mehendi Corner** | 21 | Kulfi Wala |
| 7 | Ring Phenko | 22 | **Ganne ka Ras** |
| 8 | **Dabba Giraao** | 23 | Gubbare Phodo |
| 9 | Jalebi Junction | 24 | **Photo Studio** |
| 10 | **Bombay Pav Bhaji** | 25 | Khilona Ghar |
| 11 | Diya Ghar | 26 | **Akash Kandil** |
| 12 | KollabKit stand | 27 | Raja Rockets |
| 13 | Sivakasi Wale | 28 | Raju Chai |
| 14 | Cart | 29 | Gupta Crackers |

KollabKit stays between Diya Ghar and Sivakasi Wale, and the brand stall stays between Mishra Halwai and Kismat Chakra, as today. Both now take a full slot instead of a gap between slots.

### Jhoola ground

Centres and footprints are starting values, tuned with screenshots during implementation without breaking the layout tests below.

| What | Centre (x, z) | Footprint |
|---|---|---|
| Giant Wheel | (0, −127) | as today; boarding at its south side, facing the corridor |
| Ghoda Gaadi | (−48, −144) | radius 4 |
| Columbus Naav | (−45, −196) | 11.6 × 4 |
| Udan Khatola | (0, −201) | radius 5.6 |
| Break Dance plot | (−23, −166) | 18 × 18 |
| Maut ka Kuan plot | (23, −164) | 20 × 20 |
| Drop Tower plot | (55, −140) | 10 × 10 |
| Bumper Cars plot | (44, −198) | 24 × 16 |
| Open plots (3) | (−55, −168), (55, −166), (−22, −211) | 14 × 14 each |
| Cart row A | z = −181, x from −48 to 48 | a cart every 8 m |
| Cart row B | z = −149, x from −30 to 30 | a cart every 8 m |
| KollabKit jhoola hoarding | about (−40, −214), facing the entrance | as today |

Each of the five new-ride plots gets a low rope fence on four posts and a painted board: "Jald aa raha hai · Break Dance" (coming soon), in English and Hindi. Open plots are plain ground; nothing marks them.

### Lane, hoardings and street people

- KollabKit's entry hoarding moves to about (10.5, −4), angled toward the lane as today. `hoarding-entry-b` mirrors it at about (−10.5, −4).
- The balloon-wala and the dhol-wala keep their spots relative to the ring centre, scaled 2×: about (−24, −36) and (11, −31).
- Two carts stand at the lane edges near the gate.
- String lights and bunting keep crossing the lane every 3 m, now spanning 13 m.

## layout.js

A new file `layout.js` in the repo root, loaded before the game script (`<script src="layout.js?v=2">`). It follows `brands.js`: one IIFE that sets `window.LAYOUT` in the browser and `module.exports` under Node, with no three.js and no DOM.

It holds:

- **Version:** `VERSION = 2`, used for the Realtime room names (see Multiplayer).
- **Zones:** ring centre and radii (stall, front, walk, maidan, path, train lane), slot count, lane, gate, corridor, jhoola ground and the whole-map bounds.
- **What stands where:** the ring order table above (by stall name, plus `kollabkit`, `brand:stall-ring-b`, `cart`), ride positions and footprints, new-ride plots, open plots, cart spots, KollabKit's hoardings, the brand slot positions, and the balloon-wala and dhol-wala.
- **NPC paths:** the ring walking band and lane radii used by today's walkers, and wander points for the new jhoola-ground walkers.

And these pure functions:

| Function | Does |
|---|---|
| `slotAt(k, r)` | Position and facing of ring slot k at radius r |
| `walkable(x, z)` | True on the lane, ring, corridor and jhoola ground; false outside the map. Same rules as today's `walkable`, driven by the new numbers |
| `blocked(x, z)` | True inside a ride footprint, a fenced plot or a cart. NPCs and crowds stay in the game |
| `route(from, to)` | Waypoints from one walkable point to another that never leave walkable ground, go round the central pole, the giant wheel, every ride footprint and every fenced plot, and pass between the ring and the jhoola ground through the corridor |
| `zoneAt(x, z)` | One of `lane`, `ring`, `maidan`, `corridor`, `jhoola`, `outside`. Used for the location chip, crowd sound and ground colours |
| `clampToMap(x, z)` | The nearest point inside the map bounds, for positions received from other players |
| `clampToMaidan(x, z)` | The nearest point inside the maidan, for crackers received from other players |

`index.html` keeps all the building and drawing and reads every number from `LAYOUT`. These parts of the game change to do so: `C`, `RING`, `SLOT`, `GATE_Z`, `ENTRY`, `NORTH`, `MAIDAN`, `WHEEL`, `JG`, `CAR`, `COL`, `CS`, `BW`, `DHOL`, `AD_ANG`, `standAt`, `SLOT_DEFS`, the KollabKit hoardings, the stall placement in `boot`, `walkable`, `route`, `crossesWheel`, `blocked` (ride part), `walkTo`, `updLoc`, `crowdTick`, `npcTarget`/`npcStep`, the kids' circles, `buildPeople`, `buildDiyas`, `buildEntry`, `buildPlaza`, `buildGround`, `buildPools`, `buildCity`, `buildKandils`, `buildRides` (floor, lamp posts, sign), `ambient`, the mini-map bounds `MB`, the network clamps, and the intro camera.

If `layout.js` fails to load, the game shows the same "could not load" message it shows when three.js is missing, instead of running on a half-defined map.

## New stalls

Each new stall uses the same stall shell (`buildStall`), sign, awning, keeper, lights and garlands as today's. Each gets its own counter props, two to four voice lines in roman Hindi and Devanagari (the `L` table), a greeting, and dialogue choices. Prices are in line with the existing stalls.

| Stall | Tag on the sign | Built like | Choices | What happens |
|---|---|---|---|---|
| Momo Point | Steamed · Fried | Pappu Chaat (food) | Steamed momos ₹40, Fried momos ₹50 | Momos on a leaf plate in your hand, 3 bites. Counter: bamboo steamer stack with steam, red chutney bowl |
| Bombay Pav Bhaji | Makhan maar ke | Pappu Chaat (food) | Pav bhaji ₹50, Extra makhan ₹60 | Plate with bhaji and two pav, 4 bites. Counter: big flat tawa with bhaji, butter block, steam |
| Ganne ka Ras | Taaza nikala | Raju Chai (drink) | Ek glass ₹20, Nimbu-adrak wala ₹25 | Glass of green-gold juice, 4 sips. Counter: crusher with a turning wheel, a bundle of cane |
| Akash Kandil | Roshni upar tak | Diya Ghar (decor) | Akash kandil ₹50 | A kandil goes in your bag. Tap the ground anywhere on the map: it hangs from the nearest lamp post within 5 m, or on a new bamboo pole at that spot. Friends see it hang. At most 60 placed kandils in a room; the oldest comes down first |
| Mehendi Corner | Haathon pe rang | Chudi Bazaar (wear) | Simple bel ₹30, Full haath ₹60 | Mehendi pattern on your first-person hands, kept like bangles. Friends see your hands tinted with it (a new presence field). Giftable |
| Dabba Giraao | 3 balls · ₹20 | Ring Phenko (game) | Play ₹20 for 3 balls | Six tins in a 3-2-1 pyramid. Tap when the moving aim marker is on the tins. Each tin knocked off pays ₹6; all six down pays ₹20 more |
| Bioscope | Dilli dekho, Bambai dekho | New | Show ₹10 | The camera moves to the eyepiece and a sepia-framed slideshow plays: six painted slides (Qutub Minar, Taj Mahal, Chowpatty, Howrah Bridge, a filmi hero, a Diwali night), about 4 s each, while the bioscope-wala chants |
| Photo Studio | Ek click · ₹30 | New | Photo ₹30 | You stand in front of a painted backdrop (moon, fireworks, a cut-out bike). The game renders one third-person frame of you and any friends within 4 m of the backdrop, adds a printed border ("Phatake Bazaar · Diwali 2026" and the date), and shows it with a Download button (PNG) |

Gifts: everything bought at these stalls can be bought for a friend through the existing "Buying for" row, except a Bioscope show, a Dabba Giraao game and a photo. The new stall types join `GIFTABLE`, and `giftLabel` and gift receipt learn `mehendi` and the new foods.

The help panel's stall list, the README and the page description change from "sixteen stalls" to "twenty-four stalls" and list the new ones.

## Carts, crowds and lights

- **Carts:** one cart builder (a wooden thela with an umbrella, a lamp, a sign and a vendor) with four looks: Chana jor garam, Bhutta, Gola, Buddhi ke baal. Carts cannot be bought from. The vendor calls out a line in a speech bubble when you come within 4 m, at most once every 20 s. Cart spots are listed in `layout.js`: ring slots 14 and 16, ring slot 18 when the brand stall is off, the two lane carts, and the two jhoola rows (about 24 carts in all).
- **Crowds:** ring walkers go from 22 to 40 (28 on phones) and use the outer band of the walkable ring (radius 37 to 44.5), away from the train lane. A new group of 16 walkers (10 on phones) wanders the jhoola ground between its rides, using `route` and the wander points in `layout.js`. Kids running with phuljhadis go from 4 to 6, circling at radius 12 to 16 in the bigger maidan.
- **Central pole and canopy:** the pole grows from 14 m to 20 m so the string lights and bunting from its top still reach every stall across a ring twice as wide.
- **Lamp posts:** one between every pair of ring slots, as today (about 28), plus posts along the corridor and around the jhoola ground every 16 m or so.
- **Diyas:** 96 around the inner edge of the parikrama path (from 56), 24 around the pole (from 16), and lines along both lane edges.
- **Light pools:** today's single painted 80 m pool texture becomes two textures: one for the lane and ring, one for the corridor and jhoola ground.
- **City:** the surrounding buildings move out to stay around the bigger map: a ring at radius 72 to 95 from the ring centre (skipping the lane and corridor directions), rows along both sides of the jhoola ground, and a back row behind it.
- **Ambient fireworks:** bursts move out to 150 to 230 m from the map centre, so they stay in the sky around the map, not over it.

## Multiplayer and compatibility

- **Old and new maps never share a room.** The Realtime channel name carries `LAYOUT.VERSION` (for example `phatake:v2:diya-4821`), so a player on a cached old page and a player on the new one do not see each other in the wrong places. Invite links (`/#diya-4821`) and room codes do not change.
- **Clamps use the new map.** Friends' positions are clamped with `clampToMap` instead of today's fixed ±40 / −90..20 box, and crackers with `clampToMaidan`. Decor (diyas, rangoli, kandils) is clamped to the map and dropped if `walkable` is false.
- **New presence field:** `m` carries your mehendi (0 none, 1 simple, 2 full). Older clients ignore it.
- **Ride indices stay stable.** The `RIDES` order is unchanged; part 2 appends new rides at the end.
- **Saved progress** (purse, bag, bangles, look, name) is untouched. Nothing saved holds a position.
- **Cache:** `layout.js` is loaded with `?v=2`. Vercel caches every file for 5 minutes, so the query keeps a fresh `index.html` from pairing with a stale layout.

## Performance

Target: at least 45 fps on a mid-range phone (Pixel 6a or iPhone 12 class) standing on the parikrama path facing the maidan with the canopy in view, and no worse than today on desktop. A `?fps=1` readout is added for measuring.

- **Stall lights:** today every stall carries its own `PointLight`, and every lit material pays for every light, so going from 16 stalls to 24 raises the lighting cost of every pixel by half. Instead, a fixed pool of 8 point lights moves to the 8 stall fronts nearest the camera, re-chosen every half second. The light count never changes, so shaders are not recompiled; stalls further away rely on the painted light pools and emissive signs.
- **Fog:** density goes from 0.014 to 0.011, so the far side of the 98 m ring reads as haze, not a wall, and the jhoola ground fades in as you walk up the corridor.
- **Instanced decorations:** the caps for bulbs (1,900 → 4,200), marigolds (4,600 → 9,000) and bunting flags (1,700 → 3,600) go up. These are instanced, one draw call each.
- **Ground:** one 440 × 440 m plane centred at z = −100 replaces today's 200 × 200 m plane, with vertex colours by `zoneAt`.
- **If the target is missed,** in this order: fewer ring walkers on phones, simpler counter props beyond 40 m (hidden), a lower bloom resolution on phones.

## Testing

**Node unit tests** for `layout.js` (`tests/js/layout.test.mjs`, run by `tests/all.sh` with the existing `node --test` line):

- Every one of today's 16 stalls and the 8 new ones appears exactly once in the ring order, KollabKit sits between Diya Ghar and Sivakasi Wale, and the brand stall sits between Mishra Halwai and Kismat Chakra.
- `walkable` is true at the spawn point, the gate, the maidan, every stall front, the corridor and every ride's boarding point, and false just outside each edge of the map.
- No two footprints overlap (rides, plots, carts, stall fronts), every footprint is inside its zone, and the cart rows stay at least 4 m from every footprint.
- `route` between 2,000 random pairs of walkable points: every point sampled every 0.5 m along the result is walkable and outside every ride footprint and fenced plot, and the route ends at the target.
- `clampToMap` and `clampToMaidan` return points inside their areas and leave inside points unchanged.

**Browser tests** (`tests/web`):

- Existing brand-slot and KollabKit tests pass unchanged (slot IDs and the `__pbTest` probe stay the same).
- New `test_layout.py`: the game boots with no console errors, the probe reports 24 stalls plus KollabKit, and the player can be placed at a far stall and at the back of the jhoola ground and talk to whatever is there.
- One test per new stall: open its dialogue, take the cheapest choice, and check the purse drops by the price and the expected thing happens (food in hand, kandil in the bag, mehendi on, game HUD shown, slideshow shown, photo preview shown).

**By hand,** before merging: walk the full tour on a phone and a laptop, check the fps target, and look at every coming-soon board and cart row in screenshots.

## Rollout

One branch and one pull request; Vercel deploys on merge. There are no database or Edge Function changes. Players on the old page keep playing in old-version rooms until they reload.
