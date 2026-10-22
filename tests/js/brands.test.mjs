import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const B = createRequire(import.meta.url)('../../brands.js');

const A = { id: 'a', brand: 'Acme', slot_id: 'hoarding-entry', link: 'https://acme.example/', art: { wide: 'https://cdn/a.jpg' }, lines: null, share: 1 };
const Bc = { id: 'b', brand: 'Bolt', slot_id: 'hoarding-entry', link: 'https://bolt.example/', art: { wide: 'https://cdn/b.jpg' }, lines: null, share: 3 };
const S = { id: 's', brand: 'Stall', slot_id: 'stall-ring', link: 'https://stall.example/', art: { wide: 'https://cdn/s.jpg', tall: 'https://cdn/t.jpg' },
  lines: { greet: [['Hi', 'नमस्ते']], qa: [{ q: ['Q', 'प्र'], a: ['A', 'उ'] }] }, share: 1 };
const DATA = { slots: [{ id: 'hoarding-entry', kind: 'hoarding' }, { id: 'stall-ring', kind: 'premium_stall' }, { id: 'hoarding-jhoola', kind: 'hoarding' }],
  campaigns: [A, Bc, S] };

function store(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}
const tick = () => new Promise((r) => setImmediate(r));

test('pick follows the shares', () => {
  let b = 0;
  for (let i = 0; i < 10000; i++) if (B.pick([A, Bc], Math.random).id === 'b') b++;
  assert.ok(Math.abs(b / 10000 - 0.75) < 0.02, `bolt picked ${b / 100}%`);
  assert.equal(B.pick([A, Bc], () => 0.24).id, 'a'); // 0.96 of 4 falls in Acme's 1
  assert.equal(B.pick([A, Bc], () => 0.26).id, 'b'); // 1.04 falls in Bolt's 3
  assert.equal(B.pick([], Math.random), null);
});

test('choose keeps a saved pick while it is still live', () => {
  const st = B.choose(DATA, { 'hoarding-entry': 'a' }, () => 0.99);
  assert.equal(st.slots['hoarding-entry'].campaign.id, 'a');
  assert.deepEqual(st.saved, { 'hoarding-entry': 'a', 'stall-ring': 's' });
});

test('choose replaces a saved pick that has ended', () => {
  const st = B.choose(DATA, { 'hoarding-entry': 'gone' }, () => 0.99);
  assert.equal(st.slots['hoarding-entry'].campaign.id, 'b');
  assert.equal(st.saved['hoarding-entry'], 'b');
});

test('choose gives an empty switched-on slot no campaign', () => {
  const st = B.choose(DATA, {}, () => 0);
  assert.deepEqual(st.slots['hoarding-jhoola'], { kind: 'hoarding', campaign: null });
  assert.equal(st.slots['stall-ring'].kind, 'premium_stall');
  assert.equal(Object.keys(st.slots).length, 3);
});

test('start with no cache shows fresh data once and caches it', async () => {
  const calls = [], storage = store(), session = store();
  B.start((s) => calls.push(s), { fetchAds: () => Promise.resolve(DATA), storage, session, rnd: () => 0 });
  assert.equal(calls.length, 0);
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].slots['hoarding-entry'].campaign.id, 'a');
  assert.deepEqual(JSON.parse(storage.getItem('pb_ads')), DATA);
  assert.deepEqual(JSON.parse(session.getItem('pb_ad_picks')), { 'hoarding-entry': 'a', 'stall-ring': 's' });
});

test('start shows the cache at once and again only when fresh data differs', async () => {
  const same = [], storage = store({ pb_ads: JSON.stringify(DATA) }), session = store({ pb_ad_picks: JSON.stringify({ 'hoarding-entry': 'a' }) });
  B.start((s) => same.push(s), { fetchAds: () => Promise.resolve(DATA), storage, session, rnd: () => 0 });
  assert.equal(same.length, 1, 'cache shown synchronously');
  await tick();
  assert.equal(same.length, 1, 'identical fresh data is not shown again');

  const changed = [];
  const fresh = { ...DATA, campaigns: [Bc, S] };
  B.start((s) => changed.push(s), { fetchAds: () => Promise.resolve(fresh), storage: store({ pb_ads: JSON.stringify(DATA) }),
    session: store({ pb_ad_picks: JSON.stringify({ 'hoarding-entry': 'a' }) }), rnd: () => 0 });
  await tick();
  assert.equal(changed.length, 2);
  assert.equal(changed[1].slots['hoarding-entry'].campaign.id, 'b');
});

test('start gives up after 4 seconds with nothing cached', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const calls = [];
    B.start((s) => calls.push(s), { fetchAds: () => new Promise(() => {}), storage: store(), session: store() });
    mock.timers.tick(3999);
    await tick();
    assert.equal(calls.length, 0);
    mock.timers.tick(1);
    await tick();
    assert.deepEqual(calls, [null]);
  } finally {
    mock.timers.reset();
  }
});

test('start keeps the cache when the fetch fails', async () => {
  const calls = [];
  B.start((s) => calls.push(s), { fetchAds: () => Promise.reject(new Error('offline')), storage: store({ pb_ads: JSON.stringify(DATA) }), session: store() });
  await tick();
  assert.equal(calls.length, 1);
  assert.notEqual(calls[0], null);
});

test('a corrupt cache is ignored', async () => {
  const calls = [];
  B.start((s) => calls.push(s), { fetchAds: () => Promise.reject(new Error('offline')), storage: store({ pb_ads: '{broken' }), session: store() });
  assert.equal(calls.length, 0);
  await tick();
  assert.deepEqual(calls, [null]);
});
