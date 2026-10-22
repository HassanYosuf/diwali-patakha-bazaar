import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const L = createRequire(import.meta.url)('../../layout.js');

const OLD = ['Sharma Fireworks', 'Gupta Crackers', 'Pappu Chaat', 'Raju Chai', 'Laxmi Patakha', 'Raja Rockets', 'Chudi Bazaar', 'Khilona Ghar',
  'Ring Phenko', 'Gubbare Phodo', 'Jalebi Junction', 'Kulfi Wala', 'Diya Ghar', 'Kismat Chakra', 'Sivakasi Wale', 'Mishra Halwai'];
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('the ring has 20 slots with the lane and corridor openings', () => {
  assert.equal(L.ORDER.length, 20);
  assert.equal(L.ORDER[0], null);
  assert.equal(L.ORDER[10], null);
  assert.equal(L.ORDER.filter((x) => x).length, 18);
});

test('every stall stands in the ring exactly once', () => {
  for (const n of OLD) assert.equal(L.ORDER.filter((x) => x === n).length, 1, n);
});

test('KollabKit and the brand stall keep their neighbours', () => {
  const i = (n) => L.ORDER.indexOf(n);
  assert.equal(i('kollabkit'), i('Diya Ghar') + 1);
  assert.equal(i('kollabkit'), i('Sivakasi Wale') - 1);
  assert.equal(i('brand:stall-ring-b'), i('Mishra Halwai') + 1);
  assert.equal(i('brand:stall-ring-b'), i('Kismat Chakra') - 1);
});

test('slotAt puts slot 0 on the gate side facing the centre', () => {
  const s = L.slotAt(0, 61);
  assert.ok(near(s.x, 0) && near(s.z, -15) && near(Math.cos(s.ry), -1) && near(Math.sin(s.ry), 0), JSON.stringify(s)); // faces -z, toward the centre
  assert.ok(near(L.slotAt(10, 61).z, -137));
});

test('zoneAt names every part of the map', () => {
  assert.equal(L.zoneAt(0, 8), 'lane');
  assert.equal(L.zoneAt(0, -70), 'maidan');
  assert.equal(L.zoneAt(0, -30), 'ring');
  assert.equal(L.zoneAt(0, -140), 'corridor');
  assert.equal(L.zoneAt(0, -200), 'jhoola');
  assert.equal(L.zoneAt(120, 0), 'outside');
  assert.equal(L.zoneAt(0, 30), 'outside');
});

test('clampToMap keeps far friends where they are and pulls strays in', () => {
  assert.deepEqual(L.clampToMap(-75, -238), { x: -75, z: -238 });
  assert.deepEqual(L.clampToMap(500, -500), { x: 87, z: -245 });
});

test('clampToMaidan pulls crackers onto the maidan edge', () => {
  const p = L.clampToMaidan(0, -30);
  assert.ok(near(Math.hypot(p.x - L.C.x, p.z - L.C.z), 36), JSON.stringify(p));
  assert.deepEqual(L.clampToMaidan(0, -72), { x: 0, z: -72 });
});

// footprints as axis-aligned boxes; circles use their bounding box, which is stricter
function boxes() {
  const b = [{ id: 'wheel', x: L.WHEEL.x, z: L.WHEEL.z, hx: L.WHEEL.hx, hz: L.WHEEL.hz }];
  for (const [id, r] of Object.entries(L.RIDES)) b.push({ id, x: r.x, z: r.z, hx: r.hx ?? r.r, hz: r.hz ?? r.r });
  const st = L.MAUT.stairs;
  b.push({ id: 'maut stairs', x: st.x, z: st.z, hx: st.hx, hz: st.hz, part: 'maut' });
  return b;
}
const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - a.hx - b.hx, Math.abs(a.z - b.z) - a.hz - b.hz);

test('rides keep 8 m apart and all sit inside the jhoola ground', () => {
  const all = boxes();
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    assert.ok(a.x - a.hx >= L.JG.x0 + 1 && a.x + a.hx <= L.JG.x1 - 1 && a.z - a.hz >= L.JG.z0 + 1 && a.z + a.hz <= L.JG.z1 - 1, `${a.id} outside`);
    for (let j = i + 1; j < all.length; j++) if (!(a.part && a.part === all[j].id) && !(all[j].part && all[j].part === a.id)) assert.ok(gap(a, all[j]) >= 8, `${a.id} too close to ${all[j].id}`);
  }
});

test('the maut ka kuan stairs touch the well', () => {
  const m = L.MAUT, st = m.stairs;
  assert.ok(Math.abs(st.z - st.hz - (m.z + m.r)) < 1.5, JSON.stringify({ m, st }));
});

