"""Browser tests for Phatake Bazaar. Runs every test_* function in tests/web/test_*.py against a local copy of the site
in headless Chrome. Supabase is never contacted: the page gets a fake project URL whose requests are answered here.

    python3 tests/web/run.py            # all tests
    python3 tests/web/run.py slots      # only test files whose name contains "slots"
    python3 tests/web/run.py --local    # admin tests: talk to the local Supabase stack instead
"""
import functools, glob, http.server, importlib.util, json, os, re, sys, threading, traceback
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FIX = os.path.join(HERE, "fixtures")
PORT = 8765
SITE = f"http://localhost:{PORT}"
SB = "https://sb.test.invalid"
CDN = "https://cdn.test.invalid"
LOCAL = "--local" in sys.argv


def fixture(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        return json.load(f)


class Rec:
    """What a page did: page errors, requests, and the track beacons it sent."""
    def __init__(self):
        self.errors, self.requests, self.beacons, self.enquiries = [], [], [], []

    def events(self):
        return [e for b in self.beacons for e in b["events"]]


def open_game(browser, *, ads="ads.json", rpc=True, query="?test=1", viewport=(1280, 800), storage=None,
              enter=True, preview=None, enquire=None):
    """A game page wired to fakes. ads: fixture name or dict. rpc=False makes bazaar_ads unreachable.
    preview: campaign row (with slots.kind) answered for ?preview=. enquire: (status, body) for the enquire function."""
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
    rec = Rec()
    init = {"pb4_nick": "Test", "pb4_look": [0, 0, 0], "pb4_age": "teen", **(storage or {})}
    ctx.add_init_script("(()=>{const s=%s;for(const k in s)localStorage.setItem(k,typeof s[k]==='string'&&!k.startsWith('pb4_')?s[k]:JSON.stringify(s[k]));})()" % json.dumps(init))
    data = fixture(ads) if isinstance(ads, str) else ads

    def route(r):
        url, req = r.request.url, r.request
        rec.requests.append(url)
        if url.endswith("/sb-config.js"):
            return r.fulfill(content_type="application/javascript", body=f"window.SB={{url:'{SB}',key:'test-key'}};")
        if url.startswith(SB + "/rest/v1/rpc/bazaar_ads"):
            return r.fulfill(json=data) if rpc else r.abort()
        if url.startswith(SB + "/functions/v1/track"):
            try: rec.beacons.append(json.loads(req.post_data or "{}"))
            except ValueError: rec.beacons.append({"bad": req.post_data, "events": []})
            return r.fulfill(status=204)
        if url.startswith(SB + "/functions/v1/enquire"):
            if req.method == "OPTIONS":
                return r.fulfill(status=204, headers={"access-control-allow-origin": SITE, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS"})
            rec.enquiries.append(json.loads(req.post_data or "{}"))
            if enquire == "network": return r.abort()
            status, body = enquire or (200, {"ok": True})
            return r.fulfill(status=status, json=body, headers={"access-control-allow-origin": SITE})
        if url.startswith(SB + "/rest/v1/campaigns"):
            return r.fulfill(json=[preview] if preview else [])
        if url.startswith(CDN + "/"):
            path = os.path.join(FIX, url[len(CDN) + 1:].split("?")[0])
            if not os.path.isfile(path): return r.fulfill(status=404, body="")
            with open(path, "rb") as f:
                return r.fulfill(body=f.read(), content_type="image/jpeg", headers={"access-control-allow-origin": "*"})
        if re.match(r"https://[^/]+\.example/", url):
            return r.fulfill(content_type="text/html", body="<p>brand site</p>")
        if url.startswith(SB) or ".supabase.co" in url or "/npm/@supabase/" in url:
            return r.abort()
        if "/_vercel/insights/" in url:
            return r.fulfill(status=200, content_type="application/javascript", body="")
        return r.continue_()

    ctx.route("**/*", route)
    page = ctx.new_page()
    page.on("pageerror", lambda e: rec.errors.append(str(e)))
    page.goto(SITE + "/" + query, wait_until="load")
    page.wait_for_function("window.__pbTest&&window.__pbTest.ready()", timeout=30000)
    if enter:
        page.get_by_text("Enter quietly").click()
        page.wait_for_function("window.__pbTest.started()", timeout=15000)
        page.evaluate("__pbTest.goto('away')")
        page.wait_for_function("__pbTest.settled()", timeout=60000)  # the intro fly-in; views don't count during it
        page.evaluate("__pbTest.goto('away')")
    return page, rec


_status = None
def local():
    """URLs and keys of the local Supabase stack (npm --prefix tests run db:start)."""
    global _status
    if _status is None:
        import subprocess
        out = subprocess.run(["npx", "--prefix", os.path.join(ROOT, "tests"), "supabase", "status", "--workdir", ROOT, "-o", "json"],
                             capture_output=True, text=True, check=True).stdout
        _status = json.loads(out[out.index("{"):out.rindex("}") + 1])
    return _status


def svc(method, path, body=None):
    """Call the local stack's REST API as the service role (test setup only)."""
    import urllib.request
    st = local()
    req = urllib.request.Request(st["API_URL"] + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"apikey": st["SERVICE_ROLE_KEY"], "Authorization": "Bearer " + st["SERVICE_ROLE_KEY"],
                                          "Content-Type": "application/json", "Prefer": "return=representation"})
    with urllib.request.urlopen(req) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else None


def reset_local():
    """Back to the migration's slot defaults with no campaigns, stats, enquiries or mail."""
    import urllib.request
    svc("DELETE", "/rest/v1/stats_daily?day=not.is.null")
    svc("DELETE", "/rest/v1/campaigns?id=not.is.null")
    svc("DELETE", "/rest/v1/enquiries?id=not.is.null")
    svc("PATCH", "/rest/v1/slots?id=in.(stall-ring,hoarding-entry,hoarding-jhoola)", {"enabled": True})
    svc("PATCH", "/rest/v1/slots?id=in.(stall-ring-b,hoarding-entry-b)", {"enabled": False})
    urllib.request.urlopen(urllib.request.Request(local()["MAILPIT_URL"] + "/api/v1/messages", method="DELETE"))


def login_link(email, timeout=20):
    import time, urllib.request
    end = time.time() + timeout
    while time.time() < end:
        msgs = json.loads(urllib.request.urlopen(local()["MAILPIT_URL"] + "/api/v1/messages").read())["messages"]
        for m in msgs:
            if any(t["Address"] == email for t in m["To"]):
                body = json.loads(urllib.request.urlopen(f"{local()['MAILPIT_URL']}/api/v1/message/{m['ID']}").read())
                link = re.search(r"(http://127\.0\.0\.1:54321/auth/v1/verify\?[^\s\)\"<>]+)", body["Text"] or body["HTML"]).group(1)
                return link.replace("&amp;", "&")
        time.sleep(0.5)
    raise AssertionError("no login email for " + email)


def open_admin(browser, email="admin@test.local", viewport=(1280, 800), path="/admin.html"):
    """Sign in to the admin page with an emailed link from the local stack."""
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
    rec = Rec()
    st = local()
    def route(r):
        url = r.request.url
        rec.requests.append(url)
        if url.endswith("/sb-config.js"):
            return r.fulfill(content_type="application/javascript", body=f"window.SB={{url:'{st['API_URL']}',key:'{st['ANON_KEY']}'}};")
        if "/_vercel/insights/" in url:
            return r.fulfill(status=200, content_type="application/javascript", body="")
        return r.continue_()
    ctx.route("**/*", route)
    page = ctx.new_page()
    page.on("pageerror", lambda e: rec.errors.append(str(e)))
    page.goto(SITE + path, wait_until="load")
    page.locator("#email").fill(email)
    for attempt in range(4):  # GoTrue allows one login email per user per second; tests sign in back to back
        page.get_by_role("button", name="Send login link").click()
        try:
            page.get_by_text("Check your email").wait_for(state="visible", timeout=10000)
            break
        except Exception:
            note = page.locator("#signinNote").inner_text()
            if "only request this after" not in note or attempt == 3:
                raise AssertionError("sign-in said: " + note)
            page.wait_for_timeout(1500)
    page.goto(login_link(email))
    page.wait_for_function("document.querySelector('#app:not([hidden]), #denied:not([hidden])')", timeout=15000)
    return page, rec


def leave(page):
    """Fire pagehide the way leaving the page does, so brands.js sends what it has."""
    page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide'))")
    page.wait_for_timeout(600)


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    files = sorted(f for f in glob.glob(os.path.join(HERE, "test_*.py")) if not only or any(o in os.path.basename(f) for o in only))
    srv = serve()
    passed, failed = 0, []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for f in files:
            spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            if getattr(mod, "LOCAL_ONLY", False) != LOCAL:
                continue
            for name in [n for n in dir(mod) if n.startswith("test_")]:
                label = f"{os.path.basename(f)}::{name}"
                try:
                    getattr(mod, name)(browser)
                    passed += 1
                    print("ok  ", label, flush=True)
                except Exception:
                    failed.append(label)
                    print("FAIL", label, flush=True)
                    traceback.print_exc(limit=3)
                finally:
                    for c in browser.contexts: c.close()
        browser.close()
    srv.shutdown()
    print(f"\n{passed} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    main()
