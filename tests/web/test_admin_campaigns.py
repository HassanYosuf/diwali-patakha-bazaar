import json, os, tempfile, urllib.request
from PIL import Image
from run import local, open_admin, reset_local, svc
from test_admin import ist_today, slot_on

LOCAL_ONLY = True
TMP = tempfile.mkdtemp(prefix="pb-art-")


def img(name, w, h, fmt="JPEG", noise=False):
    path = os.path.join(TMP, name)
    if not os.path.exists(path):
        im = Image.effect_noise((w, h), 120).convert("RGB") if noise else Image.new("RGB", (w, h), (40, 120, 200))
        im.save(path, fmt, **({"quality": 85} if fmt == "JPEG" else {}))
    return path


def open_editor(page):
    page.get_by_role("tab", name="Campaigns").click()
    page.get_by_role("button", name="New campaign").click()
    page.locator("#cBrand").wait_for(state="visible")


def fill_basics(page, brand="Acme Tea", slot="hoarding-entry-b", link="https://acme.example/?a=1"):
    page.locator("#cBrand").fill(brand)
    page.locator("#cSlot").select_option(slot)
    page.locator("#cLink").fill(link)
    page.locator("#cStart").fill(ist_today(0))
    page.locator("#cEnd").fill(ist_today(6))
    page.locator("#cShare").fill("2")


def rows(brand):
    return svc("GET", f"/rest/v1/campaigns?brand=eq.{urllib.request.quote(brand)}&select=*")


