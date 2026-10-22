# Brand placements: design

Date: 2026-10-22
Status: awaiting review
Part 1 of 3. The next two projects are a bigger map (brand street, food street, ghats, bigger maidan) and new movement (auto-rickshaw, map fast-travel, smoother walk). Each gets its own spec.

## Goal

The owner sells brand placements in Phatake Bazaar and manages them without touching code. A new brand goes live through an admin page alone: no code change and no redeploy. The bazaar must never feel crowded with ads, however many brands are signed.

## Non-goals (for this project)

- Pricing, bookings, invoices or payment tracking. Deals are agreed outside the game.
- A self-serve portal for brands.
- Email or WhatsApp alerts for new enquiries.
- Audit-grade impression numbers. Counts are good enough to report to brands, not to certify.
- New areas of the map. The brand street comes in project 2 and plugs its slots into this system.

## Principles

1. **No brand in code.** Every brand name, line, link and image lives in the database. The code knows only slots.
2. **Restraint.** Few slots, spread out, so a player sees at most one or two brand boards from any spot. More brands means more rotation, not more boards.
3. **Never broken.** If anything fails (network, Supabase, a bad image), the board shows Diwali art and the game plays as before.

## Placement kinds

| Kind | What players see | Brand provides | Tier |
|---|---|---|---|
| Premium stall | A stand with a header, a tall panel and a shopkeeper who greets players and answers questions about the brand | `wide` 16:9 (1600×900), `tall` 9:16 (1080×1920), link, 1–3 greeting lines, 2–3 question-and-answer pairs, each line in English and Hindi | Top |
| Hoarding | A large framed board | `wide` 16:9 (1920×1080), link | High |
| Basic stall | A stand with a header and a tall panel, no talking shopkeeper | `wide` 16:9, `tall` 9:16, link | Mid. No slots until project 2 |

Artwork rules: JPG, PNG or WebP, at most 1 MB, aspect ratio within 2% of the target. The admin page rejects anything else with a clear message.

## Slots

A slot is a fixed spot in the world. Its position and kind are in the game code. Whether it is switched on is in the database.

