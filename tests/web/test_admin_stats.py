import csv, io
from run import open_admin, reset_local, svc
from test_admin import campaign, ist_today
from test_admin_campaigns import img

LOCAL_ONLY = True


def seed_stats():
    a = campaign("Acme, Tea", "hoarding-entry-b", start=-12, end=5)
    b = campaign("Bolt", "stall-ring-b", start=-12, end=5)
    svc("POST", "/rest/v1/stats_daily", [
        {"campaign_id": a["id"], "day": ist_today(-1), "views": 10, "clicks": 2},
        {"campaign_id": a["id"], "day": ist_today(-2), "views": 5, "clicks": 0},
        {"campaign_id": a["id"], "day": ist_today(-10), "views": 100, "clicks": 50},  # outside the default 7 days
        {"campaign_id": b["id"], "day": ist_today(-1), "views": 0, "clicks": 0},
    ])
    return a, b


def stat_row(page, cid):
    return page.locator(f"[data-stat='{cid}']").inner_text()


def test_stats_total_the_last_seven_days_per_campaign(browser):
    reset_local()
    a, b = seed_stats()
    page, rec = open_admin(browser)
    page.get_by_role("tab", name="Stats").click()
    page.locator(f"[data-stat='{a['id']}']").wait_for()
    ra = stat_row(page, a["id"])
    assert "15" in ra and "13.3%" in ra and "100" not in ra, ra
    assert "—" in stat_row(page, b["id"])
    page.locator("#sFrom").fill(ist_today(-10))
    page.locator("#sFrom").dispatch_event("change")
    page.wait_for_function(f"document.querySelector(\"[data-stat='{a['id']}']\").innerText.includes('115')")


def test_the_csv_has_one_row_per_campaign_day(browser):
    reset_local()
    a, b = seed_stats()
    page, rec = open_admin(browser)
    page.get_by_role("tab", name="Stats").click()
    page.locator(f"[data-stat='{a['id']}']").wait_for()
    with page.expect_download() as dl:
        page.get_by_role("button", name="Download CSV").click()
    text = open(dl.value.path(), encoding="utf-8").read()
    assert text.splitlines()[0] == "date,brand,slot,views,clicks,click_rate"
    got = list(csv.reader(io.StringIO(text)))[1:]
    assert got == [
        [ist_today(-2), "Acme, Tea", "hoarding-entry-b", "5", "0", "0.0%"],
        [ist_today(-1), "Acme, Tea", "hoarding-entry-b", "10", "2", "20.0%"],
        [ist_today(-1), "Bolt", "stall-ring-b", "0", "0", ""],
    ], got


def seed_enquiry():
    return svc("POST", "/rest/v1/enquiries", {"brand": "Chai Point", "name": "Ravi", "contact": "ravi@chai.example",
                                              "interest": "premium_stall", "message": "Two weeks before Diwali"})[0]


def test_new_enquiries_show_a_badge_until_handled(browser):
    reset_local()
    e = seed_enquiry()
    page, rec = open_admin(browser)
    assert page.locator("#newCount").inner_text() == "1"
    page.get_by_role("tab", name="Enquiries").click()
    item = page.locator(f"[data-enquiry='{e['id']}']")
    assert "Ravi" in item.inner_text() and "ravi@chai.example" in item.inner_text() and "Two weeks before Diwali" in item.inner_text()
    item.locator("select").select_option("contacted")
    page.wait_for_function("document.querySelector('#newCount').hidden")
    assert svc("GET", f"/rest/v1/enquiries?id=eq.{e['id']}&select=status") == [{"status": "contacted"}]


def test_a_private_note_is_saved_when_you_leave_the_box(browser):
    reset_local()
    e = seed_enquiry()
    page, rec = open_admin(browser)
    page.get_by_role("tab", name="Enquiries").click()
    note = page.locator(f"[data-enquiry='{e['id']}'] textarea")
    note.fill("Called, wants the stall near the gate")
    note.blur()
    page.wait_for_timeout(800)
    assert svc("GET", f"/rest/v1/enquiries?id=eq.{e['id']}&select=note") == [{"note": "Called, wants the stall near the gate"}]


def test_an_enquiry_becomes_a_campaign(browser):
    reset_local()
    e = seed_enquiry()
    page, rec = open_admin(browser)
    page.get_by_role("tab", name="Enquiries").click()
    page.locator(f"[data-enquiry='{e['id']}']").get_by_role("button", name="Create campaign").click()
    assert page.locator("#cBrand").input_value() == "Chai Point"
    page.locator("#cSlot").select_option("hoarding-entry-b")
    page.locator("#cLink").fill("https://chai.example/")
    page.locator("#cWide").set_input_files(img("w-1920x1080.jpg", 1920, 1080))
    page.get_by_role("button", name="Save campaign").click()
    page.get_by_text("Saved.").wait_for(state="visible", timeout=10000)
    [row] = svc("GET", "/rest/v1/campaigns?brand=eq.Chai%20Point&select=enquiry_id")
    assert row["enquiry_id"] == e["id"]