def bazaar_ads():
    st = local()
    req = urllib.request.Request(st["API_URL"] + "/rest/v1/rpc/bazaar_ads", data=b"{}", method="POST",
                                 headers={"apikey": st["ANON_KEY"], "Authorization": "Bearer " + st["ANON_KEY"], "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())


def test_artwork_is_checked_for_type_size_and_shape(browser):
    reset_local()
    page, rec = open_admin(browser)
    open_editor(page)
    err = page.locator("#cWideErr")
    cases = [
        (img("w-1920x1200.jpg", 1920, 1200), "should be 16:9"),
        (img("w-noise.png", 1920, 1080, "PNG", noise=True), "the limit is 1 MB"),
        (img("w.gif", 1920, 1080, "GIF"), "Use a JPG, PNG or WebP image."),
        (img("w-1920x1080.jpg", 1920, 1080), ""),
        (img("w-1900x1070.jpg", 1900, 1070), ""),  # 0.1% off 16:9, within the 2% allowance
    ]
    for path, want in cases:
        page.locator("#cWide").set_input_files(path)
        page.wait_for_timeout(400)
        got = err.inner_text()
        assert (want in got) if want else got == "", (os.path.basename(path), got)


def test_a_hoarding_campaign_saves_with_tracking_tags_and_goes_live(browser):
    reset_local()
    slot_on("hoarding-entry-b")
    page, rec = open_admin(browser)
    open_editor(page)
    fill_basics(page)
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    page.get_by_text("Saved.").wait_for(state="visible", timeout=10000)
    [row] = rows("Acme Tea")
    assert row["link"] == "https://acme.example/?a=1&utm_source=phatake-bazaar&utm_medium=game&utm_campaign=hoarding-entry-b"
    assert row["share"] == 2 and row["starts_on"] == ist_today(0) and row["ends_on"] == ist_today(6)
    assert row["art"]["wide"].startswith(local()["API_URL"] + "/storage/v1/object/public/brand-art/campaigns/" + row["id"] + "/wide.jpg")
    assert urllib.request.urlopen(row["art"]["wide"]).status == 200
    live = [c for c in bazaar_ads()["campaigns"] if c["id"] == row["id"]]
    assert len(live) == 1


def test_a_link_with_its_own_tracking_tags_is_left_alone(browser):
    reset_local()
    page, rec = open_admin(browser)
    open_editor(page)
    fill_basics(page, link="https://acme.example/?utm_source=newsletter")
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    page.get_by_text("Saved.").wait_for(state="visible", timeout=10000)
    assert rows("Acme Tea")[0]["link"] == "https://acme.example/?utm_source=newsletter"


def test_a_premium_stall_needs_tall_art_and_lines_then_appears_with_them(browser):
    reset_local()
    slot_on("stall-ring-b")
    page, rec = open_admin(browser)
    open_editor(page)
    fill_basics(page, brand="Bolt Sweets", slot="stall-ring-b", link="https://bolt.example/")
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    assert "tall" in page.locator("#cErr").inner_text().lower()
    assert rows("Bolt Sweets") == []
    page.locator("#cTall").set_input_files(img("t-1080x1920.jpg", 1080, 1920))
    page.locator("[data-greet='0'] [data-lang='en']").fill("Bolt ki mithai!")
    page.locator("[data-greet='0'] [data-lang='hi']").fill("बोल्ट की मिठाई!")
    page.locator("[data-qa='0'] [data-part='q'][data-lang='en']").fill("What's fresh?")
    page.locator("[data-qa='0'] [data-part='q'][data-lang='hi']").fill("ताज़ा क्या है?")
    page.locator("[data-qa='0'] [data-part='a'][data-lang='en']").fill("Kaju katli.")
    page.locator("[data-qa='0'] [data-part='a'][data-lang='hi']").fill("काजू कतली।")
    page.get_by_role("button", name="Save campaign").click()
    assert "2" in page.locator("#cErr").inner_text(), page.locator("#cErr").inner_text()  # needs at least 2 questions
    page.locator("[data-qa='1'] [data-part='q'][data-lang='en']").fill("Delivery?")
    page.locator("[data-qa='1'] [data-part='q'][data-lang='hi']").fill("डिलीवरी?")
    page.locator("[data-qa='1'] [data-part='a'][data-lang='en']").fill("Across Delhi.")
    page.locator("[data-qa='1'] [data-part='a'][data-lang='hi']").fill("पूरी दिल्ली में।")
    page.get_by_role("button", name="Save campaign").click()
    page.get_by_text("Saved.").wait_for(state="visible", timeout=10000)
    [c] = [c for c in bazaar_ads()["campaigns"] if c["brand"] == "Bolt Sweets"]
    assert c["lines"] == {"greet": [["Bolt ki mithai!", "बोल्ट की मिठाई!"]],
                          "qa": [{"q": ["What's fresh?", "ताज़ा क्या है?"], "a": ["Kaju katli.", "काजू कतली।"]},
                                 {"q": ["Delivery?", "डिलीवरी?"], "a": ["Across Delhi.", "पूरी दिल्ली में।"]}]}
    assert set(c["art"]) == {"wide", "tall"}


def test_a_non_https_link_is_refused_before_saving(browser):
    reset_local()
    page, rec = open_admin(browser)
    open_editor(page)
    fill_basics(page, link="http://acme.example/")
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    assert "https://" in page.locator("#cErr").inner_text()
    assert rows("Acme Tea") == []


def test_a_failed_upload_saves_nothing(browser):
    reset_local()
    page, rec = open_admin(browser)
    page.route("**/storage/v1/object/**", lambda r: r.fulfill(status=500, json={"error": "boom", "message": "storage down"}))
    open_editor(page)
    fill_basics(page)
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    page.wait_for_function("document.querySelector('#cWideErr').textContent.length>0", timeout=10000)
    assert "upload" in page.locator("#cWideErr").inner_text().lower()
    assert rows("Acme Tea") == []


def test_preview_opens_the_game_on_that_campaign(browser):
    reset_local()
    page, rec = open_admin(browser)
    open_editor(page)
    fill_basics(page)
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    page.get_by_text("Saved.").wait_for(state="visible", timeout=10000)
    [row] = rows("Acme Tea")
    with page.context.expect_page() as pop:
        page.get_by_role("button", name="Preview in game").click()
    pop.value.wait_for_url("**/?preview=" + row["id"], timeout=10000)
    pop.value.close()


def test_the_full_editor_fits_a_phone(browser):
    reset_local()
    page, rec = open_admin(browser, viewport=(390, 844))
    open_editor(page)
    page.locator("#cSlot").select_option("stall-ring-b")
    page.wait_for_timeout(300)
    assert page.locator("#cLinesBox").is_visible()
    assert page.evaluate("document.documentElement.scrollWidth") <= 390
