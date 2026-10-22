from run import open_game

OLD = {"Sharma Fireworks", "Gupta Crackers", "Pappu Chaat", "Raju Chai", "Laxmi Patakha", "Raja Rockets", "Chudi Bazaar", "Khilona Ghar",
       "Ring Phenko", "Gubbare Phodo", "Jalebi Junction", "Kulfi Wala", "Diya Ghar", "Kismat Chakra", "Sivakasi Wale", "Mishra Halwai"}


def walk(page, x, z, secs=120):
    return page.evaluate(f"__pbTest.walk({x},{z},{secs})")


def test_boots_on_the_new_map(browser):
    page, rec = open_game(browser, enter=False)
    x, z = page.evaluate("__pbTest.player()")
    assert abs(x) < 0.01 and abs(z - 8) < 0.01, (x, z)
    built, order = set(page.evaluate("__pbTest.stalls()")), set(page.evaluate("LAYOUT.ORDER"))
    assert OLD <= built, OLD - built
    assert built <= order, built - order
    assert rec.errors == [], rec.errors


def test_walk_from_the_gate_to_the_back_of_the_jhoola_ground(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.place(0,8)")
    r = walk(page, 10, -114)
    assert r["arrived"], r
    assert "Can't walk" not in (r["toast"] or ""), r
    assert rec.errors == [], rec.errors


def test_walk_across_the_ring(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.place(0,8)")
    s = page.evaluate("LAYOUT.slotAt(LAYOUT.ORDER.indexOf('Mishra Halwai'),LAYOUT.RING.walk-.5)")
    r = walk(page, s["x"], s["z"])
    assert r["arrived"], r
    page.evaluate("__pbTest.place(0,-34)")
    e = page.evaluate("(()=>{const c=LAYOUT.RIDES.columbus;return{x:c.x,z:c.z+3.6};})()")
    r = walk(page, e["x"], e["z"])
    assert r["arrived"], r
    assert rec.errors == [], rec.errors


def test_friend_far_away_is_drawn_where_they_are(browser):
    page, rec = open_game(browser)
    t = page.evaluate("__pbTest.peer({p:[-40,-115,0],n:'Far',h:40})")
    assert abs(t[0] + 40) < 0.01 and abs(t[1] + 115) < 0.01, t
    assert rec.errors == [], rec.errors


def test_no_decoration_is_dropped_for_lack_of_room(browser):
    page, rec = open_game(browser, enter=False)
    for name, (n, cap) in page.evaluate("__pbTest.caps()").items():
        assert n < cap, f"{name}: {n} of {cap} used, so some were not drawn"


def test_a_tap_past_the_fence_walks_to_the_fence(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.place(30,-112)")
    r = walk(page, 60, -112, 30)
    assert r["x"] > 38 and abs(r["z"] + 112) < 4, r
