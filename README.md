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
- Progress (purse, bag, bangles, name) is saved in `localStorage`.
- Live multiplayer runs on Supabase Realtime (project `phatake-bazaar`). `net.js` gives the game the same `room` interface it had as a claude.ai artifact: membership uses Realtime presence, while position, crackers and chat go out as throttled broadcasts. No database tables are used.
- Before entering, each player types a name and picks an avatar (kurta, sherwani, lehenga or saree, in 8 colours and 4 skin tones). Friends see that look and name.
- At any shop, the "Buying for" row lets you buy crackers, food, bangles, a balloon or a phirki for another player. It comes out of your purse, lands in their bag or hand, and everyone sees it in chat. Age limits apply to the recipient too.
- Everyone on the link shares the open bazaar. "Start a private aangan" makes a code like `diya-4821`, and the invite link carries it (`/#diya-4821`) so friends land straight in it. If Realtime can't connect, the game falls back to solo play.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole game |
| `net.js` | Supabase Realtime connector for live play and chat |
| `og.jpg` | 1200×630 link preview for WhatsApp, X and others |
| `vercel.json` | Clean URLs, cache and security headers |

## Run locally

```sh
npx serve .
```

Then open the printed URL. Opening `index.html` straight from disk also works.

## Deploy

Pushes to `main` deploy automatically through Vercel. If you move the site to a custom domain, update the `og:url`, `og:image`, `twitter:image` and `canonical` URLs at the top of `index.html`.
