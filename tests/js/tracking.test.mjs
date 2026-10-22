import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const B = createRequire(import.meta.url)('../../brands.js');

const TRACK = 'https://sb.example/functions/v1/track';
function env(over = {}) {
  const m = new Map();
  const e = {
    session: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) },
    storage: { getItem: () => null, setItem: () => {} },
    beacons: [], opened: [], ticks: [], hides: [],
    beacon: (url, blob) => { e.beacons.push({ url, blob }); return true; },
    setInterval: (fn, ms) => e.ticks.push({ fn, ms }),
    onPageHide: (fn) => e.hides.push(fn),
    openWin: (url) => e.opened.push(url),
    url: TRACK, search: '', token: null,
    fetchPreview: () => Promise.reject(new Error('not used')),
    ...over,
  };
  return e;
}
const sent = async (e) => Promise.all(e.beacons.map(async (b) => ({ url: b.url, type: b.blob.type, body: JSON.parse(await b.blob.text()) })));
const tick = () => new Promise((r) => setImmediate(r));

test('a view is queued once per campaign per visit and sent on the 30s flush', async () => {
  const e = env(), t = B.create(e);
  t.seen('a'); t.seen('a'); t.seen('b');
  assert.equal(e.ticks.length, 1);
  assert.equal(e.ticks[0].ms, 30000);
  e.ticks[0].fn();
  const [b] = await sent(e);
  assert.equal(b.url, TRACK);
  assert.equal(b.type, 'text/plain');
  assert.deepEqual(b.body, { visit: t.visit, events: [{ c: 'a', t: 'v' }, { c: 'b', t: 'v' }] });
  e.ticks[0].fn();
  assert.equal(e.beacons.length, 1, 'nothing left to send');
});

test('a view and a click on the same campaign both count', async () => {
  const e = env(), t = B.create(e);
  t.seen('a'); t.clicked('a'); t.clicked('a');
  e.ticks[0].fn();
  assert.deepEqual((await sent(e))[0].body.events, [{ c: 'a', t: 'v' }, { c: 'a', t: 'c' }]);
});

test('open refuses anything but https and records a click otherwise', async () => {
  const e = env(), t = B.create(e);
  assert.equal(t.open({ id: 'x', link: 'javascript:alert(1)' }), false);
  assert.equal(t.open({ id: 'y', link: 'http://plain.example' }), false);
  assert.deepEqual(e.opened, []);
  assert.equal(t.open({ id: 'a', link: 'https://acme.example/?utm_source=phatake-bazaar' }), true);
  assert.deepEqual(e.opened, ['https://acme.example/?utm_source=phatake-bazaar']);
  e.ticks[0].fn();
  assert.deepEqual((await sent(e))[0].body.events, [{ c: 'a', t: 'c' }]);
});

test('a timed flush sends at most 50 events; the rest wait', async () => {
  const e = env(), t = B.create(e);
  for (let i = 0; i < 60; i++) t.seen('c' + i);
  e.ticks[0].fn();
  e.ticks[0].fn();
  const b = await sent(e);
  assert.deepEqual(b.map((x) => x.body.events.length), [50, 10]);
});

test('leaving the page sends everything left, 50 per beacon', async () => {
  const e = env(), t = B.create(e);
  for (let i = 0; i < 60; i++) t.seen('c' + i);
  e.hides[0]();
  assert.deepEqual((await sent(e)).map((x) => x.body.events.length), [50, 10]);
});

test('the visit id lasts for the tab', () => {
  const e = env(), a = B.create(e), b = B.create(e);
  assert.equal(a.visit, b.visit);
  assert.ok(a.visit.length >= 8 && a.visit.length <= 40, a.visit);
  assert.notEqual(B.create(env()).visit, a.visit);
});

const PREVIEW = { id: 'p1', brand: 'Soon', slot_id: 'stall-ring-b', link: 'https://soon.example/', art: { wide: 'https://cdn/w.jpg', tall: 'https://cdn/t.jpg' },
  lines: { greet: [['Hi', 'नमस्ते']], qa: [] }, share: 1, kind: 'premium_stall' };
const DATA = { slots: [{ id: 'hoarding-entry', kind: 'hoarding' }], campaigns: [] };

test('an admin preview forces the campaign onto its slot and counts nothing', async () => {
  const asked = [];
  const e = env({ search: '?preview=p1', token: 'admin-token', fetchPreview: (id, tok) => { asked.push([id, tok]); return Promise.resolve(PREVIEW); } });
  const t = B.create(e);
  assert.equal(t.previewing, true);
  const calls = [];
  t.start((s) => calls.push(s), { fetchAds: () => Promise.resolve(DATA), storage: e.storage, session: e.session });
  await tick(); await tick();
  assert.deepEqual(asked, [['p1', 'admin-token']]);
  const last = calls.at(-1);
  assert.equal(last.slots['stall-ring-b'].kind, 'premium_stall');
  assert.equal(last.slots['stall-ring-b'].campaign.id, 'p1');
  assert.deepEqual(last.slots['hoarding-entry'], { kind: 'hoarding', campaign: null });
  t.seen('p1'); t.clicked('p1'); e.hides[0](); e.ticks[0].fn();
  assert.equal(e.beacons.length, 0);
});

test('a preview link without an admin session is ignored', async () => {
  const e = env({ search: '?preview=p1', token: null });
  const t = B.create(e);
  assert.equal(t.previewing, false);
  t.seen('a'); e.ticks[0].fn();
  assert.equal(e.beacons.length, 1);
});
