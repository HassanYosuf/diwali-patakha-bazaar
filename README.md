# Phatake Bazaar

A first-person 3D Diwali mela that runs in the browser. Walk a ring of sixteen stalls, bargain with shopkeepers, eat jalebi and kulfi, win at ring toss, ride the giant wheel and burst crackers in the maidan. Everything is pretend money.

**Play:** https://diwali-patakha-bazaar.vercel.app

## Controls

| Desktop | Phone |
| --- | --- |
| W A S D / arrows to walk, Shift to run | Left joystick (push to the edge to run) |
| Drag to look, double-click or L for mouse look | Drag anywhere else to look |
| Click the ground or a stall to walk there | Tap to walk there |
| E to talk or play, F to eat, Space to hop | Tap the on-screen prompts |
| 1 – 9 to pick a cracker or a dialog choice | Tap the cracker tray |

## How it's built

- One static page, `index.html`, with no build step.
- three.js r128 and its post-processing passes load from cdnjs and jsDelivr. Fonts come from Google Fonts.
- Sound is synthesised live with the Web Audio API. Shopkeeper voices use the browser's speech synthesis.
- Progress (purse, bag, bangles, name, last aangan) is saved in `localStorage`. When the purse drops below ₹100, ↻ Refill appears in the top bar and resets it to a fresh ₹2,000, as often as needed. The bag is kept.
- Live multiplayer runs on Supabase Realtime (project `phatake-bazaar`). `net.js` gives the game the same `room` interface it had as a claude.ai artifact: membership uses Realtime presence, while position, crackers and chat go out as throttled broadcasts.
- Before entering, each player types a name and picks an avatar (kurta, sherwani, lehenga or saree, in 8 colours and 4 skin tones). Friends see that look and name.
- At any shop, the "Buying for" row lets you buy crackers, food, bangles, a balloon or a phirki for another player. It comes out of your purse, lands in their bag or hand, and everyone sees it in chat. Age limits apply to the recipient too.
- Behind the giant wheel is a jhoola ground with three more rides: Ghoda Gaadi (merry-go-round), Columbus Naav (swing boat) and Udan Khatola (flying chairs). Every ride runs off the wall clock, so all players see the same seats in the same place. Friends on a ride sit next to you (same gondola or bench where there is room) and see each other riding.
- Everyone on the link shares the open bazaar. "Start a private aangan" makes a code like `diya-4821`, and the invite link carries it (`/#diya-4821`) so friends land straight in it. The address bar follows whichever aangan you are in, so a reload keeps you there. Opening the plain link after playing in an aangan asks whether to continue in it, start a new one or go to the open bazaar. If Realtime can't connect, the game falls back to solo play.
- Brand boards and stalls come from Supabase, managed at `/admin`. The code knows only where each slot stands; no brand name, link or image is in the game's code. See [Brands](#brands).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole game |
| `net.js` | Supabase Realtime connector for live play and chat |
| `brands.js` | Loads the live brand campaigns, picks one per slot per visit, counts views and clicks, and handles admin previews |
| `sb-config.js` | Supabase project URL and public anon key, shared by the game and the admin page |
| `admin.html` | The admin page at `/admin`: slots, campaigns, stats and enquiries |
| `ads/` | The original KollabKit artwork, kept until it has been uploaded as campaigns in the admin page, then deleted |
| `supabase/` | Database migration, the `track` and `enquire` Edge Functions, local config and database tests |
| `tests/` | Test tooling (`tests/all.sh` runs everything); not deployed |
| `og.jpg` | 1200×630 link preview for WhatsApp, X and others |
| `vercel.json` | Clean URLs, cache and security headers |

## Run locally

```sh
npx serve .
```

Then open the printed URL. Opening `index.html` straight from disk mostly works, but brand boards keep their Diwali art because browsers block image textures from `file://`.

## Deploy

Pushes to `main` deploy automatically through Vercel. If you move the site to a custom domain, update the `og:url`, `og:image`, `twitter:image` and `canonical` URLs at the top of `index.html`.

## Brands

A few fixed **slots** in the bazaar carry brands. Each slot has a kind and a place in the world, set in `index.html` (`SLOT_DEFS`):

| Slot | Kind | Where |
| --- | --- | --- |
| `stall-ring` | Premium stall (talking shopkeeper) | Ring, between Diya Ghar and Sivakasi Wale |
| `stall-ring-b` | Premium stall | Ring, the mirror gap across the north path (starts off) |
| `hoarding-entry` | Hoarding | Entry lane |
| `hoarding-entry-b` | Hoarding | Entry lane, other side (starts off) |
| `hoarding-jhoola` | Hoarding | Jhoola ground |

A slot is **off** (nothing drawn), **on with no live brand** (Diwali art), or **on with brands** (one picked per visit, weighted by each campaign's rotation share). Everything else is data, edited at `/admin`:

- **Add a brand:** Campaigns → New campaign. Pick the slot, add the link, dates (India time, both days included), rotation share (1–10) and artwork. Hoardings take one 16:9 image; stalls also take a 9:16 tall panel (keep its bottom sixth free of text, the counter hides it); the premium stall also takes 1–3 greetings and 2–3 questions and answers in English and Hindi. Images are JPG, PNG or WebP up to 1 MB. Tracking tags (`utm_source=phatake-bazaar…`) are added to the link unless it already has some. **Preview in game** shows it on its slot before it goes live.
- **Switch a slot on or off:** Slots tab.
- **Stats:** views and clicks per campaign per day, with a CSV download. A view is the board on screen, within 25 m, for a second; each player counts once per brand per day.
- **Enquiries:** "Advertise with us" in the game's Help panel lands here. **Create campaign** turns one into a campaign.

**Adding an admin:** in the Supabase dashboard, Authentication → Users → Invite user, then add their email (lower case) to the `admins` table. Sign-ups are off; only invited users with a row in `admins` see anything.

## Tests

The tests run against a local Supabase stack in Docker and never touch the live project.

```sh
brew install deno                       # once
npm --prefix tests install              # once: pinned Supabase CLI
npm --prefix tests run db:start         # local Supabase on 127.0.0.1:54321
sh tests/all.sh                         # database, functions, brands.js, game and admin tests
```

Browser tests use Playwright for Python with the installed Chrome (`pip3 install playwright`).

