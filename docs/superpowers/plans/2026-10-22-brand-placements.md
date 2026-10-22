# Brand Placements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brands appear on a few fixed slots in the bazaar, managed entirely from a `/admin` page backed by Supabase, with no brand in the code.

**Architecture:** Supabase holds slots, campaigns, stats and enquiries behind row-level security. Players read through one `bazaar_ads()` function, and two Edge Functions (`track`, `enquire`) take writes. A new `brands.js` loads, caches, rotates and tracks. `index.html` only draws slots. `admin.html` is a single no-build page for admins.

**Tech Stack:** Static HTML/JS on Vercel, three.js r128 (already loaded), Supabase Postgres + Auth + Storage + Edge Functions (Deno), `@supabase/supabase-js@2.45.4` from jsDelivr, pgTAP for database tests, `node:test` for `brands.js`, Playwright (Python, already installed) with system Chrome for browser tests.

**Spec:** `docs/superpowers/specs/2026-10-22-brand-placements-design.md`

## Global Constraints

- No brand names, links, lines or image paths in `index.html`, `brands.js` or `net.js` once Task 7 lands. Only slot IDs and kinds.
- Slot IDs, exactly: `stall-ring`, `stall-ring-b`, `hoarding-entry`, `hoarding-entry-b`, `hoarding-jhoola`. Kinds, exactly: `premium_stall`, `hoarding`, `basic_stall`.
- Dates are calendar days in `Asia/Kolkata`, inclusive at both ends.
- `share` is an integer from 1 to 10. Links must start with `https://`.
- Artwork: JPG/PNG/WebP, ≤ 1 MB, aspect ratio within 2% of target. Hoarding `wide` 16:9 (1920×1080). Stall `wide` 16:9 (1600×900) + `tall` 9:16 (1080×1920).
- Premium stall lines: 1–3 `greet`, 2–3 `qa`, each `[en, hi]`. Max 120 characters per greeting line, 120 per question, 280 per answer.
- View = on screen, within 25 m, ≥ 1 s cumulative, once per campaign per visit. Click = brand link opened, once per campaign per visit.
- `track`: ≤ 60 events/IP/minute, ≤ 50 events/request. `enquire`: ≤ 3/IP/hour, decoy field `website`, raw IPs never stored (SHA-256 with secret `IP_SALT`).
- `bazaar_ads()` timeout in the game: 4000 ms. Track flush: every 30 s and on `pagehide`.
- Pin exact versions everywhere (no `^`, no `@2`). Reuse `@supabase/supabase-js@2.45.4` as in `net.js`.
- Tests never touch the live Supabase project. Browser tests block `*.supabase.co` and mock responses.
- Code style matches `index.html`: dense, short names, comments only for the non-obvious.

## Review Focus

1. **Artwork URL that 404s or fails CORS:** the board keeps Diwali art and the console has no uncaught error (test in Task 7).
2. **Fresh data differs from cache** (a campaign ended or a slot was switched off): boards swap in place with no duplicate meshes left behind. `applySlots` called twice leaves exactly one group per slot (test in Task 7).
3. **Campaign on its last day:** it is live through 23:59 IST and gone at 00:00 IST, whatever the server clock's zone (test in Task 2).
4. **A link that isn't `https://`** (for example `javascript:…`): rejected by the database and also refused by the game at open time (tests in Task 2 and Task 6).
5. **Long Hindi lines in the shopkeeper dialog:** at the maximum lengths they wrap inside the dialog without overflowing on a 360 px wide phone (test in Task 7).

---

### Task 0: Move into the repo

**Files:** none new. Copies this folder's working changes into the clone.

- [ ] **Step 1:** Clone the owner's GitHub repo to `/Users/hassanyosuf/Workspace/phatake-bazaar` (URL from the owner). Create branch `brand-placements`.
- [ ] **Step 2:** Diff `index.html`, `README.md` and `docs/` between this folder and the clone. Copy over the 2026-10-22 changes (pedestrians `npcStep`/`npcTarget`, kid lanes, maidan `wash` light, refill at `REFILL_AT=100`, `renderCoins()` in `enterBazaar`, README refill line, the spec and this plan). If the clone's `index.html` has moved on since this folder was copied, apply the same edits by hand rather than overwriting the file.
- [ ] **Step 3:** Serve with `python3 -m http.server 8765`, load in Chrome, enter the bazaar and confirm there are no console errors.
- [ ] **Step 4:** Commit: `fix: crowd routing, maidan light, easy purse refill` and `docs: brand placements spec and plan`.

