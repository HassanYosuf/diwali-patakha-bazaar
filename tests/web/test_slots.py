from run import fixture, leave, open_game

A1 = "00000000-0000-0000-0000-0000000000a1"
B1 = "00000000-0000-0000-0000-0000000000b1"


def slots(page):
    return page.evaluate("__pbTest.slots()")


def without_stall_brand():
    ads = fixture("ads.json")
    ads["campaigns"] = [c for c in ads["campaigns"] if c["id"] != B1]
    return ads


def test_live_campaigns_fill_the_brand_spots(browser):
    page, rec = open_game(browser)
    page.wait_for_function("__pbTest.slots()['hoarding-entry-b']&&__pbTest.slots()['hoarding-entry-b'].art.wide==='brand'", timeout=15000)
    s = slots(page)
    assert set(s) == {"hoarding-entry-b", "stall-ring-b"}, s
    assert s["hoarding-entry-b"]["campaignId"] == A1
    assert s["stall-ring-b"]["campaignId"] == B1
    assert rec.errors == [], rec.errors


def test_an_empty_brand_spot_shows_diwali_art_and_cannot_be_tapped(browser):
    page, rec = open_game(browser, ads=without_stall_brand())
    page.wait_for_function("__pbTest.slots()['stall-ring-b']", timeout=10000)
    assert slots(page)["stall-ring-b"] == {"campaignId": None, "groups": 1, "art": {"wide": "festive", "tall": "festive"}}
    page.evaluate("__pbTest.tap('stall-ring-b')")
    assert page.locator("#dialog").is_hidden()


def test_kollabkit_keeps_its_stall_and_billboards(browser):
    page, rec = open_game(browser)
    assert page.evaluate("__pbTest.kollabkit()") == {"stand": True, "boards": ["jhoola", "stand"]}
    for where in ["stand", "jhoola"]:
        page.evaluate(f"__pbTest.tapKK('{where}')")
        assert page.locator("#dlgTitle").inner_text() == "KollabKit"
        assert page.locator("#dlgChoices button", has_text="Claim Creator Pro · free for 2 weeks ↗").count() == 1
        assert "Sponsored by KollabKit" in page.locator("#dlgFoot").inner_text()
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
    assert [u for u in rec.requests if "/ads/kollabkit-" in u], "KollabKit art is loaded"


def test_unreachable_supabase_leaves_kollabkit_and_no_brand_spots(browser):
    page, rec = open_game(browser, rpc=False)
    page.wait_for_timeout(5000)
    assert slots(page) == {}
    assert page.evaluate("__pbTest.kollabkit()") == {"stand": True, "boards": ["jhoola", "stand"]}
    assert rec.errors == [], rec.errors


