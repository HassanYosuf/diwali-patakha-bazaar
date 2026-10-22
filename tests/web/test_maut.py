from run import open_game


def to_the_stairs(page):
    page.evaluate("(()=>{const R=__pbTest.ride('maut');__pbTest.view(R.x,R.z+1.2,0,0);})()")


def test_maut_ka_kuan_is_on_the_jhoola_ground(browser):
    page, rec = open_game(browser)
    assert "Maut ka Kuan" in page.evaluate("__pbTest.rides()")
    assert page.evaluate("(()=>{const R=__pbTest.ride('maut');return LAYOUT.zoneAt(R.x,R.z)==='jhoola'&&LAYOUT.walkable(R.x,R.z)&&!LAYOUT.blocked(R.x,R.z);})()")
    assert rec.errors == [], rec.errors


def test_watch_from_the_rim_and_get_off(browser):
    page, rec = open_game(browser)
    to_the_stairs(page)
    page.wait_for_function("!document.querySelector('#prompt').hidden&&document.querySelector('#promptName').textContent==='Maut ka Kuan'", timeout=15000)
    assert page.locator("#promptVerb").inner_text() == "Watch"
    page.locator("#prompt").click()
    page.wait_for_function("__pbTest.riding()&&__pbTest.riding().eyeY>6.5", timeout=15000)
    assert page.evaluate("__pbTest.riding().name") == "Maut ka Kuan"
    page.get_by_role("button", name="Get off").click()
    assert page.evaluate("__pbTest.riding()") is None
    r = page.evaluate("__pbTest.ride('maut')")
    x, z = page.evaluate("__pbTest.player()")
    assert abs(x - r["x"]) < 0.01 and abs(z - r["z"]) < 0.01, (x, z, r)
    assert page.evaluate("__pbTest.walk(0,-95,60)")["arrived"]
    assert rec.errors == [], rec.errors


def test_bikes_and_the_car_ride_the_wall(browser):
    page, rec = open_game(browser)
    m = page.evaluate("LAYOUT.MAUT")
    a = page.evaluate("__pbTest.maut()")
    assert len(a) == 3, a
    for p in a:
        r = ((p["x"] - m["x"]) ** 2 + (p["z"] - m["z"]) ** 2) ** 0.5
        assert m["well"] - 1.6 < r < m["well"], (r, p)
        assert 0.8 < p["y"] < 5, p
    page.wait_for_timeout(1000)
    b = page.evaluate("__pbTest.maut()")
    assert all(abs(p["x"] - q["x"]) + abs(p["z"] - q["z"]) > 0.5 for p, q in zip(a, b)), (a, b)
    assert rec.errors == [], rec.errors


def test_help_panel_mentions_maut_ka_kuan(browser):
    page, rec = open_game(browser, enter=False)
    assert "Maut ka Kuan" in page.evaluate("document.querySelector('dl.keys').textContent")