### Task 1: Tooling and local Supabase

**Files:**
- Create: `tests/package.json`, `supabase/config.toml` (via `supabase init`), `.vercelignore`
- Modify: `.gitignore` (create if missing)

**Interfaces:**
- Produces: `npm --prefix tests run db:start | db:test | fn:test | web:test` scripts. Local Supabase at `http://127.0.0.1:54321`, Mailpit at `http://127.0.0.1:54324`.

- [ ] **Step 1:** `brew install deno`. Create `tests/package.json` with devDependency `supabase` pinned to the current 2.x release (exact version). Add scripts: `db:start` = `supabase start --workdir ..`, `db:reset` = `supabase db reset --workdir ..`, `db:test` = `supabase test db --workdir ..`, `fn:test` = `deno test --allow-env --allow-net ../supabase/functions`, `js:test` = `node --test ../tests/js`, `web:test` = `python3 ../tests/web/run.py`.
- [ ] **Step 2:** `npx --prefix tests supabase init --workdir .`. In `supabase/config.toml` set `[auth] enable_signup = false`, `site_url = "http://localhost:8765"`, `additional_redirect_urls = ["http://localhost:8765/admin", "https://diwali-patakha-bazaar.vercel.app/admin"]`, and `[functions.track] verify_jwt = false`, `[functions.enquire] verify_jwt = false`.
- [ ] **Step 3:** `.vercelignore`: `tests/`, `supabase/`, `docs/`. `.gitignore`: `tests/node_modules/`, `supabase/.temp/`, `supabase/.branches/`.
- [ ] **Step 4:** Run `npm --prefix tests install && npm --prefix tests run db:start`. Expected: the CLI prints API URL `http://127.0.0.1:54321`.
- [ ] **Step 5:** Commit: `chore: local supabase and test tooling`.

### Task 2: Database schema, rules and functions

**Files:**
- Create: `supabase/migrations/20261022000001_brand_placements.sql`, `supabase/seed.sql`, `supabase/tests/database/brand_placements.test.sql`

**Interfaces:**
- Produces (SQL):
  - Tables `admins`, `slots`, `campaigns`, `stats_daily`, `enquiries`, `track_seen`, `rate_hits`, with the columns in the spec. `rate_hits(key text, win timestamptz, n int, primary key(key, win))` replaces the spec's `enquire_log` and serves both functions.
  - `is_admin() returns boolean`
  - `bazaar_ads(p_today date default (now() at time zone 'Asia/Kolkata')::date) returns jsonb`: `{ "slots": [{id, kind}], "campaigns": [{id, brand, slot_id, link, art, lines, share}] }`, enabled slots only, campaigns live on `p_today` in enabled slots only. `security definer`, executable by `anon` and `authenticated`.
  - `track_event(p_visit text, p_campaign uuid, p_kind text, p_day date) returns boolean`: `p_kind` in `('v','c')`. Inserts into `track_seen` on conflict do nothing. If inserted, upserts +1 into `stats_daily.views` or `clicks`. Returns whether it counted. Executable by `service_role` only.
  - `rate_hit(p_key text, p_window_s int, p_max int) returns boolean`: upserts the current window's counter and returns `n <= p_max`. `service_role` only.
  - Storage bucket `brand-art` (public) with insert/update/delete policies `is_admin()`.
  - `pg_cron` job `purge-brand-bookkeeping` daily at 03:00 UTC, deleting `track_seen` and `rate_hits` rows older than 2 days.
- Seed: the five slots (`stall-ring`, `hoarding-entry`, `hoarding-jhoola` enabled; the two `-b` disabled). Local only: an admin user `admin@test.local` in `auth.users` + `admins`, and a non-admin `user@test.local`.

