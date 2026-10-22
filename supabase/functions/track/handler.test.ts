import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { handleTrack } from "./handler.ts";
import { todayIST } from "../_shared/http.ts";

Deno.env.set("IP_SALT", "test-salt");
Deno.env.set("ALLOWED_ORIGINS", "https://diwali-patakha-bazaar.vercel.app,http://localhost:*");

const SITE = "https://diwali-patakha-bazaar.vercel.app";
const C1 = "00000000-0000-0000-0000-0000000000a1";
const C2 = "00000000-0000-0000-0000-0000000000a2";

function fakeDb(allow = true) {
  const hits: [string, number, number][] = [];
  const events: [string, string, string, string][] = [];
  return {
    hits, events,
    hit: (k: string, w: number, m: number) => { hits.push([k, w, m]); return Promise.resolve(allow); },
    event: (v: string, c: string, t: string, d: string) => { events.push([v, c, t, d]); return Promise.resolve(true); },
  };
}
const today = () => "2026-11-01";
function post(body: unknown, origin = SITE, raw?: string) {
  return new Request("http://fn/track", {
    method: "POST",
    headers: { "content-type": "text/plain", origin, "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    body: raw ?? JSON.stringify(body),
  });
}

Deno.test("each event is recorded for today's India date", async () => {
  const db = fakeDb();
  const res = await handleTrack(post({ visit: "visit-abc123", events: [{ c: C1, t: "v" }, { c: C2, t: "v" }, { c: C1, t: "c" }] }), db, today);
  assertEquals(res.status, 204);
  assertEquals(db.events, [["visit-abc123", C1, "v", "2026-11-01"], ["visit-abc123", C2, "v", "2026-11-01"], ["visit-abc123", C1, "c", "2026-11-01"]]);
});

Deno.test("only the first 50 events of a request are processed", async () => {
  const db = fakeDb();
  const events = Array.from({ length: 51 }, () => ({ c: C1, t: "v" }));
  assertEquals((await handleTrack(post({ visit: "visit-abc123", events }), db, today)).status, 204);
  assertEquals(db.events.length, 50);
});

Deno.test("over the rate cap nothing is recorded but the reply is the same", async () => {
  const db = fakeDb(false);
  const res = await handleTrack(post({ visit: "visit-abc123", events: [{ c: C1, t: "v" }] }), db, today);
  assertEquals(res.status, 204);
  assertEquals(db.events.length, 0);
  assertEquals(db.hits.map(([, w, m]) => [w, m]), [[60, 60]]);
});

Deno.test("the rate key is a hash, never the raw IP", async () => {
  const db = fakeDb();
  await handleTrack(post({ visit: "visit-abc123", events: [{ c: C1, t: "v" }] }), db, today);
  const key = db.hits[0][0];
  assert(!key.includes("203.0.113.9"), key);
  assert(/^trk:[0-9a-f]{64}$/.test(key), key);
});

Deno.test("malformed requests are refused", async () => {
  for (const [body, raw] of [
    [null, "{not json"],
    [{ visit: "visit-abc123", events: [{ c: C1, t: "x" }] }, undefined],
    [{ visit: "visit-abc123", events: [{ c: "not-a-uuid", t: "v" }] }, undefined],
    [{ visit: "short", events: [{ c: C1, t: "v" }] }, undefined],
    [{ visit: "visit-abc123", events: "nope" }, undefined],
  ] as [unknown, string | undefined][]) {
    const db = fakeDb();
    assertEquals((await handleTrack(post(body, SITE, raw), db, today)).status, 400, raw ?? JSON.stringify(body));
    assertEquals(db.events.length, 0);
  }
});

Deno.test("other origins are refused", async () => {
  const db = fakeDb();
  const res = await handleTrack(post({ visit: "visit-abc123", events: [{ c: C1, t: "v" }] }, "https://evil.example"), db, today);
  assertEquals(res.status, 403);
  assertEquals(db.events.length, 0);
});

Deno.test("localhost on any port is allowed", async () => {
  const db = fakeDb();
  assertEquals((await handleTrack(post({ visit: "visit-abc123", events: [{ c: C1, t: "v" }] }, "http://localhost:8765"), db, today)).status, 204);
});

Deno.test("GET is not allowed; OPTIONS answers CORS for the site", async () => {
  assertEquals((await handleTrack(new Request("http://fn/track", { headers: { origin: SITE } }), fakeDb(), today)).status, 405);
  const res = await handleTrack(new Request("http://fn/track", { method: "OPTIONS", headers: { origin: SITE } }), fakeDb(), today);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), SITE);
  const other = await handleTrack(new Request("http://fn/track", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), fakeDb(), today);
  assertEquals(other.headers.get("access-control-allow-origin"), null);
});

Deno.test("India's date flips at 18:30 UTC", () => {
  assertEquals(todayIST(new Date("2026-10-31T18:29:59Z")), "2026-10-31");
  assertEquals(todayIST(new Date("2026-10-31T18:30:00Z")), "2026-11-01");
});
