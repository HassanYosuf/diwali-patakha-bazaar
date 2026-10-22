from run import open_game


def open_form(page):
    page.locator("#helpBtn").click()
    page.get_by_role("button", name="Advertise with us").click()
    page.locator("#advName").wait_for(state="visible")


def fill(page, name="Asha"):
    page.locator("#advName").fill(name)
    page.locator("#advBrand").fill("Bolt Tea")
    page.locator("#advContact").fill("asha@bolt.example")
    page.locator("#advInterest").select_option("hoarding")
    page.locator("#advMsg").fill("Diwali week, entry lane")


def test_a_filled_form_sends_the_enquiry_and_thanks_the_sender(browser):
    page, rec = open_game(browser)
    open_form(page)
    fill(page)
    page.get_by_role("button", name="Send").click()
    page.get_by_text("Thanks! We'll get in touch soon.").wait_for(state="visible", timeout=5000)
    assert rec.enquiries == [{"name": "Asha", "brand": "Bolt Tea", "contact": "asha@bolt.example", "interest": "hoarding",
                              "message": "Diwali week, entry lane", "website": ""}], rec.enquiries
    assert page.locator("#advName").is_hidden()


def test_a_refused_send_keeps_the_text_and_asks_to_try_again(browser):
    for answer in [(429, {"ok": False, "error": "rate"}), "network"]:
        page, rec = open_game(browser, enquire=answer)
        open_form(page)
        fill(page)
        page.get_by_role("button", name="Send").click()
        page.get_by_text("Couldn't send. Try again in a minute.").wait_for(state="visible", timeout=5000)
        assert page.locator("#advName").input_value() == "Asha"
        assert page.locator("#advMsg").input_value() == "Diwali week, entry lane"
        assert page.get_by_role("button", name="Send").is_enabled()
        page.context.close()


def test_an_empty_name_is_not_sent(browser):
    page, rec = open_game(browser)
    open_form(page)
    fill(page, name="   ")
    page.get_by_role("button", name="Send").click()
    page.wait_for_timeout(500)
    assert rec.enquiries == []
    assert page.locator("#advName").is_visible()


def test_keys_pressed_in_the_form_do_not_walk_the_player(browser):
    page, rec = open_game(browser)
    open_form(page)
    before = page.evaluate("__pbTest.player()")
    page.locator("#advInterest").focus()
    for k in ["ArrowDown", "ArrowUp", "KeyW", "KeyS"]:
        page.keyboard.down(k); page.wait_for_timeout(400); page.keyboard.up(k)
    page.locator("#advName").type("wasd")
    assert page.evaluate("__pbTest.player()") == before