- [ ] **Step 1: Write the failing pgTAP tests** in `brand_placements.test.sql`:
  - `anon` can execute `bazaar_ads()` and gets 3 slots.
  - `anon`: `select` on `campaigns`, `stats_daily`, `enquiries`, `admins` raises a permission error. Insert into `campaigns` raises one too.
  - A campaign with `starts_on = ends_on = '2026-11-01'` appears in `bazaar_ads('2026-11-01')` and not in `bazaar_ads('2026-11-02')` or `bazaar_ads('2026-10-31')`.
  - A campaign with `enabled = false`, or on a disabled slot, never appears.
  - `bazaar_ads()` campaign objects have exactly the keys `id, brand, slot_id, link, art, lines, share` (no `enquiry_id`).
  - Inserting `link = 'javascript:alert(1)'`, `share = 0`, `share = 11`, or `ends_on < starts_on` fails a check constraint.
  - With `request.jwt.claims` set to `admin@test.local`: insert/update/delete on `campaigns` works, and so does select on `stats_daily` and `enquiries`. With `user@test.local`: selects return 0 rows and writes fail.
  - `track_event('v1', c, 'v', d)` twice returns `true` then `false`, leaving `views = 1`. A different visit makes `views = 2`. `anon` can't execute `track_event` or `rate_hit`.
  - `rate_hit('k', 60, 2)` returns `true, true, false`.