def test_tapping_a_live_hoarding_offers_a_visit(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.tap('hoarding-entry-b')")
    assert page.locator("#dialog").is_visible()
    assert page.locator("#dlgTitle").inner_text() == "Acme Tea"
    assert page.locator("#dlgChoices button", has_text="Visit Acme Tea ↗").count() == 1
    assert "Sponsored by Acme Tea" in page.locator("#dlgFoot").inner_text()


def test_premium_stall_shopkeeper_answers_from_the_campaign(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.tap('stall-ring-b')")
    assert page.locator("#dlgTitle").inner_text() == "Bolt Sweets"
    assert "Bolt ki mithai" in page.locator("#dlgQuote").inner_text()
    page.locator("#dlgChoices button", has_text="Do you deliver?").click()
    assert "Across Delhi NCR, same day." in page.locator("#dlgQuote").inner_text()
    assert "पूरे दिल्ली एनसीआर में" in page.locator("#dlgQuote").inner_text()


def test_artwork_that_fails_to_load_leaves_diwali_art(browser):
    ads = fixture("ads.json")
    ads["campaigns"][0]["art"]["wide"] = "https://cdn.test.invalid/missing.jpg"
    page, rec = open_game(browser, ads=ads)
    page.wait_for_timeout(2500)
    s = slots(page)
    assert s["hoarding-entry-b"]["campaignId"] == A1
    assert s["hoarding-entry-b"]["art"] == {"wide": "festive"}
    assert rec.errors == [], rec.errors


def test_fresh_data_replaces_the_cached_campaign_in_place(browser):
    old = fixture("ads.json")
    old["campaigns"][0] = {**old["campaigns"][0], "id": "00000000-0000-0000-0000-0000000000f0", "brand": "Old Brand"}
    page, rec = open_game(browser, storage={"pb_ads": __import__("json").dumps(old)})
    page.wait_for_function(f"__pbTest.slots()['hoarding-entry-b'].campaignId==='{A1}'", timeout=10000)
    assert all(v["groups"] == 1 for v in slots(page).values()), slots(page)


def test_a_view_counts_after_one_second_on_screen(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.goto('hoarding-entry-b')")
    page.wait_for_timeout(2500)  # headless frames are 0.3-0.7 s apart; only whole in-view intervals count
    page.evaluate("__pbTest.goto('away')")
    leave(page)
    assert {"c": A1, "t": "v"} in rec.events(), rec.beacons


def test_half_a_second_on_screen_is_not_a_view(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.goto('hoarding-entry-b')")
    page.wait_for_timeout(500)
    page.evaluate("__pbTest.goto('away')")
    leave(page)
    assert {"c": A1, "t": "v"} not in rec.events(), rec.beacons


def test_visit_records_a_click(browser):
    page, rec = open_game(browser)
    page.evaluate("__pbTest.tap('hoarding-entry-b')")
    with page.context.expect_page() as popup:
        page.locator("#dlgChoices button", has_text="Visit Acme Tea ↗").click()
    popup.value.wait_for_url("https://acme.example/**", timeout=10000)
    leave(page)
    assert {"c": A1, "t": "c"} in rec.events(), rec.beacons


def test_longest_hindi_lines_fit_a_phone_screen(browser):
    ads = fixture("ads.json")
    lines = ads["campaigns"][1]["lines"]
    lines["greet"] = [["G" * 120, "दीवाली की शुभकामनाएँ " * 6]]
    lines["qa"][0] = {"q": ["Q" * 120, "प्रश्न " * 20], "a": ["A" * 280, "उत्तर देने वाली लंबी पंक्ति " * 10]}
    page, rec = open_game(browser, ads=ads, viewport=(360, 740))
    page.evaluate("__pbTest.tap('stall-ring-b')")
    page.locator("#dlgChoices button").filter(has_text="Q" * 20).click()
    over = page.evaluate("[...document.querySelectorAll('#dialog, #dialog *')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.className)")
    assert over == [], over
    assert page.evaluate("document.documentElement.scrollWidth") <= 360


def test_admin_preview_shows_a_strip_and_counts_nothing(browser):
    ads = without_stall_brand()
    ads["slots"] = [s for s in ads["slots"] if s["id"] != "hoarding-entry-b"]  # the spot is switched off
    ads["campaigns"] = []
    pv = {"id": "00000000-0000-0000-0000-0000000000c9", "brand": "Coming Soon", "slot_id": "hoarding-entry-b",
          "link": "https://soon.example/", "art": {"wide": "https://cdn.test.invalid/art-wide.jpg"}, "lines": None, "share": 1,
          "slots": {"kind": "hoarding"}}
    page, rec = open_game(browser, ads=ads, query="?test=1&preview=" + pv["id"], preview=pv,
                          storage={"sb-sb-auth-token": '{"access_token":"admin-token"}'})
    page.wait_for_function("__pbTest.slots()['hoarding-entry-b']", timeout=10000)
    assert slots(page)["hoarding-entry-b"]["campaignId"] == pv["id"]
    assert page.get_by_text("Preview: not counted").is_visible()
    page.evaluate("__pbTest.goto('hoarding-entry-b')")
    page.wait_for_timeout(1500)
    leave(page)
    assert rec.beacons == [], rec.beacons
