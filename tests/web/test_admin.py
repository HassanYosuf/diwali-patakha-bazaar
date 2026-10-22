import datetime, json, os, re
from run import ROOT, open_admin, reset_local, svc

LOCAL_ONLY = True
SLOT_IDS = {"stall-ring", "stall-ring-b", "hoarding-entry", "hoarding-entry-b", "hoarding-jhoola"}


def ist_today(offset=0):
    return (datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).date() + datetime.timedelta(days=offset)).isoformat()


def campaign(brand, slot, share=1, start=0, end=7, **kw):
    row = {"brand": brand, "slot_id": slot, "link": f"https://{brand.lower().replace(' ', '')}.example/", "art": {}, "share": share,
           "starts_on": ist_today(start), "ends_on": ist_today(end)}
    row.update(kw)
    return svc("POST", "/rest/v1/campaigns", row)[0]


def card(page, slot):
    return page.locator(f".slot-card[data-slot='{slot}']")


def test_an_admin_signs_in_with_an_emailed_link_and_sees_every_slot(browser):
    reset_local()
    page, rec = open_admin(browser)
    assert page.locator("#app").is_visible()
    ids = set(page.eval_on_selector_all(".slot-card", "els=>els.map(e=>e.dataset.slot)"))
    assert ids == SLOT_IDS, ids
    assert rec.errors == [], rec.errors


def test_slot_cards_show_rotation_shares_empty_and_off_states(browser):
    reset_local()
    campaign("Acme", "hoarding-entry", share=1)
    campaign("Bolt", "hoarding-entry", share=3)
    campaign("Later", "hoarding-entry", start=2, end=9)
    page, rec = open_admin(browser)
    entry = card(page, "hoarding-entry").inner_text()
    assert "Acme" in entry and "25%" in entry, entry
    assert "Bolt" in entry and "75%" in entry, entry
    assert "Next: Later" in entry, entry
    assert "Showing Diwali art" in card(page, "hoarding-jhoola").inner_text()
    assert "Off" in card(page, "stall-ring-b").inner_text()


def test_switching_a_slot_on_survives_a_reload(browser):
    reset_local()
    page, rec = open_admin(browser)
    sw = card(page, "stall-ring-b").locator("input[type=checkbox]")
    assert not sw.is_checked()
    sw.check()
    page.wait_for_function("!document.querySelector(\".slot-card[data-slot='stall-ring-b'] input\").disabled")
    assert svc("GET", "/rest/v1/slots?id=eq.stall-ring-b&select=enabled") == [{"enabled": True}]
    page.reload()
    page.locator(".slot-card").first.wait_for()
    assert card(page, "stall-ring-b").locator("input[type=checkbox]").is_checked()
    reset_local()


def test_a_signed_in_non_admin_is_turned_away(browser):
    reset_local()
    page, rec = open_admin(browser, email="user@test.local")
    assert page.get_by_text("Not authorised").is_visible()
    assert page.locator("#app").is_hidden()


def test_every_tab_fits_a_phone(browser):
    reset_local()
    page, rec = open_admin(browser, viewport=(390, 844))
    for tab in ["Slots", "Campaigns", "Stats", "Enquiries"]:
        page.get_by_role("tab", name=tab).click()
        page.wait_for_timeout(300)
        assert page.evaluate("document.documentElement.scrollWidth") <= 390, tab


def test_the_admin_page_is_hidden_from_search(browser):
    with open(os.path.join(ROOT, "vercel.json")) as f:
        rules = json.load(f)["headers"]
    def headers_for(path):
        out = {}
        for r in rules:
            # vercel sources are path-to-regexp; the ones used here are plain regex-compatible
            if re.fullmatch(r["source"].replace("(.*)", ".*"), path):
                out.update({h["key"].lower(): h["value"] for h in r["headers"]})
        return out
    for p in ["/admin", "/admin.html"]:
        assert headers_for(p).get("x-robots-tag") == "noindex, nofollow", p
    assert "x-robots-tag" not in headers_for("/")


def test_an_unknown_email_gets_no_login_link(browser):
    import json, urllib.request
    from run import SITE, local
    reset_local()
    st = local()
    page = browser.new_page()
    page.route("**/sb-config.js", lambda r: r.fulfill(content_type="application/javascript", body=f"window.SB={{url:'{st['API_URL']}',key:'{st['ANON_KEY']}'}};"))
    page.goto(SITE + "/admin.html")
    page.locator("#email").fill("stranger@test.local")
    page.get_by_role("button", name="Send login link").click()
    page.get_by_text("That email isn't set up for the admin page.").wait_for(state="visible", timeout=10000)
    msgs = json.loads(urllib.request.urlopen(st["MAILPIT_URL"] + "/api/v1/messages").read())["messages"]
    assert msgs == [], msgs
    assert svc("GET", "/rest/v1/admins?select=email") == [{"email": "admin@test.local"}]