- [ ] **Step 2:** `npm --prefix tests run db:reset && npm --prefix tests run db:test`. Expected: FAIL (relations don't exist).
- [ ] **Step 3:** Write the migration and seed as specified in Interfaces.
- [ ] **Step 4:** `npm --prefix tests run db:reset && npm --prefix tests run db:test`. Expected: all tests pass.
- [ ] **Step 5:** Commit: `feat(db): brand placement tables, rules and functions`.

### Task 3: `track` Edge Function

**Files:**
- Create: `supabase/functions/_shared/http.ts`, `supabase/functions/track/index.ts`, `supabase/functions/track/handler.ts`, `supabase/functions/track/handler.test.ts`

**Interfaces:**
- Consumes: `track_event`, `rate_hit` (Task 2).
- Produces:
  - `_shared/http.ts`: `cors(req: Request): Headers`, which echoes `Origin` only if it is in env `ALLOWED_ORIGINS` (comma-separated; `http://localhost:*` allowed as a pattern). Also `clientIp(req): string` (first `x-forwarded-for` entry) and `ipHash(ip): Promise<string>` (SHA-256 hex of `ip + IP_SALT`).
  - `handler.ts`: `handleTrack(req: Request, db: { hit(key, windowS, max): Promise<boolean>, event(visit, campaign, kind, day): Promise<boolean> }, today: () => string): Promise<Response>`.
  - Body is JSON sent as `text/plain` (so `sendBeacon` needs no preflight): `{ visit: string(8–40), events: [{ c: uuid, t: 'v'|'c' }] }`.
  - Response is `204` always on a well-formed request (even when capped), `400` on malformed JSON or shape, `405` on anything but POST/OPTIONS.

- [ ] **Step 1: Write failing Deno tests** in `handler.test.ts` with a fake `db`:
  - A valid body with 3 events calls `db.event` 3 times with `today()`. Response is 204.
  - 51 events: only the first 50 are processed.
  - `db.hit` returns false: no `db.event` calls, still 204.
  - The IP key is hashed, so the raw IP string never appears in the `db.hit` key.
  - Malformed JSON gives 400. `t: 'x'` or a non-uuid `c` gives 400. GET gives 405. OPTIONS gives 204 with CORS headers.
- [ ] **Step 2:** `npm --prefix tests run fn:test`. Expected: FAIL.
- [ ] **Step 3:** Implement `http.ts` and `handler.ts`. `index.ts` wires `Deno.serve` to `handleTrack` using a service-role client (`npm:@supabase/supabase-js@2.45.4`) calling the RPCs. `today()` = the date in `Asia/Kolkata`.
- [ ] **Step 4:** `npm --prefix tests run fn:test`. Expected: PASS. Then serve locally (`supabase functions serve --workdir ..`), `curl` one event and check that `stats_daily` has the row.
- [ ] **Step 5:** Commit: `feat(fn): track views and clicks`.

### Task 4: `enquire` Edge Function

**Files:**
- Create: `supabase/functions/enquire/index.ts`, `supabase/functions/enquire/handler.ts`, `supabase/functions/enquire/handler.test.ts`

**Interfaces:**
- Consumes: `_shared/http.ts` (Task 3), `rate_hit` (Task 2).
- Produces: `handleEnquire(req, db: { hit(...): Promise<boolean>, insert(row): Promise<void> }): Promise<Response>`.
  - Body JSON: `{ name: 1–80, brand: 1–80, contact: 3–120, interest: 'hoarding'|'premium_stall'|'basic_stall'|'not_sure', message: 0–1000, website: string }`.
  - Responses: `200 {ok:true}` on success. `200 {ok:true}` and no insert when `website` is non-empty. `429 {ok:false, error:'rate'}` over 3/hour. `400 {ok:false, error:'<field>'}` naming the first bad field.

- [ ] **Step 1: Write failing Deno tests**: a valid body inserts exactly the six fields, with no IP and no `website`. Decoy filled: 200, no insert. Fourth call in the hour: 429. Each field out of bounds: 400 naming it. Text is trimmed before length checks.
- [ ] **Step 2:** Run `fn:test`. Expected: FAIL.
- [ ] **Step 3:** Implement. `rate_hit` key = `enq:` + `ipHash`, with a 3600 s window and max 3.
- [ ] **Step 4:** Run `fn:test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(fn): advertise-with-us enquiries`.

### Task 5: `brands.js`: load, cache, rotate

**Files:**
- Create: `sb-config.js`, `brands.js`, `tests/js/brands.test.mjs`
- Modify: `net.js:9-10` (read `window.SB` instead of its own constants), `index.html` (load `sb-config.js` before `net.js`, and `brands.js` after it)

**Interfaces:**
- Produces:
  - `sb-config.js`: `window.SB = { url, key }` (the values now in `net.js`).
  - `brands.js` works in the browser (`window.BRANDS`) and Node (`module.exports`):
    - `pick(campaigns: Campaign[], rnd: () => number): Campaign | null`: weighted by `share`.
    - `choose(data: AdsData, saved: Record<slotId, campaignId>, rnd): { slots: Record<slotId, { kind, campaign: Campaign | null }>, saved }`: keeps a saved pick if it's still live, otherwise picks again.
    - `start(onData: (state) => void, opts?: { fetchAds?, storage?, session?, timeoutMs?: 4000, rnd? }): void`: calls `onData` synchronously with the cached state if there is one, then again with fresh state only if it differs. The cache key is `pb_ads`, and the session key for picks is `pb_ad_picks`. On timeout or error with no cache it calls `onData(null)`, and the game treats `null` as "today's built-in on-slots with Diwali art".
  - Types: `AdsData` = the `bazaar_ads()` JSON. `Campaign` = one campaign object from it.

- [ ] **Step 1: Write failing `node:test` tests:**
  - `pick` over 10,000 draws with shares `[1, 3]` lands at 25% ± 2%. An empty list gives `null`.
  - `choose` keeps a saved pick that's still live, replaces one that's gone, and returns `campaign: null` for an enabled slot with no campaigns.
  - `start`: with a cache, `onData` is called once synchronously and again only if the fresh data differs. A fetch that never resolves gives `onData(null)` at 4000 ms with no cache (use `mock.timers`). With a cache and a fetch error, `onData` is called once only.
- [ ] **Step 2:** `npm --prefix tests run js:test`. Expected: FAIL.
- [ ] **Step 3:** Implement. `fetchAds` default: `POST ${SB.url}/rest/v1/rpc/bazaar_ads` with headers `apikey` and `Authorization: Bearer ${SB.key}` and an `AbortController`.
- [ ] **Step 4:** Run `js:test`. Expected: PASS. Load the game and check that live play still connects (`net.js` change).
- [ ] **Step 5:** Commit: `feat(game): brands.js loads and rotates campaigns`.

### Task 6: `brands.js`: tracking and preview

**Files:**
- Modify: `brands.js`, `tests/js/brands.test.mjs`

**Interfaces:**
- Produces on `BRANDS`:
  - `seen(campaignId)`, `clicked(campaignId)`: queue an event at most once per campaign per visit.
  - `open(campaign)`: refuses unless `link` starts with `https://`. Otherwise calls `clicked` and then `window.open(link, '_blank', 'noopener')`. Returns a boolean.
  - `visit`: a random ID in `sessionStorage` key `pb_visit`.
  - Flush: every 30 s and on `pagehide`, `navigator.sendBeacon(${SB.url}/functions/v1/track, new Blob([json], {type:'text/plain'}))`. Batches are capped at 50 and anything over waits for the next flush. A failed batch is dropped.
  - `preview: string | null` comes from `?preview=`. When set: `start` fetches `GET /rest/v1/campaigns?id=eq.<id>&select=id,brand,slot_id,link,art,lines,share` with the admin access token from `localStorage['sb-<ref>-auth-token']`, and forces it onto its slot. `previewing: boolean`. All tracking is a no-op while previewing. With no token, the preview is ignored.

- [ ] **Step 1: Write failing tests:** `seen(x)` twice queues one event. `open({link:'javascript:alert(1)'})` returns false and queues nothing. A flush after 30 s sends one beacon with the queued events and clears the queue. 60 queued events go out as 50 then 10. With `preview` set and a token, `onData` gets that campaign on its slot and `seen` queues nothing. With `preview` and no token, it behaves normally.
- [ ] **Step 2:** Run `js:test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `js:test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(game): count views and clicks, admin preview`.

### Task 7: Slots in the game

**Files:**
- Modify: `index.html`: the sponsor section (`/* sponsor: KollabKit */`, around lines 1086–1133), the `s.type==='ad'` dialog branch (~1577, ~1623), the prompt list (~1808), the tap handler (~1873), keeper animation (~2317), and the ring lamp-post loop (~818)
- Create: `tests/web/run.py`, `tests/web/fixtures/ads.json`, `tests/web/fixtures/art-wide.jpg`, `tests/web/fixtures/art-tall.jpg`, `tests/web/test_slots.py`

**Interfaces:**
- Consumes: `BRANDS.start`, `BRANDS.seen`, `BRANDS.open`, `BRANDS.previewing` (Tasks 5–6).
- Produces in `index.html`:
  - `SLOT_DEFS: Record<slotId, { kind, build: (campaign|null) => THREE.Group }>`, with positions: `stall-ring` at `AD_ANG` (`SLOT*7.5`), `stall-ring-b` at `SLOT*10.5` (hide the lamp post at `k=10` while it's built), `hoarding-entry` `(6.2, -3.2, ry -.7, w 4.4)`, `hoarding-entry-b` `(-6.2, -3.2, ry .7, w 4.4)`, `hoarding-jhoola` `(-13, -84.6, ry .35, w 6.4)`.
  - `applySlots(state | null)`: disposes and rebuilds only the slots whose campaign changed. `null` means the three default-on slots with no campaign.
  - `festiveTex(kind, part: 'wide'|'tall')`: canvas Diwali art.
  - A sponsor object per built premium stall, replacing `AD`: `{type:'ad', name: brand, greet: lines.greet, qa: lines.qa, campaign, keeper, front, views}`. The dialog footer reads `Sponsored by ${brand}. The link opens in a new tab.` The choices are `Visit ${brand} ↗` (`BRANDS.open`) plus one per `qa` (`setQuote(a)`).
  - Hoardings with a campaign are tappable and open a small dialog with the brand name and `Visit ${brand} ↗`. This refines the spec's "tap opens link" so that tap-to-walk can't open tabs by accident. Hoardings showing Diwali art aren't tappable.
  - View check every 250 ms: for each built slot with a campaign, if its board centre is inside the camera frustum and within 25 m, add the elapsed time. At ≥ 1 s, call `BRANDS.seen(id)`.
  - When `BRANDS.previewing`, a fixed strip at the top reads `Preview: not counted`.
- No `basic_stall` builder yet: no slot uses it until the brand street (project 2), which adds it.
- Remove: `KK_URL`, `KK_CREATORS`, `KK_BRANDS`, the KollabKit `AD` text, and every `ads/kollabkit-` path.

- [ ] **Step 1: Write failing Playwright tests** in `test_slots.py`. `run.py` starts `http.server` on 8765, routes `**/rest/v1/rpc/bazaar_ads` to the fixture, serves fixture images, aborts every other `*.supabase.co` request, and collects page errors. A test-only hook `window.__pbTest = { slots(): {id: {campaignId|null, groups: n}} }` is exposed only when `?test=1`.
  - Fixture with a live hoarding campaign: `hoarding-entry` shows its campaign. Tapping it opens the dialog with `Visit … ↗`. A slot with no campaign shows `campaignId: null`.
  - RPC aborted, no cache: the three default slots exist, all `null`, and there are no page errors.
  - Campaign art URL returns 404: the slot still exists, no page error.
  - Fresh data differs from cache (seed `localStorage.pb_ads` with a different campaign): after load, each slot reports `groups: 1`.
  - Standing in front of `hoarding-entry` for 1.5 s queues a view, but 0.5 s doesn't (inspect beacons via `page.route` on `/functions/v1/track` after triggering `pagehide`).
  - Premium stall with max-length Hindi `qa` at a 360×740 viewport: the dialog's `scrollWidth <= clientWidth`.
  - `?preview=<id>` with a fake token in `localStorage`: the `Preview: not counted` strip is visible and no beacon is sent on `pagehide`.
  - `grep -c "kollabkit" index.html` returns 0.
- [ ] **Step 2:** `npm --prefix tests run web:test`. Expected: FAIL.
- [ ] **Step 3:** Implement as in Interfaces. Reuse the existing `hoarding()` and stand geometry, parameterised by textures.
- [ ] **Step 4:** Run `web:test`. Expected: PASS. Take screenshots of all five slots, with each `-b` slot switched on in the fixture, and check by eye that from any spot at most two brand boards are in view. Adjust the reserve positions if not.
- [ ] **Step 5:** Commit: `feat(game): data-driven brand slots, no brand in code`.

### Task 8: "Advertise with us" form

**Files:**
- Modify: `index.html` (Help sheet around line 350, a new form sheet, and its handler)
- Create: `tests/web/test_enquire.py`

**Interfaces:**
- Consumes: `enquire` (Task 4), `SB.url`.
- Produces: an "Advertise with us" line at the end of Help that opens `#adForm`. The fields are the Task 4 body, with `website` visually hidden, `aria-hidden` and `tabindex=-1`. On success the form is replaced by "Thanks! We'll get in touch soon." On failure the text is kept and it shows "Couldn't send. Try again in a minute." Submit is disabled while sending.

- [ ] **Step 1: Write failing tests** (route `/functions/v1/enquire`): a filled form posts the exact JSON, with `website: ""`. A 200 response shows the thanks text. A 429 or network error keeps the inputs and shows the retry text. An empty name blocks submission client-side.
- [ ] **Step 2:** Run `web:test`. Expected: FAIL.
- [ ] **Step 3:** Implement, following the existing `.sheet` markup and button classes.
- [ ] **Step 4:** Run `web:test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(game): advertise-with-us form`.

### Task 9: Admin page: sign-in and Slots tab

**Files:**
- Create: `admin.html`, `tests/web/test_admin.py`
- Modify: `vercel.json` (header `X-Robots-Tag: noindex, nofollow` for `/admin`)

**Interfaces:**
- Consumes: Supabase Auth (magic link), tables from Task 2, `sb-config.js`.
- Produces: `admin.html` with a sign-in view, a "Not authorised" view (signed in, not in `admins`) and four tabs (`#slots`, `#campaigns`, `#stats`, `#enquiries`). Slots tab: one card per slot, with an on/off toggle (update `slots.enabled`), the live campaigns with thumbnail, brand and rotation percentage (`share / sum(shares)`), the next scheduled campaign, and "Showing Diwali art" when on and empty.

- [ ] **Step 1: Write failing tests** against the local stack (`run.py` gains `--local`, pointing `SB` at `127.0.0.1:54321`): request a link for `admin@test.local`, fetch it from the Mailpit API, open it and land on Slots with 5 cards. Toggling `stall-ring-b` persists after reload. `user@test.local` sees "Not authorised". At a 390×844 viewport every tab has `document.documentElement.scrollWidth <= 390`. The response for `/admin` from `vercel dev`, or a check on `vercel.json`, includes the noindex header.
- [ ] **Step 2:** Run `web:test --local`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): sign-in and slot switches`.

### Task 10: Admin page: Campaigns tab

**Files:**
- Modify: `admin.html`, `tests/web/test_admin.py`

**Interfaces:**
- Produces:
  - Campaign list (brand, slot, dates, live/scheduled/ended, share) and an editor.
  - `checkArt(file, kind, part): Promise<string | null>` returns an error message or `null`, using the Global Constraints sizes, a 2% tolerance and a 1 MB limit.
  - Upload goes to `brand-art/campaigns/<id>/<part>.<ext>` and stores the public URL in `art`.
  - `withUtm(link, slotId): string` adds `utm_source=phatake-bazaar&utm_medium=game&utm_campaign=<slotId>` unless the link already has any `utm_` parameter.
  - The lines editor shows only for `premium_stall`, with 1–3 greetings and 2–3 Q&A, `[en, hi]`, and the length limits.
  - "Preview in game" opens `/?preview=<id>` in a new tab.

- [ ] **Step 1: Write failing tests:** `checkArt` rejects a 1920×1200 image, a 1.2 MB image and a GIF, and accepts 1920×1080 and 1900×1070 (within 2%). `withUtm('https://x.com/?a=1','hoarding-entry')` gives `https://x.com/?a=1&utm_source=phatake-bazaar&utm_medium=game&utm_campaign=hoarding-entry`, and a link with `utm_source` is unchanged. Creating a premium-stall campaign with art and lines makes it appear in `bazaar_ads()` on its dates. A non-https link shows an inline error and doesn't save. With the storage upload routed to a 500, the error shows next to the upload and no campaign row is created.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): campaign editor with artwork checks`.

