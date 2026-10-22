import { assertEquals } from "jsr:@std/assert@1.0.13";
import { handleEnquire } from "./handler.ts";

Deno.env.set("IP_SALT", "test-salt");
Deno.env.set("ALLOWED_ORIGINS", "https://diwali-patakha-bazaar.vercel.app,http://localhost:*");
const SITE = "https://diwali-patakha-bazaar.vercel.app";

function fakeDb() {
  const rows: Record<string, unknown>[] = [];
  const counts = new Map<string, number>();
  return {
    rows, counts,
    hit: (k: string, w: number, m: number) => {
      const n = (counts.get(k) ?? 0) + 1;
      counts.set(k, n);
      return Promise.resolve(w === 3600 && n <= m);
    },
    insert: (row: Record<string, unknown>) => { rows.push(row); return Promise.resolve(); },
  };
}
const good = { name: "Asha", brand: "Bolt Tea", contact: "asha@bolt.example", interest: "hoarding", message: "Diwali week please", website: "" };
function post(body: unknown, raw?: string, origin = SITE) {
  return new Request("http://fn/enquire", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": "198.51.100.7" },
    body: raw ?? JSON.stringify(body),
  });
}

Deno.test("a valid enquiry stores exactly the five fields, trimmed", async () => {
  const db = fakeDb();
  const res = await handleEnquire(post({ ...good, name: "  Asha  ", message: " hi \n" }), db);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(db.rows, [{ name: "Asha", brand: "Bolt Tea", contact: "asha@bolt.example", interest: "hoarding", message: "hi" }]);
});

Deno.test("a filled decoy field looks like success and stores nothing", async () => {
  const db = fakeDb();
  const res = await handleEnquire(post({ ...good, website: "http://spam.example" }), db);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true });
  assertEquals(db.rows.length, 0);
});

Deno.test("the fourth enquiry from one IP within the hour is refused", async () => {
  const db = fakeDb();
  for (let i = 0; i < 3; i++) assertEquals((await handleEnquire(post(good), db)).status, 200);
  const res = await handleEnquire(post(good), db);
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { ok: false, error: "rate" });
  assertEquals(db.rows.length, 3);
  const [key] = db.counts.keys();
  assertEquals(/^enq:[0-9a-f]{64}$/.test(key), true, key);
});

Deno.test("each out-of-bounds field is named", async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ name: "" }, "name"], [{ name: "   " }, "name"], [{ name: "x".repeat(81) }, "name"],
    [{ brand: "" }, "brand"], [{ brand: "x".repeat(81) }, "brand"],
    [{ contact: "ab" }, "contact"], [{ contact: "x".repeat(121) }, "contact"],
    [{ interest: "billboard" }, "interest"],
    [{ message: "x".repeat(1001) }, "message"],
    [{ name: 42 }, "name"],
  ];
  for (const [patch, field] of cases) {
    const db = fakeDb();
    const res = await handleEnquire(post({ ...good, ...patch }), db);
    assertEquals(res.status, 400, JSON.stringify(patch));
    assertEquals(await res.json(), { ok: false, error: field });
    assertEquals(db.rows.length, 0);
  }
});

Deno.test("limits are inclusive at the edges", async () => {
  const db = fakeDb();
  const res = await handleEnquire(post({ ...good, name: "x".repeat(80), contact: "a@b", message: "x".repeat(1000) }), db);
  assertEquals(res.status, 200);
});

Deno.test("broken JSON, other origins and GET are refused", async () => {
  assertEquals((await handleEnquire(post(null, "{oops"), fakeDb())).status, 400);
  assertEquals((await handleEnquire(post(good, undefined, "https://evil.example"), fakeDb())).status, 403);
  assertEquals((await handleEnquire(new Request("http://fn/enquire", { headers: { origin: SITE } }), fakeDb())).status, 405);
  const pre = await handleEnquire(new Request("http://fn/enquire", { method: "OPTIONS", headers: { origin: SITE } }), fakeDb());
  assertEquals(pre.status, 204);
  assertEquals(pre.headers.get("access-control-allow-origin"), SITE);
});