test('the balloon-wala and dhol-wala stand on the parikrama path', () => {
  for (const p of [L.BW, L.DHOL]) {
    const r = dist(p, L.C);
    assert.ok(L.walkable(p.x, p.z) && r > L.RING.maid && r < L.RING.walk - 1, `${JSON.stringify(p)} at radius ${r.toFixed(1)}`);
  }
});

// ---- walking and routing ----
const open = (x, z) => L.walkable(x, z) && !L.blocked(x, z);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('walkable covers the lane, ring, corridor and jhoola ground only', () => {
  const yes = [[L.SPAWN.x, L.SPAWN.z], [0, L.GATE.z], [0, -72], [0, -140], [0, -200], [75, -238]];
  L.ORDER.forEach((n, k) => { if (n) { const s = L.slotAt(k, L.RING.walk - 0.5); yes.push([s.x, s.z]); } });
  for (const [x, z] of yes) assert.ok(L.walkable(x, z), `${x},${z} should be walkable`);
  for (const [x, z] of [[0.3, -76], [0, 11], [9, 0], [12, -140], [86, -200], [0, -244]]) assert.ok(!L.walkable(x, z), `${x},${z} should not be walkable`);
});

test('blocked marks the rides and maut ka kuan, and nothing else', () => {
  const yes = [[L.WHEEL.x, L.WHEEL.z], ...Object.values(L.RIDES).map((r) => [r.x, r.z]), [L.MAUT.stairs.x, L.MAUT.stairs.z]];
  for (const [x, z] of yes) assert.ok(L.blocked(x, z), `${x},${z} should be blocked`);
  for (const [x, z] of [[0, -200], [-40, -200], [60, -160]]) assert.ok(!L.blocked(x, z), `${x},${z} should be clear`);
});

function pathOk(fx, fz, tx, tz) {
  const pts = [{ x: fx, z: fz }, ...L.route(fx, fz, tx, tz), { x: tx, z: tz }];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(dist(a, b) / 0.5));
    for (let j = 0; j <= n; j++) {
      const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n;
      if (!open(x, z)) return `${x.toFixed(2)},${z.toFixed(2)} not open on leg ${i}`;
      if (Math.hypot(x - L.C.x, z - L.C.z) < 1) return `${x.toFixed(2)},${z.toFixed(2)} within 1 m of the pole`;
    }
  }
  return pts;
}

test('route keeps every step on open ground for 2,000 random walks', () => {
  const rnd = mulberry32(42), t0 = Date.now(), B = L.BOUNDS;
  const pt = () => { for (;;) { const x = B.x0 + rnd() * (B.x1 - B.x0), z = B.z0 + rnd() * (B.z1 - B.z0); if (open(x, z) && Math.hypot(x - L.C.x, z - L.C.z) > 1.2) return [x, z]; } };
  for (let i = 0; i < 2000; i++) {
    const [fx, fz] = pt(), [tx, tz] = pt(), r = pathOk(fx, fz, tx, tz);
    assert.ok(Array.isArray(r), `walk ${i} ${fx.toFixed(1)},${fz.toFixed(1)} → ${tx.toFixed(1)},${tz.toFixed(1)}: ${r}`);
  }
  assert.ok(Date.now() - t0 < 20000, `took ${Date.now() - t0} ms`);
});

test('the way from the gate to the back of the jhoola ground runs up the corridor', () => {
  const pts = pathOk(0, 8, 10, -238);
  assert.ok(Array.isArray(pts), pts);
  let corridor = false;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j <= 40; j++) {
    const x = pts[i].x + (pts[i + 1].x - pts[i].x) * j / 40, z = pts[i].z + (pts[i + 1].z - pts[i].z) * j / 40;
    if (L.zoneAt(x, z) === 'corridor') corridor = true;
  }
  assert.ok(corridor);
});

test('nearestWalkable pulls a tap outside the fence to the nearest open ground', () => {
  const a = L.nearestWalkable(90, -200);
  assert.ok(L.walkable(a.x, a.z) && !L.blocked(a.x, a.z), JSON.stringify(a));
  assert.ok(Math.hypot(a.x - 90, a.z + 200) < 8, JSON.stringify(a));
  const b = L.nearestWalkable(0, 30);
  assert.ok(L.walkable(b.x, b.z) && Math.hypot(b.x, b.z - 10) < 3, JSON.stringify(b));
  assert.deepEqual(L.nearestWalkable(0, -200), { x: 0, z: -200 });
});
