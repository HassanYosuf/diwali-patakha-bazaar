import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../../layout.js');

const OLD = ['Sharma Fireworks', 'Gupta Crackers', 'Pappu Chaat', 'Raju Chai', 'Laxmi Patakha', 'Raja Rockets', 'Chudi Bazaar', 'Khilona Ghar',
  'Ring Phenko', 'Gubbare Phodo', 'Jalebi Junction', 'Kulfi Wala', 'Diya Ghar', 'Kismat Chakra', 'Sivakasi Wale', 'Mishra Halwai'];
const NEW = ['Momo Point', 'Mehendi Corner', 'Dabba Giraao', 'Bombay Pav Bhaji', 'Bioscope', 'Ganne ka Ras', 'Photo Studio', 'Akash Kandil'];
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('the ring has 30 slots with the lane and corridor openings', () => {
  assert.equal(L.ORDER.length, 30);
  assert.equal(L.ORDER[0], null);
  assert.equal(L.ORDER[15], null);
});

test('every stall stands in the ring exactly once', () => {
  for (const n of [...OLD, ...NEW]) assert.equal(L.ORDER.filter((x) => x === n).length, 1, n);
});

test('KollabKit and the brand stall keep their neighbours', () => {
  const i = (n) => L.ORDER.indexOf(n);
  assert.equal(i('kollabkit'), i('Diya Ghar') + 1);
  assert.equal(i('kollabkit'), i('Sivakasi Wale') - 1);
  assert.equal(i('brand:stall-ring-b'), i('Mishra Halwai') + 1);
  assert.equal(i('brand:stall-ring-b'), i('Kismat Chakra') - 1);
  assert.equal(L.ORDER[14], 'cart');
  assert.equal(L.ORDER[16], 'cart');
});

test('slotAt puts slot 0 on the gate side facing the centre', () => {
  const s = L.slotAt(0, 49);
  assert.ok(near(s.x, 0) && near(s.z, -15) && near(Math.cos(s.ry), -1) && near(Math.sin(s.ry), 0), JSON.stringify(s)); // faces -z, toward the centre
  assert.ok(near(L.slotAt(15, 49).z, -113));
});

test('zoneAt names every part of the map', () => {
  assert.equal(L.zoneAt(0, 8), 'lane');
  assert.equal(L.zoneAt(0, -54), 'maidan');
  assert.equal(L.zoneAt(0, -24), 'ring');
  assert.equal(L.zoneAt(0, -116), 'corridor');
  assert.equal(L.zoneAt(0, -180), 'jhoola');
  assert.equal(L.zoneAt(100, 0), 'outside');
  assert.equal(L.zoneAt(0, 30), 'outside');
});

test('clampToMap keeps far friends where they are and pulls strays in', () => {
  assert.deepEqual(L.clampToMap(-60, -215), { x: -60, z: -215 });
  assert.deepEqual(L.clampToMap(500, -500), { x: 70, z: -221 });
});

test('clampToMaidan pulls crackers onto the maidan edge', () => {
  const p = L.clampToMaidan(0, -24);
  assert.ok(near(Math.hypot(p.x - L.C.x, p.z - L.C.z), 29), JSON.stringify(p));
  assert.deepEqual(L.clampToMaidan(0, -60), { x: 0, z: -60 });
});

// footprints as axis-aligned boxes; circles use their bounding box, which is stricter
function boxes() {
  const b = [{ id: 'wheel', x: L.WHEEL.x, z: L.WHEEL.z, hx: L.WHEEL.hx, hz: L.WHEEL.hz }];
  for (const [id, r] of Object.entries(L.RIDES)) b.push({ id, x: r.x, z: r.z, hx: r.hx ?? r.r, hz: r.hz ?? r.r });
  for (const p of [...L.PLOTS, ...L.OPEN_PLOTS]) b.push({ id: p.id || `open ${p.x},${p.z}`, x: p.x, z: p.z, hx: p.w / 2, hz: p.d / 2 });
  return b;
}
const jCarts = () => L.CARTS.filter((c) => L.zoneAt(c.x, c.z) === 'jhoola');
const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - a.hx - b.hx, Math.abs(a.z - b.z) - a.hz - b.hz);

test('no two footprints overlap and all sit inside the jhoola ground', () => {
  const all = [...boxes(), ...jCarts().map((c, i) => ({ id: `cart ${i}`, x: c.x, z: c.z, hx: 1.1, hz: 1.1 }))];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    assert.ok(a.x - a.hx >= L.JG.x0 + 1 && a.x + a.hx <= L.JG.x1 - 1 && a.z - a.hz >= L.JG.z0 + 1 && a.z + a.hz <= L.JG.z1 - 1, `${a.id} outside`);
    for (let j = i + 1; j < all.length; j++) assert.ok(gap(a, all[j]) > 0, `${a.id} overlaps ${all[j].id}`);
  }
});

test('cart rows keep 4 m from every ride and plot', () => {
  assert.ok(jCarts().length >= 20, `only ${jCarts().length} jhoola carts`);
  for (const c of jCarts()) for (const b of boxes()) assert.ok(gap({ x: c.x, z: c.z, hx: 0, hz: 0 }, b) >= 4, `cart ${c.x},${c.z} near ${b.id}`);
});

test('the train lane stays clear', () => {
  const r0 = L.TRAIN.r0 - 0.5, r1 = L.TRAIN.r1 + 0.5;
  for (const p of [L.BW, L.DHOL, ...L.CARTS, L.BRAND_CART]) {
    const r = dist(p, L.C);
    assert.ok(r < r0 || r > r1, `${JSON.stringify(p)} at radius ${r.toFixed(1)}`);
  }
  assert.ok(L.NPC_BAND.r0 > L.TRAIN.r1);
});

test('carts cycle through the four kinds and the brand cart sits in slot 18', () => {
  assert.deepEqual(L.CARTS.slice(0, 4).map((c) => c.kind), ['chana', 'bhutta', 'gola', 'buddhi']);
  const s = L.slotAt(18, L.RING.stall - 0.6);
  assert.ok(near(L.BRAND_CART.x, s.x) && near(L.BRAND_CART.z, s.z));
});
