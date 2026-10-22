from run import open_admin, reset_local, svc
from test_admin import campaign, ist_today

LOCAL_ONLY = True


def test_a_long_date_range_counts_every_day(browser):
    # Supabase hands back at most 1,000 rows per request; a long range must still add up
    reset_local()
    c = campaign("Year Long", "hoarding-entry-b", start=-1199, end=5)
    svc("POST", "/rest/v1/stats_daily", [{"campaign_id": c["id"], "day": ist_today(-d), "views": 1, "clicks": 0} for d in range(1100)])
    page, rec = open_admin(browser)
    page.get_by_role("tab", name="Stats").click()
    page.locator("#sFrom").fill(ist_today(-1099))
    page.locator("#sFrom").dispatch_event("change")
    page.wait_for_function(f"document.querySelector(\"[data-stat='{c['id']}']\")?.innerText.includes('1100 views')", timeout=15000)
    with page.expect_download() as dl:
        page.get_by_role("button", name="Download CSV").click()
    lines = open(dl.value.path(), encoding="utf-8").read().splitlines()
    assert len(lines) == 1 + 1100, len(lines)
