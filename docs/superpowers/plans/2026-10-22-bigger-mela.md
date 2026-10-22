# Bigger Mela Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The bazaar grows to 229 × 136 m (a full tour takes about 3 minutes on foot) with 8 new stalls, carts, bigger crowds and fenced plots for the five rides of part 2.

**Architecture:** A new `layout.js` (same IIFE pattern as `brands.js`: `window.LAYOUT` in the browser, `module.exports` in Node) holds every position on the map and the pure functions that use them (`walkable`, `blocked`, `route`, `zoneAt`, clamps). `index.html` keeps all building and drawing and reads every number from `LAYOUT`. New stalls reuse the existing stall shell, dialog, food, gift and game systems.

**Tech Stack:** Static HTML/JS on Vercel, three.js r128 globals (already loaded), `node:test` for `layout.js`, Playwright for Python with system Chrome for browser tests (`tests/web/run.py`).

**Spec:** `docs/superpowers/specs/2026-10-22-bigger-mela-design.md`

## Global Constraints

- Every world position in `index.html` comes from `LAYOUT`. Literal coordinates remain only as local offsets inside a model (for example a counter prop at `(-1.1, 1.19, .55)` in a stall's group).
- Map numbers, exactly: ring centre `(0, -64)`; radii stall 49, front 46.7, walk 45.7, maidan 29, path 30.6 to 50.8; 30 slots, slot k at angle `π/2 + k·2π/30`; lane x ±6.4 from z = 10 to the ring; spawn `(0, 8)`; gate arch z = −14.6, half-width 7; corridor x ±7.6 to z = −124; jhoola ground x −68..68, z −219..−121; train lane radius 31 to 35.
- Slot IDs stay `stall-ring-b` and `hoarding-entry-b`, kinds `premium_stall` and `hoarding`. No database, Edge Function or admin page changes.
- Prices, exactly: Steamed momos ₹40, Fried momos ₹50, Pav bhaji ₹50, Extra makhan ₹60, Ganne ka ras ₹20, Nimbu-adrak ras ₹25, Akash kandil ₹50, Simple bel ₹30, Full haath ₹60, Dabba Giraao ₹20 for 3 balls (₹6 a tin, ₹20 bonus for all six), Bioscope ₹10, Photo ₹30.
- Every voice line is a `[roman, देवनागरी]` pair, like the existing `L` table.
- Phones are `TOUCH` (`matchMedia('(pointer:coarse)')`), as today. Phone counts: 28 ring walkers, 10 jhoola walkers.
- Realtime channel names carry the layout version: `phatake:v2:<room>` (`phatake:v2:open` for the open bazaar). Script tags load `layout.js?v=2` and `net.js?v=2`.
- Tests never touch the live Supabase project (as today in `tests/web/run.py`).
- Code style matches `index.html` and `brands.js`: dense, short names, comments only for the non-obvious.

## Review Focus

1. **Tap-to-walk across the whole map** (spawn to the back of the jhoola ground, the maidan to a far stall): the player arrives, and "Can't walk straight there" never shows on a route `route` produced (test in Task 3).
2. **A friend far from today's map box**, for example at `(-60, -215)`: their avatar is drawn where they are, not snapped to x ±40 / z ≥ −90 (tests in Tasks 1 and 3).
3. **A photo that cannot be made** (reading pixels throws, or the browser blocks the download): a toast explains, the ₹30 is not taken, and the game keeps running (test in Task 12).
4. **Leaving mid-way** through a Bioscope show or a Dabba Giraao game (Leave button, Esc, or the round ends): the camera returns, the HUD and overlay close, and the controls work again (tests in Tasks 10 and 11).
5. **Phones:** on a touch device the reduced crowd counts apply and the game still boots with no page errors (test in Task 5).

---

### Task 1: `layout.js`: map data, slots, zones and clamps

**Files:**
- Create: `layout.js`, `tests/js/layout.test.mjs`
- Modify: `tests/all.sh` (rename the `brands.js` line's label to `js`; the glob already picks up the new test file)

**Interfaces:**
- Produces `LAYOUT` (browser `window.LAYOUT`, Node `module.exports`), plain data plus functions:
  - `VERSION: 2`
  - `C: {x:0, z:-64}`, `RING: {stall:49, front:46.7, walk:45.7, maid:29, path:30.6, pathOut:50.8}`, `TRAIN: {r0:31, r1:35}`, `NPC_BAND: {r0:37, r1:44.5, lanes:[43, 39.5]}`, `SLOTS: 30`
  - `ORDER: (string|null)[]` of length 30, indexed by slot k, exactly the spec's ring table. `null` at k 0 and 15 (openings); KollabKit is `'kollabkit'`, the brand stall `'brand:stall-ring-b'`, carts `'cart'`, stalls by their exact `STALLS` name (`'Momo Point'`, `'Mehendi Corner'`, `'Dabba Giraao'`, `'Bombay Pav Bhaji'`, `'Bioscope'`, `'Ganne ka Ras'`, `'Photo Studio'`, `'Akash Kandil'` for the new ones).
  - `ENTRY: {hx:6.4, z1:10}`, `SPAWN: {x:0, z:8}`, `GATE: {z:-14.6, hx:7}`, `NORTH: {hx:7.6, z0:-124}`, `JG: {x0:-68, x1:68, z0:-219, z1:-121}`, `BOUNDS: {x0:-70, x1:70, z0:-221, z1:12}`
  - `WHEEL: {x:0, z:-127, hx:4.6, hz:1.6}`; `RIDES: {carousel:{x:-48, z:-144, r:4}, columbus:{x:-45, z:-196, hx:5.8, hz:2}, chairs:{x:0, z:-201, r:5.6}}`
  - `PLOTS: {id, name, hi, x, z, w, d}[]`: `breakdance` Break Dance ब्रेक डांस (−23, −166, 18×18); `mautkakuan` Maut ka Kuan मौत का कुआँ (23, −164, 20×20); `droptower` Drop Tower ड्रॉप टावर (55, −140, 10×10); `dodgem` Bumper Cars बंपर कार (44, −198, 24×16)
  - `OPEN_PLOTS: {x, z, w, d}[]`: (−55, −168), (55, −166), (−22, −211), each 14×14
  - `CARTS: {x, z, ry, kind}[]`: ring slots 14 and 16 at radius `RING.stall - .6` facing the centre; lane `(±9, 4)` facing the lane; row A z −181, x −48..48 step 8; row B z −149, x −30..30 step 8. `kind` cycles `chana`, `bhutta`, `gola`, `buddhi` in list order.
  - `BRAND_CART: {x, z, ry, kind:'chana'}` at slot 18 (shown only while the brand stall is off)
  - `KK: {k:12, entry:{x:10.5, z:-4, ry:-.7, w:4.4}, jhoola:{x:-40, z:-214, ry:.25, w:6.4}}`
  - `BRAND: {'stall-ring-b':{kind:'premium_stall', k:18}, 'hoarding-entry-b':{kind:'hoarding', x:-10.5, z:-4, ry:.7, w:4.4}}`
  - `BW: {x:-24.7, z:-35.2}`, `DHOL: {x:12, z:-28}` (radius 38 from the centre, outside the train lane)
  - `slotAt(k: number, r: number) → {x, z, ry, a}`: `a = π/2 + k·2π/SLOTS`, `ry = atan2(-cos a, -sin a)` (faces the centre, as today's `buildStall`)
  - `zoneAt(x, z) → 'maidan'|'ring'|'lane'|'corridor'|'jhoola'|'outside'`: ring disc first (radius < `RING.walk`; `'maidan'` when < `RING.maid`), then lane, corridor, jhoola ground
  - `clampToMap(x, z) → {x, z}` (into `BOUNDS`), `clampToMaidan(x, z) → {x, z}` (onto radius `RING.maid` when outside it)

- [ ] **Step 1: Write failing tests** in `tests/js/layout.test.mjs` (load with `createRequire(import.meta.url)('../../layout.js')`, as `brands.test.mjs` does):
  - `ORDER.length === 30`, `ORDER[0] === null`, `ORDER[15] === null`.
  - Each of the 24 stall names (today's 16 plus the 8 new) appears exactly once. `ORDER.indexOf('kollabkit')` is `indexOf('Diya Ghar') + 1` and `indexOf('Sivakasi Wale') - 1`. `'brand:stall-ring-b'` sits between `'Mishra Halwai'` and `'Kismat Chakra'`. `'cart'` is at 14 and 16.
  - `slotAt(0, 49)` is `{x≈0, z≈-15, ry≈π}`. `slotAt(15, 49).z ≈ -113`.
  - `zoneAt`: `(0, 8)` lane, `(0, -54)` maidan, `(0, -24)` ring, `(0, -116)` corridor, `(0, -180)` jhoola, `(100, 0)` outside, `(0, 30)` outside.
  - `clampToMap(-60, -215)` returns it unchanged; `clampToMap(500, -500)` returns `{x:70, z:-221}`. `clampToMaidan(0, -24)` lands at radius 29; `clampToMaidan(0, -60)` is unchanged.
  - Footprints (wheel, the three rides, the 4 plots, the 3 open plots, jhoola carts as 1.1 m circles): no two overlap; each lies inside the jhoola ground inset by 1 m; every cart in rows A and B is at least 4 m from every ride, wheel and plot footprint edge.
  - `BW`, `DHOL` and every cart are outside the train band (radius `TRAIN.r0 - .5` to `TRAIN.r1 + .5` from `C`), and `NPC_BAND.r0 > TRAIN.r1`.
- [ ] **Step 2:** `node --test tests/js/layout.test.mjs`. Expected: FAIL (`Cannot find module '../../layout.js'`).
- [ ] **Step 3:** Implement `layout.js` as in Interfaces. Generate `CARTS` and `BRAND_CART` from `slotAt` and the row rules, not as hand-typed coordinates.
- [ ] **Step 4:** `node --test tests/js/layout.test.mjs`. Expected: PASS. `node --test "tests/js/*.test.mjs"`: brands tests still PASS.
- [ ] **Step 5:** Commit: `feat(layout): map data, slots, zones and clamps for the 2x mela`.

### Task 2: `layout.js`: walking and routing

**Files:**
- Modify: `layout.js`, `tests/js/layout.test.mjs`

**Interfaces:**
- Consumes: Task 1 data.
- Produces on `LAYOUT`:
  - `walkable(x, z) → boolean`: the rules of today's `walkable` (`index.html:2354`) with the new numbers: ring disc radius < `RING.walk` but > .6 (the pole); lane `|x| < ENTRY.hx && z > C.z + RING.walk - 2.5 && z < ENTRY.z1`; corridor `|x| < NORTH.hx && z < C.z - RING.walk + 2.5 && z > NORTH.z0`; jhoola ground rectangle.
  - `blocked(x, z) → boolean`: inside the wheel rectangle, a ride footprint, a fenced plot (`PLOTS`, not `OPEN_PLOTS`) or a cart circle (r 1.1).
  - `route(fx, fz, tx, tz) → {x, z}[]`: intermediate waypoints only (start and target excluded), the same contract `walkTo` uses today. Empty when the straight line is already clear.
  - `WANDER: {x, z}[]`: points on a 10 m grid inside the jhoola ground with at least 2 m clearance from anything `blocked`, for the jhoola walkers (Task 5).

- [ ] **Step 1: Write failing tests:**
  - `walkable` is true at `SPAWN`, `(0, GATE.z)`, `(0, -60)`, every `slotAt(k, RING.front - 1)` for a stall slot, `(0, -116)`, `(0, -165)`, `(60, -215)`. It is false at `(0.3, -64)` (the pole), `(0, 11)`, `(7, 0)`, `(10, -116)`, `(69, -150)`, `(0, -220)`.
  - `blocked` is true at the wheel centre, each ride centre, each plot centre and each jhoola cart; false at each open plot centre and at `(0, -165)`.
  - **Property test:** with a seeded PRNG (mulberry32, seed 42), draw 2,000 pairs of points where `walkable && !blocked`. For each, `route` gives a path (start, waypoints, target) where every point sampled every 0.5 m along every segment is `walkable`, not `blocked`, and at least 1 m from the pole. The test must finish in under 20 s.
  - `route(0, 8, 10, -214)` passes through the corridor (some sampled point has `zoneAt === 'corridor'`).
- [ ] **Step 2:** Run the test file. Expected: FAIL (`walkable is not a function`).
- [ ] **Step 3:** Implement. `route` is grid A* on a 1 m grid over `BOUNDS`, built lazily once: a cell is open when `walkable` is true and `blocked` is false at its centre and at four points 0.45 m away. Use 8 neighbours with no corner cutting, then shorten the path by line-of-sight (sampled every 0.25 m against the same open test), and drop the first and last points. If the target cell is closed, aim for the nearest open cell. If the start cell is closed (the player is pressed against a footprint), start from the nearest open cell.
- [ ] **Step 4:** Run the tests. Expected: PASS in under 20 s.
- [ ] **Step 5:** Commit: `feat(layout): walkable, blocked and A* routing over the bigger map`.

### Task 3: The game on the new map

**Files:**
- Modify: `index.html` (layout constants ~590–598, world builders ~656–870, people ~947–973, rides ~1010–1114, KollabKit and brand slots ~1115–1241, `updLoc`/mini-map ~1948–1973, network ~2229–2243, ambient life ~2148–2211, `blocked`/`walkable`/`route`/`walkTo` ~2352–2373, `frame` ~2429/2472, `boot` ~2486–2503, script tags ~415–420), `net.js:22` (channel name)
- Create: `tests/web/test_layout.py`

**Interfaces:**
- Consumes: `LAYOUT` (Tasks 1–2).
- Produces in `index.html`:
  - `const LY=window.LAYOUT`. `C`, `RING`, `GATE_Z=LY.GATE.z`, `ENTRY`, `NORTH`, `JG` alias `LY` fields, and `SLOT=Math.PI*2/LY.SLOTS`. `WHEEL`, `CAR`, `COL` and `CS` keep their shape fields (`hub`, `R`, `N`, `piv`, `arm`, `top`, `L`, `phi`) and take `x`/`z` from `LY`.
  - Stalls are placed by name: `s.ang` comes from `slotAt(LY.ORDER.indexOf(s.name), ...).a`. A stall missing from `ORDER` throws at boot.
  - `walkable`, `route` and the ride part of `blocked` call `LY`. Game `blocked` = NPCs (unless `walkTest` is set) || `LY.blocked` || balloon-wala || dhol-wala. `RIDES[i].block` is removed; `crossesWheel`, `RN` and `CO` are deleted.
  - `updLoc` switches on `LY.zoneAt`: `lane` → "Bazaar gate"; `maidan` → "The maidan"; `ring` → the nearest stall within 5.5 m, else "Parikrama path"; `corridor` → "Giant wheel"; `jhoola` → the nearest ride, or plot name within 8 m, else "Jhoola ground". `crowdTick` treats everything but `maidan` as in the lanes.
  - The `__pbTest` probe gains `stalls() → string[]` and `walk(x, z, maxSeconds) → {arrived, x, z, toast}`. `walk` calls `walkTo(x, z, .45)`, then steps `movePlayer(1/30)` up to `maxSeconds*30` times with `walkTest=true` (NPCs ignored) and returns the last `#toast` text.
- Rebuilt to the spec's numbers, all from `LY`:
  - **Ground:** a 440 × 440 plane at z −100 with 110 × 110 segments, vertex colours by today's radius rule; brick ring from `RING.path` to `RING.pathOut`; lane and corridor brick strips; centre rangoli radius 8.
  - **Gate and lane:** gate pillars at ±`GATE.hx` with the beam spanning them; lane lights, bunting and poles every 3 m across ±(`hx` + 1); lane kandils every 4.5 m; lane diyas every 2.2 m at x ±(`hx` + .4).
  - **Ring:** pole height 20 with canopy strings to every stall (sag 3); a lamp post at every `k + .5` (30 posts) at radius `walk + .7`, with lamp-to-lamp strings when posts are under 12 m apart; 96 path diyas at `path - .35`, 24 pole diyas at radius 8.
  - **Light pools:** two painted planes (lane and ring: 130 m square centred at `(0, -40)`; corridor and jhoola ground: 140 m square centred at `(0, -170)`), 1024² canvases.
  - **City:** a ring at radius 72–95 from `C` skipping the lane (`z > C.z + 50 && |x| < 20`) and jhoola directions (`z < C.z - 40 && |x| < 75`); lane-side rows at |x| 14–18 from z 18 to −12, leaving gaps at the two hoardings; rows at |x| 80–95 beside the jhoola ground; a back row at z −232..−238.
  - **Rides and jhoola ground:** the floor fills `JG`; lamp posts every ~16 m around the inset edge, skipping the corridor mouth (|x| < 9), with string lights and bunting between them; ride positions from `LY.RIDES`, the wheel from `LY.WHEEL`.
  - **KollabKit and brand slots:** the stand at `slotAt(LY.KK.k, RING.stall - .4)`; the hoardings from `LY.KK.entry`/`.jhoola`; `SLOT_DEFS` from `LY.BRAND`. `stall-ring-b` stands at `slotAt(18, RING.stall - .4)`. `GAP_LAMPS` is removed; `showSlot` toggles `BRAND_CART`'s group instead, which is built in Task 4 (until then, `null`-safe).
  - **People:** the balloon-wala and the dhol-wala at `LY.BW`/`LY.DHOL`; ring walkers spawn and wander in `NPC_BAND` and use its `lanes` in place of today's 19/17.4; kids circle at radius `12 + i*1.2`.
  - **Everything else:** ambient bursts at 150–230 m from `(0, -100)`, height 35–70. Instanced caps: bulbs 4200, marigolds 9000, flags 3600. The ambient ember spawn radius is `RING.walk`. Mini-map bounds are `MB=LY.BOUNDS`, with plots drawn as outlined rectangles and stall dots radius 4. The intro camera sits about 14 m behind the spawn, looking up the lane at the gate (tune by screenshot). The boot bursts move over the maidan.
  - **Network:** avatar targets use `LY.clampToMap`; crackers use `LY.clampToMaidan`; decor is clamped to the map and dropped when `!LY.walkable`.
  - **`net.js`:** the channel name is `'phatake:'+(window.LAYOUT?'v'+LAYOUT.VERSION+':':'')+(name||'open')`.
  - **Script tags:** `<script src="layout.js?v=2">` before `net.js`, and `net.js?v=2`. If `!window.LAYOUT`, show the same `.err` message pattern as the three.js check ("The bazaar map did not load. Check your connection and reload.") and stop.

- [ ] **Step 1: Write failing browser tests** in `tests/web/test_layout.py` (use `open_game` from `run.py`):
  - `test_boots_on_the_new_map`: no page errors; `__pbTest.player()` ≈ `[0, 8]`; `set(__pbTest.stalls())` equals today's 16 names.
  - `test_walk_from_the_gate_to_the_back_of_the_jhoola_ground`: `__pbTest.walk(10, -214, 120)` gives `arrived: true` and a toast without "Can't walk".
  - `test_walk_across_the_ring`: from the spawn to the front of Mishra Halwai (`slotAt(17, 45)`), then from `(0, -60)` (the maidan) to Columbus Naav's boarding point; both arrive.
  - `test_friend_far_away_is_drawn_where_they_are`: from Python, call `page.evaluate` on a probe `__pbTest.peer({p:[-60,-215,0], n:'Far', h:40})`, which feeds one fake presence through the same code path as `onPeers`. The avatar's target is `(-60, -215)`. Add the `peer` probe in Step 3.
  - Existing `test_slots.py` and KollabKit tests unchanged.
- [ ] **Step 2:** `python3 tests/web/run.py layout`. Expected: FAIL.
- [ ] **Step 3:** Implement as in Interfaces. Factor the body of the `onPeers` per-presence update into `applyPresence(p, pr)` so the probe and `onPeers` share it.
- [ ] **Step 4:** `python3 tests/web/run.py`. Expected: all PASS. `node --test "tests/js/*.test.mjs"`: PASS.
- [ ] **Step 5:** Screenshots (Playwright, 1280×800) from the spawn, mid-lane, the ring path, the maidan, the corridor and three spots in the jhoola ground. Check by eye: nothing floating or overlapping, the gate frames the lane, the canopy reaches every stall, the city surrounds the map, and the hoardings face the lane. Fix and re-shoot.
- [ ] **Step 6:** Commit: `feat(game): the bazaar on the 2x layout from layout.js`.

### Task 4: Carts and coming-soon plots

**Files:**
- Modify: `index.html` (new `/* carts and plots */` section after the brand slots; `L` table; `frame`; `boot`), `tests/web/test_layout.py`

**Interfaces:**
- Consumes: `LY.CARTS`, `LY.BRAND_CART`, `LY.PLOTS` and `showSlot` (Task 3).
- Produces: `CARTS` (built objects `{g, keeper, kind, x, z, calledAt}`), `BRAND_CART` (one of them, hidden while `stall-ring-b` is on), `buildCarts()`, `buildPlots()`, `cartTick(dt)` (call-outs), and probes `carts() → {visible:number}` and `plots() → string[]` (board names).
- Cart look per kind: a wooden thela (box on two wheels), an umbrella in the kind's colour, a hanging lamp (glow sprite, no light), a `textSprite` name board, and a vendor (`person({plain:true})`):

| kind | Board | Umbrella | Call-outs |
|---|---|---|---|
| chana | Chana jor garam | `#e11d48` | `['Chana jor garam, babu! Masaledar!','चना जोर गरम, बाबू! मसालेदार!']`, `['Ek pudiya lo, maza aa jayega!','एक पुड़िया लो, मज़ा आ जाएगा!']` |
| bhutta | Bhutta | `#16a34a` | `['Bhutta garam, nimbu namak wala!','भुट्टा गरम, नींबू नमक वाला!']`, `['Koyle pe seka, ekdum taaza!','कोयले पे सेका, एकदम ताज़ा!']` |
| gola | Gola | `#0ea5e9` | `['Gola lo, rang birangi baraf!','गोला लो, रंग बिरंगी बर्फ़!']`, `['Kala khatta ya rose, bolo!','काला खट्टा या रोज़, बोलो!']` |
| buddhi | Buddhi ke baal | `#ec4899` | `['Buddhi ke baal, gulabi gulabi!','बुढ्ढी के बाल, गुलाबी गुलाबी!']`, `['Muh mein jaate hi gayab!','मुँह में जाते ही गायब!']` |

- Call-out: when the player is within 4 m and 20 s have passed since that cart's last call, `say` a random line in a bubble (reuse the keeper-bubble pattern).
- Plot: a rope fence on posts at the 4 corners plus mid-posts every ~5 m, rope as thin cylinders at 0.8 m, small bulbs on the posts, and one painted board (canvas: "Jald aa raha hai" / "जल्द आ रहा है", then the plot `name` and `hi`) on two legs at the plot's south edge, facing south.

- [ ] **Step 1: Write failing tests:**
  - `test_carts_stand_where_the_layout_says`: `carts().visible === LAYOUT.CARTS.length + 1` with a fixture whose `slots` list leaves out `stall-ring-b` (the slot is off), and `=== LAYOUT.CARTS.length` with the default fixture (the slot is on).
  - `test_coming_soon_boards`: `set(plots())` is `{'Break Dance','Maut ka Kuan','Drop Tower','Bumper Cars'}`.
  - `test_cart_calls_out_once`: after placing the player 2 m from the first jhoola cart and waiting 1.2 s, a bubble exists on its vendor; after 3 more seconds, no second call-out has happened.
- [ ] **Step 2:** `python3 tests/web/run.py layout`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement as in Interfaces.
- [ ] **Step 4:** Run `python3 tests/web/run.py`. Expected: PASS. Take a jhoola-ground screenshot and check the boards are readable from the corridor mouth.
- [ ] **Step 5:** Commit: `feat(game): food carts and coming-soon ride plots`.

### Task 5: Bigger crowds

**Files:**
- Modify: `index.html` (`buildPeople`, `npcTarget`, `npcStep`, `updPeople`, probe), `tests/web/test_layout.py`

**Interfaces:**
- Consumes: `LY.NPC_BAND`, `LY.WANDER`, `LY.route`, `LY.walkable`, `LY.blocked`.
- Produces: `NPCS` entries gain `zone:'ring'|'jhoola'`. Counts are ring 40 / jhoola 16 / kids 6, or 28 / 10 / 6 when `TOUCH`. Probes `crowd() → {ring, jhoola, kids}` and `stepPeople(seconds)`, which runs `updPeople(1/30)` repeatedly.
- Jhoola walkers pick a random `WANDER` point, follow `LY.route` waypoints with the same avoidance and personal-space code as ring walkers, then wait 2–6 s facing the nearest ride or plot. They spawn on random `WANDER` points. If stuck for 4 s, they pick again (today's rule). The ring-walker clamp to the band applies only to `zone==='ring'`.

- [ ] **Step 1: Write failing tests:**
  - `test_crowd_sizes`: `crowd()` is `{ring:40, jhoola:16, kids:6}` at 1280×800.
  - `test_crowd_sizes_on_a_phone`: a context with `has_touch=True, is_mobile=True` and viewport 390×844 gives `{ring:28, jhoola:10, kids:6}` and no page errors (add an `is_touch` option to `open_game`).
  - `test_jhoola_walkers_stay_on_open_ground`: after `stepPeople(30)`, every jhoola walker's position is `LAYOUT.walkable` and not `LAYOUT.blocked` (read positions through a `crowdPos()` probe).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `python3 tests/web/run.py`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(game): bigger crowds in the ring and on the jhoola ground`.

### Task 6: Performance: light pool, fog, fps readout

**Files:**
- Modify: `index.html` (`buildStall` light ~757, renderer/fog ~567, `frame`, a new `#fps` element and CSS), `tests/web/test_layout.py`

**Interfaces:**
- Produces: `STALL_LIGHTS` (8 `PointLight(0xffb060, 1.5, 9, 1.6)`, created once at boot); `assignStallLights()`, called every 0.5 s, which moves them to 2.5 m above and 1.1 m in front of the 8 stall fronts nearest the camera (the stall-local `(0, 2.5, 1.1)` today's light uses). No `PointLight` is created inside `buildStall` any more. Fog base density is 0.011 (`frame` adds the smoke term on top as today). With `?fps=1`, a small fixed `#fps` readout shows a frame rate averaged over 1 s.

- [ ] **Step 1: Write failing tests:**
  - `test_light_count_is_fixed`: count `PointLight`s in the scene through a `lights()` probe; it equals the count after boot and stays equal after `walk(10, -214, 120)`. With 24 stalls it must be 13 (8 pool + 4 flashes + 1 wash).
  - `test_nearest_stall_is_lit`: place the player at Pappu Chaat's front; after 0.6 s some pool light is within 3 m of that stall's front.
  - `test_fps_readout`: `?test=1&fps=1` shows `#fps` with a number within 2 s; without `fps=1` it is absent.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `python3 tests/web/run.py`. Expected: PASS.
- [ ] **Step 5: Measure.** With Playwright, record the `#fps` value after 5 s at the ring path facing the maidan on desktop (1280×800), and again with mobile emulation (390×844, `has_touch`) plus CDP `Emulation.setCPUThrottlingRate` 4. Note the numbers for the PR. If the throttled phone run is under 45, apply the spec's fallbacks in order (fewer ring walkers on phones, hide counter props beyond 40 m, lower bloom resolution on phones) and re-measure.
- [ ] **Step 6:** Commit: `perf(game): fixed pool of stall lights, lighter fog, fps readout`.

### Tasks 7–12: common shape for every new stall

Each new stall task adds one `STALLS` entry (name, `tag`, `col`, `type`, `cat`, `pitch`, `greet`), its counter props in `buildStall`'s type branch, its `renderChoices` branch, its `L` lines, and (where giftable) `GIFTABLE`, `giftLabel` and `recvGift` entries. The stall's name is already in `LY.ORDER`. Each task's browser tests go in `tests/web/test_stalls.py`, using a shared helper `talk_to(page, name)`: it places the player at that stall's front through a `__pbTest.at(name)` probe (added in Task 7) and opens its dialog. Every task ends by running `python3 tests/web/run.py` (all PASS), taking a screenshot of the stall at its front, and committing.

### Task 7: Food stalls: Momo Point, Bombay Pav Bhaji, Ganne ka Ras

**Files:**
- Modify: `index.html` (`STALLS`, `L`, `buildStall`, `renderChoices`, `FOODS`, `GIFTABLE`, probe)
- Create: `tests/web/test_stalls.py`

**Interfaces:**
- Consumes: `orderFood(s, id, price, line, to)`, `FOODS` (bites, `snd`, `make()` with `parts`/`shrink`/`liq`, as today).
- Produces: `__pbTest.at(name)`, `__pbTest.food() → {id, left}|null`, and `__pbTest.coins()`.

| Stall | tag | col | type | cat | pitch | greet |
|---|---|---|---|---|---|---|
| Momo Point | Steamed · Fried | `#e2384c` | `momo` | Khau gali | 1.1 | `['Momos garma garam, chutney ekdum teekhi!','मोमोज़ गरमा गरम, चटनी एकदम तीखी!']` |
| Bombay Pav Bhaji | Makhan maar ke | `#c2410c` | `pavbhaji` | Khau gali | .95 | `['Pav bhaji, makhan maar ke! Bambai ka swaad yahin!','पाव भाजी, मक्खन मार के! बंबई का स्वाद यहीं!']` |
| Ganne ka Ras | Taaza nikala | `#65a30d` | `ganna` | Khau gali | 1.05 | `['Ganne ka ras, seedha machine se! Thanda thanda!','गन्ने का रस, सीधा मशीन से! ठंडा ठंडा!']` |

- Choices and foods (`FOODS` id: name, bites, snd, served line):
  - Momo Point: `momo` "Steamed momos", 3, `bite`, `L.momo=['Steam wale momos, haath jala lena mat!','स्टीम वाले मोमोज़, हाथ जला लेना मत!']`, ₹40. `fried` "Fried momos", 3, `crunch`, `L.fried=['Fried momos, kurkure aur garam!','फ्राइड मोमोज़, कुरकुरे और गरम!']`, ₹50.
  - Pav Bhaji: `pavbhaji` "Pav bhaji", 4, `bite`, `L.bhaji=['Garam bhaji, sika hua pav. Khao!','गरम भाजी, सिका हुआ पाव। खाओ!']`, ₹50. `makhan` "Makhan pav bhaji", 4, `bite`, `L.makhan=['Extra makhan, ekdum dil se!','एक्स्ट्रा मक्खन, एकदम दिल से!']`, ₹60.
  - Ganne ka Ras: `ganna` "Ganne ka ras", 4, `sip`, `L.ganna=['Ek glass ras, taazgi bhar dega!','एक ग्लास रस, ताज़गी भर देगा!']`, ₹20. `nimbu` "Nimbu-adrak ras", 4, `sip`, `L.nimbu=['Nimbu aur adrak daal diya, ab piyo!','नींबू और अदरक डाल दिया, अब पियो!']`, ₹25.
- Hand models: three small dumplings on a leaf `dona` (`parts`); a steel plate with an orange bhaji mound (`shrink`) and two pav (`parts`) plus a butter cube for `makhan`; an open glass cylinder (transparent) with green-gold liquid (`liq`).
- Counters: a stacked bamboo steamer (three short cylinders and a lid) with `steamL` above it and a red chutney bowl; a wide flat tawa with a bhaji mound, a butter block and `steamL`; a cane crusher (a box with a large wheel that turns in `frame`, like `s.spinners`) and a bundle of green-yellow canes. All counter props are clickable through `userData.keeper`.
- All three types join `GIFTABLE`.

- [ ] **Step 1: Write failing tests** (one per stall): talk to the stall, click the first choice; the purse drops by 40 / 50 / 20, and `food().id` is `momo` / `pavbhaji` / `ganna`. Pressing `F` once makes `left` drop by 1. Clicking the second choice while holding food shows the "Finish your … first" toast and leaves the purse unchanged.
- [ ] **Step 2:** `python3 tests/web/run.py stalls`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all browser tests. Expected: PASS. Screenshot each stall.
- [ ] **Step 5:** Commit: `feat(stalls): Momo Point, Bombay Pav Bhaji and Ganne ka Ras`.

### Task 8: Akash Kandil

**Files:**
- Modify: `index.html` (`ITEMS`, `ORDER`, `ICON`, `STALLS`, `L`, `buildStall`, `renderChoices`, `placeDecor`, `LAMPS`), `tests/web/test_stalls.py`

**Interfaces:**
- Consumes: `buy(k, s, to)`, the decor tap flow (`placeDecorHere`) and decor sharing through `share()` and the received-shots path.
- Produces: `ITEMS.kandil = {name:'Akash Kandil', en:'Paper lantern', price:50, pack:1, box:'#f59e0b', decor:true}`, with `'kandil'` appended to `ORDER` and an `ICON.kandil` SVG (a five-point star lantern with tassels). `hangKandil(x, z) → {x, y, z, onPost:boolean}` hangs from the nearest `LAMPS` post within 5 m (just under the lantern box, offset 0.4 m sideways) or else on a new 3 m bamboo pole at `(x, z)`. `placeDecor('kandil', x, z)` calls it. `HUNG` keeps placed kandils and is capped at 60 (the oldest is removed from the scene). Probe: `kandils() → {n, last:{onPost}}`.
- Stall: `Akash Kandil`, tag `Roshni upar tak`, col `#f59e0b`, type `kandil`, cat `Pooja aur sajavat`, items `['kandil']`, pitch 1.0, greet `['Akash kandil lo, ghar ke bahar taango, roshni door tak!','आकाश कंदील लो, घर के बाहर टांगो, रोशनी दूर तक!']`. Choice `Akash kandil · ₹50` → `buy('kandil', s, to)` then `talk(s, L.kandilBuy)`, where `L.kandilBuy=['Kisi lamp post pe taango, sab dekhenge!','किसी लैंप पोस्ट पे टांगो, सब देखेंगे!']`. Counter: a row of five small hanging kandils (reuse `kandil()`, scaled 0.6) on a rod, all clickable `userData.buy='kandil'`. The type joins `GIFTABLE`.

- [ ] **Step 1: Write failing tests:**
  - Buying drops the purse by 50 and the bag has 1 kandil.
  - Placing it next to a ring lamp post gives `last.onPost === true`; placing it at `(0, -150)` in the jhoola ground gives `false` (a new pole).
  - Placing 61 kandils (put them in the bag through the probe) leaves `n === 60`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all browser tests. Expected: PASS. Screenshot a lamp post with a kandil.
- [ ] **Step 5:** Commit: `feat(stalls): Akash Kandil, lanterns that hang on the lamp posts`.

### Task 9: Mehendi Corner

**Files:**
- Modify: `index.html` (`S` state, `STALLS`, `L`, `buildStall`, `renderChoices`, `mkArm`/`renderBangles` area, `makeAvatar`, `pushPresence`, `applyPresence`, gifts), `tests/web/test_stalls.py`

**Interfaces:**
- Produces: `S.mehendi: 0|1|2`, stored with `store.set('mehendi', n)`. `mehendiTex(n)` is a canvas texture (paisley and vine pattern; 2 is denser and covers the fingers), applied to the first-person hand and forearm skin meshes through `renderMehendi()`. Presence gains `m: S.mehendi`. Avatars tint their hand spheres `#b5651d` (1) or `#8b3a0e` (2) from `pr.m`, ignoring anything but 1 or 2. Gift kind `'mehendi'` with `x` 1 or 2: `giftLabel` "simple mehendi" / "full-hand mehendi"; receipt sets `S.mehendi=max(S.mehendi, x)` with the tail " Look at your hands!". Probe: `mehendi() → n`.
- Stall: `Mehendi Corner`, tag `Haathon pe rang`, col `#9a3412`, type `mehendi`, cat `Shringar`, pitch 1.25, greet `['Mehendi lagwa lo, rang gehra chadhega!','मेहंदी लगवा लो, रंग गहरा चढ़ेगा!']`. Choices: `Simple bel · ₹30` (1), `Full haath · ₹60` (2). Buying for yourself at the level you already have, or lower, is refused with `L.already2=['Pehle wali toh abhi taazi hai!','पहले वाली तो अभी ताज़ी है!']`. `L.mehendi=[['Kitna sundar design bana!','कितना सुंदर डिज़ाइन बना!'],['Sookhne do, phir dekhna rang!','सूखने दो, फिर देखना रंग!']]`. Counter: cone tubes in a cup, a cushion and a design book (an open box with a canvas-texture page). The type joins `GIFTABLE`.

- [ ] **Step 1: Write failing tests:** buying "Full haath" drops the purse by 60 and `mehendi() === 2`, which survives a reload. Buying "Simple bel" afterwards leaves the purse unchanged. A fake peer with `m:2` (`__pbTest.peer`) gets hand spheres coloured `#8b3a0e`; with `m:'x'` they keep skin colour.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all browser tests. Expected: PASS. Screenshot the first-person hands with mehendi and bangles together.
- [ ] **Step 5:** Commit: `feat(stalls): Mehendi Corner, mehendi that friends can see`.

### Task 10: Dabba Giraao

**Files:**
- Modify: `index.html` (`STALLS`, `L`, `buildStall`, `renderChoices`, `interactables` verb, `startGame`, `updGameHud`, `gameTap`, `finishGame`, `cleanupGame`, `frame`), `tests/web/test_stalls.py`

**Interfaces:**
- Consumes: the `GAME` flow (`startGame` charges ₹20 and focuses the camera on `s.camPos`/`s.camLook`).
- Produces: `s.tins` (six `{m, row, col, up}` on a shelf: rows of 3, 2 and 1, each tin resting on the two below), `s.aim` (a glowing ring marker that sweeps over the pyramid in `frame`, like the ring-toss marker), and `GAME.type==='cans'` with `GAME.left=3`. On a tap, a ball flies (`ENT` type `ballfly`, 0.5 s) to the marker. On landing, the nearest standing tin within 0.16 m of the marker falls, along with every standing tin that rests on a fallen one. Each fallen tin pays ₹6. When all six are down, add ₹20 once and say `L.cansAll`. HUD: `Balls <n> · Won ₹<w>`, hint `Tap when the glowing ring is on the tins. ₹6 a tin, ₹20 more for all six.` `cleanupGame` stands the tins back up and removes the balls. Probe: `game() → {on, type, left, won}` and `aimAt(row, col)` (puts the marker on that tin, test only).
- Stall: `Dabba Giraao`, tag `3 balls · ₹20`, col `#0ea5e9`, type `cans`, cat `Khel tamasha`, pitch 1.1, greet `['Dabba giraao, inaam pao! Teen ball, bees rupaye.','डब्बा गिराओ, इनाम पाओ! तीन बॉल, बीस रुपये।']`. Choice `Play · ₹20 for 3 balls`. `L.cansHit=[['Dhadaam! Gir gaye!','धड़ाम! गिर गए!'],['Kya nishana hai!','क्या निशाना है!']]`, `L.cansMiss=[['Bagal se nikal gayi!','बगल से निकल गई!'],['Thoda neeche, beta!','थोड़ा नीचे, बेटा!']]`, `L.cansAll=['Saare gira diye! Bonus pakka!','सारे गिरा दिए! बोनस पक्का!']`, `L.cansEnd=['Phir se? Is baar saare!','फिर से? इस बार सारे!']`. The interactable verb is `Play`; `camL`/`lookL` frame the shelf like Ring Phenko's.

- [ ] **Step 1: Write failing tests:**
  - Play: the purse drops by 20, `game()` is `{on:true, type:'cans', left:3, won:0}`.
  - `aimAt(0,0)` (bottom-left) then a tap: one tin, plus the one tin resting only on it, are down; `won` is a multiple of 6.
  - Knocking all six over three balls (aim at the bottom row's three tins) gives `won === 56`, and the purse is the start minus 20 plus 56.
  - Pressing Leave mid-game, or Esc: `game().on === false`, `#gameHud` hidden, all six tins standing, and `walk(...)` moves the player again.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all browser tests. Expected: PASS. Screenshot mid-game.
- [ ] **Step 5:** Commit: `feat(stalls): Dabba Giraao, knock the tins down`.

### Task 11: Bioscope

**Files:**
- Modify: `index.html` (markup: a `#bioscope` overlay with a `<canvas>`, a caption and a Leave button; CSS; `STALLS`, `L`, `buildStall`, `renderChoices`, the key handler for Esc, `frame`), `tests/web/test_stalls.py`

**Interfaces:**
- Produces: `startShow(s)`, which refuses with `L.broke` under ₹10, else takes ₹10, sets `GAME` to `{on:true, s, type:'bioscope'}` (so input is locked as in games), focuses the camera on the eyepiece (`camL`/`lookL`), and shows `#bioscope`. `SLIDES`: six `{draw(g, w, h), line:[roman, देवनागरी]}`, drawn procedurally in sepia with a round eyepiece vignette, grain and a slight flicker, 4 s each, with the bioscope-wala saying each slide's line. `endShow()` hides the overlay, then runs `endGame()` (camera back, dialog reopens). It runs when slide 6 ends, on Leave, and on Esc. Probe: `show() → {on, slide}` and `showSkip()` (advances one slide, test only).
- Slides and lines: Qutub Minar (a tapered fluted tower) `['Dilli ka Qutub Minar dekho!','दिल्ली का कुतुब मीनार देखो!']`; Taj Mahal (dome, four minarets, a pool) `['Agre ka Taj Mahal dekho!','आगरे का ताजमहल देखो!']`; Chowpatty (sea, sand, a bhel cart) `['Bambai ki Chowpatty dekho!','बंबई की चौपाटी देखो!']`; Howrah Bridge (a cantilever truss over a river) `['Kalkatte ka Howrah Bridge dekho!','कलकत्ते का हावड़ा ब्रिज देखो!']`; a filmi hero (a silhouette with a raised hand and a spotlight) `['Filmi hero ki style dekho!','फ़िल्मी हीरो की स्टाइल देखो!']`; a Diwali night (a row of diyas and rockets) `['Aur Diwali ki raat dekho!','और दिवाली की रात देखो!']`.
- Stall: `Bioscope`, tag `Dilli dekho, Bambai dekho`, col `#b45309`, type `bioscope`, cat `Khel tamasha`, pitch .9, greet `['Aao aao, bioscope dekho! Das rupaye mein poori duniya!','आओ आओ, बाइस्कोप देखो! दस रुपये में पूरी दुनिया!']`. Choice `Show dekho · ₹10`. Counter: a painted box with a brass eyepiece (short cylinder) and a crank on the side. The interactable verb is `Watch`.

- [ ] **Step 1: Write failing tests:** a show takes ₹10 and makes `#bioscope` visible with `show().slide === 0`. `showSkip()` six times ends it: overlay hidden, `game().on === false`. Starting again and pressing Esc closes it at once, with the same end state. With ₹5 in the purse, nothing is charged and no overlay shows.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all browser tests. Expected: PASS. Screenshot each slide.
- [ ] **Step 5:** Commit: `feat(stalls): Bioscope, a six-slide show through the eyepiece`.

### Task 12: Photo Studio

**Files:**
- Modify: `index.html` (markup: a `#photoCard` sheet with an `<img>`, a Download link and Close; CSS; `STALLS`, `L`, `buildStall`, `renderChoices`), `tests/web/test_stalls.py`

**Interfaces:**
- Produces: `takePhoto(s) → Promise<boolean>`. It refuses under ₹30. It says `L.photoReady`, waits 1.2 s, then poses the player's `SELF` model at the stall-local pose spot `(0, 0, -.35)` facing out. Friends whose avatars are within 4 m of `s.front` are posed beside it at x offsets ±0.7, ±1.4 (up to 4). It renders the scene once with a `PerspectiveCamera(45, 4/3)` at stall-local `(0, 1.45, 2.7)` looking at `(0, 1.25, -.4)` into a 1280×960 `WebGLRenderTarget`, reads the pixels (`readRenderTargetPixels`), and restores every posed model. It composes the result on a 2D canvas: the photo flipped upright, a cream border, and the caption "Phatake Bazaar · Diwali 2026" plus the date (`en-IN`). It sets the `<img>` and the Download link (`download="phatake-bazaar-<yyyymmdd-hhmm>.png"`) to that canvas's `toDataURL('image/png')`, opens `#photoCard`, flashes (`flashSprite` and `SND.win`), and only then takes ₹30 and says `L.photoDone`. If any step throws, it restores the models, toasts "Couldn't take the photo. You were not charged.", and resolves `false`. Probe: `photo() → {open, src_len}`.
- Stall: `Photo Studio`, tag `Ek click · ₹30`, col `#db2777`, type `photo`, cat `Yaadein`, pitch 1.15, greet `['Ek photo ho jaaye? Diwali ki yaad, haath mein!','एक फ़ोटो हो जाए? दिवाली की याद, हाथ में!']`. Choice `Ek photo · ₹30`. `L.photoReady=['Smile! Teen, do, ek…','स्माइल! तीन, दो, एक…']`, `L.photoDone=['Ekdum hero lag rahe ho!','एकदम हीरो लग रहे हो!']`. The stall has no counter box (skip the shared counter meshes for `type==='photo'`). It has a painted backdrop on the back wall (a canvas: night sky, full moon, fireworks, the Taj silhouette), a cut-out bike prop at the side, a camera on a tripod at the front corner, and a keeper beside the tripod.

- [ ] **Step 1: Write failing tests:**
  - With ₹100: `takePhoto` resolves true, `#photoCard` is visible, `photo().src_len > 10000`, the Download link's `download` attribute matches `^phatake-bazaar-\d{8}-\d{4}\.png$`, and the purse is 70.
  - With `WebGLRenderer.prototype.readRenderTargetPixels` patched to throw: it resolves false, the toast reads "Couldn't take the photo. You were not charged.", the purse is unchanged, there are no page errors, and the player can walk.
  - With ₹20: nothing is charged and no card opens.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all browser tests. Expected: PASS. Save one real photo from the test and look at it.
- [ ] **Step 5:** Commit: `feat(stalls): Photo Studio, a printed photo with your friends`.

### Task 13: Copy, docs and the full check

**Files:**
- Modify: `index.html` (meta description ~6, `og:description` ~9, hero tag ~249, help panel `Jhoola ground` row ~367 and stall list ~375), `README.md` (intro, the "How it's built" bullets for the jhoola ground and KollabKit, the Files table with `layout.js`, and the Tests section line for the JS tests), `tests/web/test_layout.py`, `docs/superpowers/specs/2026-10-22-bigger-mela-design.md` (status)

**Interfaces:**
- Copy: "sixteen stalls" becomes "twenty-four stalls" everywhere (meta, OG, hero, README). The help panel stall list follows ring order from the gate: west side first (Sharma Fireworks … Sivakasi Wale), then east (Mishra Halwai … Gupta Crackers), naming KollabKit's stand and the carts in one closing sentence. The help panel's jhoola row adds "Break Dance, Drop Tower, Maut ka Kuan and Bumper Cars are coming soon on the fenced plots."

- [ ] **Step 1: Write a failing test** `test_every_stall_is_built`: `set(__pbTest.stalls())` has all 24 names, each name in `LAYOUT.ORDER`, and the help panel text contains each of them.
- [ ] **Step 2:** Run. Expected: FAIL until the copy lands (the stall set already passes after Task 12).
- [ ] **Step 3:** Update the copy and docs.
- [ ] **Step 4:** Run everything: `node --test "tests/js/*.test.mjs"` and `python3 tests/web/run.py` (both must PASS). If the local Supabase stack can be started, also run `sh tests/all.sh` (needs Docker; when it is not available, say so in the PR rather than skipping silently).
- [ ] **Step 5:** Full-tour check with Playwright at 1280×800: walk spawn → ring lap → corridor → around the jhoola ground with `walk` probes, screenshotting at each zone. Note the total simulated time; it should be about 3 minutes at walking speed. Set the spec status to "built on branch `bigger-mela`".
- [ ] **Step 6:** Commit: `docs: twenty-four stalls, layout.js and the bigger map`.