### Task 11: Admin page: Stats and Enquiries tabs

**Files:**
- Modify: `admin.html`, `tests/web/test_admin.py`

**Interfaces:**
- Produces:
  - Stats: date range (default last 7 days) and a per-campaign table of views, clicks and click rate (`clicks/views`, shown as `—` when views is 0), expandable by day. `toCsv(rows): string` has the header `date,brand,slot,views,clicks,click_rate`.
  - Enquiries: newest first, a `new` badge count on the tab, a status select (`new`/`contacted`/`closed`), a private note (saved on blur), and **Create campaign**, which opens the editor with `brand` and `enquiry_id` filled in.

- [ ] **Step 1: Write failing tests:** with seeded stats, the table totals match. The CSV has the exact header and one row per campaign-day. With views 0, click rate is `—` and the CSV has an empty cell. A seeded enquiry shows the badge "1". Changing its status to contacted clears the badge. Create campaign pre-fills the brand, and the saved campaign has its `enquiry_id`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(admin): stats with CSV and enquiries inbox`.

### Task 12: Docs and rollout

**Files:**
- Modify: `README.md` (files table, how brands work, admin setup), `docs/superpowers/specs/2026-10-22-brand-placements-design.md` (record the three refinements: `rate_hits` replaces `enquire_log`, a hoarding tap opens a small dialog, and the `basic_stall` builder moves to project 2)

- [ ] **Step 1:** README: add `admin.html`, `brands.js`, `sb-config.js`, `supabase/` and `tests/` to the files table. Add a "Brands" section: slots and states, how to add a campaign, how to add an admin (invite in the Supabase dashboard and insert their email into `admins`), and how to run tests.
- [ ] **Step 2: Rollout step 1 (owner approves each action first):** apply the migration to project `phatake-bazaar`. Deploy `track` and `enquire` with secrets `IP_SALT` (random 32 bytes) and `ALLOWED_ORIGINS=https://diwali-patakha-bazaar.vercel.app,http://localhost:*`. In Auth settings, turn sign-ups off, set the site URL and add `/admin` to redirect URLs. Invite the owner and add them to `admins`. Push only `admin.html`, `sb-config.js` and `vercel.json`. The owner creates the KollabKit campaigns on its three slots using the current `ads/kollabkit-*` images.
- [ ] **Step 3: Rollout step 2:** merge the game changes. On production, check that the three KollabKit boards look as before and that `stats_daily` gets rows within an hour.
- [ ] **Step 4: Rollout step 3** (a week later, owner's go-ahead): delete `ads/kollabkit-*` and commit `chore: remove bundled sponsor art`.
- [ ] **Step 5:** Commit the docs: `docs: brands, admin and rollout`.