| Slot ID | Kind | Where | Starts |
|---|---|---|---|
| `stall-ring` | Premium stall | Ring gap between Diya Ghar and Sivakasi Wale (today's KollabKit stand, `SLOT*7.5`) | On |
| `stall-ring-b` | Premium stall | The mirror gap on the other side of the north path (`SLOT*10.5`). The lamp post there is hidden while the slot is on | Off (reserve) |
| `hoarding-entry` | Hoarding | Entry lane, today's KollabKit hoarding | On |
| `hoarding-entry-b` | Hoarding | Entry lane, mirrored on the other side | Off (reserve) |
| `hoarding-jhoola` | Hoarding | Jhoola ground, today's billboard | On |

Exact reserve positions are tuned during implementation with screenshots, keeping the one-or-two-boards-in-view rule.

Each slot is in one of three states:

- **Off:** nothing is drawn. The spot looks like the bazaar did before ads existed.
- **On, no live campaign:** Diwali art, drawn on a canvas at runtime (diyas, rangoli, "Shubh Deepavali"), so no image files are needed.
- **On, with live campaigns:** one campaign's artwork, chosen per visit (see Rotation).

A slot ID that is in the database but not in the code is ignored. A slot in the code but not in the database is treated as off.

## Data (Supabase project `phatake-bazaar`)

All dates are calendar days in India time (Asia/Kolkata), inclusive.

### Tables

`admins`
- `email text primary key`

`slots`
- `id text primary key`, `kind text` (`premium_stall`, `hoarding`, `basic_stall`), `label text`, `enabled boolean default false`
- Seeded by the migration with the five slots above.

`campaigns`
- `id uuid primary key`, `brand text`, `slot_id text references slots`, `link text` (must start with `https://`)
- `art jsonb`: `{ "wide": url, "tall": url }`. `tall` is required only for stall kinds.
- `lines jsonb` (premium stall only): `{ "greet": [[en, hi], …], "qa": [{ "q": [en, hi], "a": [en, hi] }, …] }`
- `starts_on date`, `ends_on date` (`ends_on >= starts_on`), `enabled boolean default true`
- `share smallint default 1`, from 1 to 10 (weight in rotation)
- `enquiry_id uuid null references enquiries`, `created_at`, `updated_at`

`stats_daily`
- `campaign_id uuid`, `day date`, `views int default 0`, `clicks int default 0`, primary key `(campaign_id, day)`

`enquiries`
- `id uuid primary key`, `created_at`, `brand text`, `name text`, `contact text` (email or phone)
- `interest text` (`hoarding`, `premium_stall`, `basic_stall`, `not_sure`), `message text` (up to 1000 characters)
- `status text default 'new'` (`new`, `contacted`, `closed`), `note text` (private to admins)

`track_seen` and `enquire_log`: bookkeeping for the server functions (below). A daily `pg_cron` job deletes rows older than 2 days.

### Access rules

- `is_admin()`: true when the signed-in user's email is in `admins`.
- **Admins** can read and write `slots`, `campaigns` and `enquiries`, and can read `stats_daily`.
- **Players (public key)** can't read or write any table directly. They call one database function, `bazaar_ads()`, which returns enabled slots and, for each, its live campaigns (enabled and dated for today). It returns only `id`, `brand`, `slot_id`, `link`, `art`, `lines` and `share`.
- `stats_daily`, `enquiries`, `track_seen` and `enquire_log` are written only by the server functions, using the service key, which never leaves Supabase.
- **Sign-ups are off.** Admins are invited from the Supabase dashboard and added to `admins`. A signed-in user who isn't in `admins` sees no data.

### Storage

Bucket `brand-art`: public read, with upload, replace and delete for admins only. Paths are `campaigns/<campaign id>/<wide|tall>.<ext>`.

### Server functions (Supabase Edge Functions)

`track`
- Input: `{ visit, events: [{ c: campaignId, t: "v" | "c" }] }`. `visit` is a random ID made once per browser tab.
- Each `(visit, campaign, type, day)` counts at most once, enforced by `track_seen`.
- Each IP is capped at 60 events a minute, and each request at 50 events. Anything over is dropped silently.
- Adds the counts into `stats_daily`.

`enquire`
- Validates required fields and lengths.
- Drops the request without saying why if the hidden decoy field `website` is filled in. Only bots fill it in.
- Accepts at most 3 per IP per hour.
- Stores a hash of the IP, never the raw IP.

Both functions accept requests only from the production site and `localhost`.

## Game changes

### New file `brands.js` (alongside `net.js`)

It owns everything except drawing:

- **Load:** on page open, start `bazaar_ads()` with a 4-second timeout. It never blocks entering the bazaar.
- **Cache:** save the last good answer in `localStorage`. Use the cache at once on a return visit, then switch to the fresh answer if it differs.
- **Rotation:** for each slot, pick one live campaign weighted by `share`. Keep the pick in `sessionStorage`, so a reload in the same tab shows the same brand and a new tab or visit may show another.
- **Views:** the game reports a campaign's board as seen when it is in the camera view, within about 25 m, for at least 1 second in total. Each campaign counts once per visit.
- **Clicks:** the game reports a click when a brand link is opened.
- **Sending:** batch views and clicks to `track` every 30 seconds and on `pagehide` (via `sendBeacon`).
- **Preview:** `?preview=<campaign id>` uses the admin's Supabase session on the same site to fetch that one campaign, forces it onto its slot, shows a "Preview: not counted" strip and disables tracking. Without an admin session it is ignored.

### `index.html`

- **Builders:** replace the KollabKit sponsor section with three slot builders (`hoarding`, `premiumStall`, `basicStall`) plus the Diwali-art fallback. Builders take `(slot, campaign | null)`.
- **Art loading:** a board shows Diwali art until its texture loads, and keeps it if the load fails.
- **Premium stall shopkeeper:** uses the campaign's `greet` and `qa` lines in the existing dialog, keeps the existing voice behaviour and adds a **Visit** choice that opens the link.
- **Hoardings:** tapping or clicking one opens its link.
- **Advertise with us:** add one line to the Help panel. It opens an in-game form with name, brand, email or phone, interest, message and the hidden `website` field, which posts to `enquire` and then shows a thank-you message.
- **Remove brand-specific code:** delete `KK_*`, the KollabKit-specific `AD` text and the hard-coded `ads/kollabkit-*` paths. The files themselves are deleted in rollout step 3.

## Admin page (`/admin`)

A single `admin.html`, written in plain JavaScript with no build step, loading the same Supabase library version as `net.js`.

- **Hidden from search:** `vercel.json` adds `X-Robots-Tag: noindex` for `/admin`, and the game doesn't link to it.
- **Sign-in:** email login link. Supabase Auth's redirect URLs include the production site and `localhost`.
- **Works on a phone.**

Tabs:

1. **Slots:** a card per slot with the on/off switch, what's live now (thumbnail, brand and share of rotation as a percentage), what's scheduled next, and an empty-slot note.
2. **Campaigns:** list and editor.
   - **Fields:** brand, slot, link, dates, share and the on/off switch.
   - **Artwork:** upload with size, shape and file-size checks and a preview.
   - **Premium stall lines:** greeting and question-and-answer fields shown only for premium-stall slots.
   - **Tracking tags:** `utm_source=phatake-bazaar&utm_medium=game&utm_campaign=<slot>` is added to the link unless the link already has `utm_` parameters.
   - **Preview in game** button.
3. **Stats:** per-campaign daily views, clicks and click rate for a chosen date range, with a CSV download.
4. **Enquiries:** newest first with a "new" badge, a status switch, a private note and a **Create campaign** button that pre-fills brand and `enquiry_id`.

## Error handling

| Failure | Result |
|---|---|
| `bazaar_ads()` times out or fails | Cached answer, or today's on-slots with Diwali art. No message to the player |
| Artwork fails to load | That board keeps Diwali art |
| `track` fails | Events for that batch are dropped. No retry, so a failure costs a few counts and never spams the server |
| `enquire` fails | The form keeps its text and shows "Couldn't send. Try again in a minute." |
| Admin upload fails | The campaign isn't saved, and the error is shown next to the upload |

## Testing

- **Database rules:** apply the migration to a disposable copy (a Supabase branch or local stack). A script checks that the public key can call `bazaar_ads()` and nothing else, that it never sees off or out-of-date campaigns, that an admin can do everything listed above, and that a signed-in non-admin can do nothing.
- **Server functions:** Deno tests for validation, the decoy field, de-duplication and rate caps.
- **`brands.js`:** Node tests for rotation weights (over 10,000 picks, shares land within 2%), that the cache is used first, and timeout handling.
- **Game in headless Chrome,** with the live Supabase blocked and answers mocked: slot off, on and empty, and live; artwork failing to load; Supabase unreachable; view counted after 1 second on screen and not before; click counted; preview strip shown with no tracking.
- **Admin page in headless Chrome** against the test database: sign in, create a campaign with artwork, preview it, download CSV, and turn an enquiry into a campaign.

## Rollout

1. Ship the migration, server functions and admin page. The game is unchanged. Enter KollabKit as the first campaign on `stall-ring`, `hoarding-entry` and `hoarding-jhoola`.
2. Ship the game change. Check that KollabKit looks the same as before and that stats arrive.
3. After a week of clean stats, delete `ads/kollabkit-*`.

## Prerequisites

- Clone the GitHub repo next to this folder. This folder isn't a git checkout. The pedestrian, maidan-lighting and refill changes made here on 2026-10-22 move into the clone.
- Owner approval before anything is applied to the live Supabase project.
