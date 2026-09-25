#!/usr/bin/env python3
"""Production-page checks in isolated Chromium contexts, including real audio."""
import argparse
import json
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:4173/music/bass-patterns/")
parser.add_argument("--chromium")
args = parser.parse_args()
out = Path(tempfile.mkdtemp(prefix="bass-patterns-"))
checks = 0
key = "bayan.bass-patterns.v1"


def check(condition, message):
    global checks
    assert condition, message
    checks += 1
    print("PASS", message)


def stored(page):
    return page.evaluate("(key) => JSON.parse(localStorage.getItem(key))", key)


audio_probe = """(() => {
  const Native = window.AudioContext;
  window.__audio = {notes: [], contexts: 0, rms: () => 0};
  window.AudioContext = class extends Native {
    constructor(...args) {
      super(...args); window.__audio.contexts++;
      const analyser = this.createAnalyser(); analyser.fftSize = 2048; analyser.connect(this.destination);
      window.__audio.rms = () => {
        const data = new Float32Array(2048); analyser.getFloatTimeDomainData(data);
        return Math.sqrt(data.reduce((sum, x) => sum + x*x, 0) / data.length);
      };
      const gainFactory = this.createGain.bind(this), oscillatorFactory = this.createOscillator.bind(this);
      this.createGain = () => {
        const gain = gainFactory(), connect = gain.connect.bind(gain);
        gain.connect = (target, ...rest) => connect(target === this.destination ? analyser : target, ...rest);
        return gain;
      };
      this.createOscillator = () => {
        const oscillator = oscillatorFactory(), start = oscillator.start.bind(oscillator);
        oscillator.start = (time) => {
          window.__audio.notes.push({time, frequency: oscillator.frequency.value});
          return start(time);
        };
        return oscillator;
      };
    }
  };
})();"""

with sync_playwright() as p:
    options = {"args": ["--no-sandbox"]}
    if args.chromium:
        options["executable_path"] = args.chromium
    browser = p.chromium.launch(**options)
    errors = []
    existing_theme_errors = []
    try:
        for width in (320, 390, 768, 1440):
            context = browser.new_context(viewport={"width": width, "height": 950}, permissions=["clipboard-read", "clipboard-write"])
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("dialog", lambda dialog: dialog.accept())
            page.goto(args.url)
            check(page.locator(".bp-card").count() == 4, f"Imported bassline and three examples at {width}px")
            check(page.locator(".bp-card svg").count() == 4, "Each bassline has its own staff")
            check(page.locator(".bp-card").first.get_by_role("button", name="Play", exact=True).is_visible(), "Every staff has a Play control")
            check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Collection does not overflow the viewport")
            page.screenshot(path=str(out / f"collection-{width}.png"), full_page=True)
            page.locator('[data-pattern-id="example:0"]').get_by_role("button", name="Edit", exact=True).click()
            check(page.locator("#bp-workspace").get_attribute("open") is not None, "Edit opens the step editor")
            check(page.locator("#bp-score svg").count() == 1, "Editor renders bass staff")
            page.get_by_text("Button assignments and step order", exact=True).click()
            page.locator("#bp-step-2").click()
            page.locator("#bp-finger-0").select_option("4")
            page.locator("#bp-duration").select_option("6")
            page.locator("#bp-root-0").select_option("4")
            page.locator("#bp-kind-0").select_option("counter")
            page.locator("#bp-add-button").click()
            page.locator("#bp-finger-1").select_option("3")
            draft = stored(page)["draft"]
            check(draft["steps"][2]["ticks"] == 6, "Duration edits persist")
            check(draft["steps"][2]["presses"][0] == {"root": 4, "kind": "counter", "finger": 4}, "Physical button and finger are preserved")
            check(len(draft["steps"][2]["presses"]) == 2, "Simultaneous button presses are supported")
            page.locator("#bp-duplicate").click()
            page.locator("#bp-earlier").click()
            check(len(stored(page)["draft"]["steps"]) == 5, "Duplicate and reorder retain all steps")
            page.locator("#bp-undo").click()
            page.locator("#bp-redo").click()
            page.locator("#bp-title").fill("My first bassline")
            page.locator("#bp-save").click()
            check(page.locator(".bp-card").count() == 5, "Save adds a separate bassline card")
            check(page.locator(".bp-card").first.locator("h2").inner_text() == "My first bassline", "Saved title appears in the collection")
            page.locator("#bp-copy").click()
            page.wait_for_function("document.getElementById('bp-status').textContent === 'Pattern code copied.'")
            code = page.evaluate("navigator.clipboard.readText()")
            check(code.startswith("BP1."), "Copy writes a portable pattern code")
            copied = page.evaluate("(code) => BassPatterns.decode(code)", code)
            check(copied == stored(page)["draft"], "Code preserves exact notes, rhythm, and fingers")
            page.locator("#bp-new").click()
            page.locator("#bp-title").fill("Second bassline")
            page.locator("#bp-add").click()
            page.locator("#bp-add-rest").click()
            check(stored(page)["draft"]["steps"][1]["presses"] == [], "New patterns can contain rests")
            page.locator("#bp-save").click()
            check(page.locator(".bp-card").count() == 6, "Multiple saved basslines coexist")
            page.locator("#bp-load").click()
            page.locator("#bp-code").fill(code)
            page.locator("#bp-code-form").get_by_role("button", name="Load code", exact=True).click()
            check(stored(page)["draft"] == copied, "Load restores the complete pattern")
            page.locator("#bp-undo").click()
            check(stored(page)["draft"]["title"] == "Second bassline", "A load is one undo step")
            page.locator("#bp-redo").click()
            page.locator("#bp-load").click()
            page.locator("#bp-code").fill("BP1.bad")
            page.locator("#bp-code-form").get_by_role("button", name="Load code", exact=True).click()
            check(page.locator("#bp-code-error").is_visible(), "Invalid code gives a visible error")
            check(stored(page)["draft"] == copied, "Invalid code does not change the pattern")
            page.locator("#bp-code-close").click()
            page.screenshot(path=str(out / f"editor-{width}.png"), full_page=True)
            check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Editor does not overflow the viewport")
            page.reload()
            check(page.locator(".bp-card").count() == 6, "Saved basslines survive reload")
            check(stored(page)["draft"] == copied, "Draft survives reload")
            # Staff note selection uses the same steps as the keyboard-accessible editor.
            page.locator(".bp-card").first.get_by_role("button", name="Edit", exact=True).click()
            page.locator("#bp-score [data-bp-slot='1']").first.click()
            check(page.locator("#bp-score .bp-active-note").first.get_attribute("data-bp-step") == "1", "Clicking staff notation selects that step")
            context.close()

        context = browser.new_context(viewport={"width": 1200, "height": 950})
        context.add_init_script(audio_probe)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(args.url)
        check(page.evaluate("__audio.contexts") == 0, "Audio context is not created on page load")
        page.locator("#bp-tempo").fill("120")
        page.locator("#bp-tempo").press("Tab")
        card = page.locator('[data-pattern-id="example:0"]')
        card.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("__audio.rms() > 0.00001")
        check(True, "Playback produces real nonzero audio samples")
        page.wait_for_function("__audio.notes.length >= 8")
        times = page.evaluate("[...new Set(__audio.notes.map(n => n.time))]")
        check(len(times) == 4 and all(abs((times[i+1] - times[i]) - 0.5) < 0.002 for i in range(3)), "Quarter-note timing follows 120 BPM")
        check(abs(page.evaluate("__audio.notes[0].frequency") - 65.406) < 0.01, "First bass pitch is C2")
        page.wait_for_function("document.querySelector('.bp-card button').textContent === 'Play'")
        page.wait_for_function("__audio.rms() < 0.000001")
        check(True, "Playback finishes and releases sound")
        card.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("__audio.rms() > 0.00001")
        card.get_by_role("button", name="Stop", exact=True).click()
        page.wait_for_function("__audio.rms() < 0.000001")
        check(card.get_by_role("button", name="Play", exact=True).is_visible(), "Stop immediately cancels playback")
        card.get_by_role("button", name="Play", exact=True).click()
        page.locator('[data-pattern-id="example:1"]').get_by_role("button", name="Play", exact=True).click()
        check(page.get_by_role("button", name="Stop", exact=True).count() == 1, "Only one bassline plays at a time")
        page.locator('[data-pattern-id="example:1"]').get_by_role("button", name="Stop", exact=True).click()
        # Slow context resume must not restart after Stop.
        page.evaluate("""() => {
          const native = AudioContext.prototype.resume;
          AudioContext.prototype.resume = function() { return new Promise(r => setTimeout(() => native.call(this).then(r), 150)); };
        }""")
        card.get_by_role("button", name="Play", exact=True).click()
        card.get_by_role("button", name="Stop", exact=True).click()
        page.wait_for_timeout(250)
        check(page.get_by_role("button", name="Stop", exact=True).count() == 0, "Delayed audio start cannot escape Stop")
        # The page and all of its first-party code must work after a real offline reload.
        page.wait_for_function("!!navigator.serviceWorker.controller")
        context.set_offline(True)
        page.reload()
        check(page.locator(".bp-card svg").count() == 4, "Collection works after offline reload")
        page.locator(".bp-card").first.get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("__audio.rms() > 0.00001")
        check(True, "Playback also works offline")
        context.close()

        for failure in ("corrupt", "denied", "quota"):
            context = browser.new_context()
            if failure == "corrupt":
                context.add_init_script(f"localStorage.setItem({json.dumps(key)}, 'broken')")
            elif failure == "denied":
                context.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } })")
            else:
                context.add_init_script("Storage.prototype.setItem = () => { throw new Error('quota'); }")
            context.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: undefined})")
            page = context.new_page()
            def storage_error(error):
                # Existing site theme/search initialization assumes storage works.
                if "assets/js/theme.js" in error.stack:
                    existing_theme_errors.append(str(error))
                else:
                    errors.append(str(error))
            page.on("pageerror", storage_error)
            page.goto(args.url)
            page.locator('[data-pattern-id="example:0"]').get_by_role("button", name="Edit", exact=True).click()
            page.locator("#bp-title").fill("Keep me")
            page.locator("#bp-copy").click()
            check(page.locator("#bp-code-form").is_visible(), f"Manual Copy fallback works with {failure} storage")
            check(page.locator("#bp-code").input_value().startswith("BP1."), "Fallback exposes a complete pattern code")
            check(page.locator("#bp-storage-error").is_visible(), "Storage failure is disclosed")
            if failure == "corrupt":
                check(page.evaluate("(key) => localStorage.getItem(key)", key) == "broken", "Unreadable browser save is not overwritten")
            context.close()
        check(not errors, f"No page errors: {errors}")
        if existing_theme_errors:
            print("Known existing theme errors during forced storage failure:", existing_theme_errors)
        print(f"{checks} browser checks passed. Evidence: {out}")
    finally:
        browser.close()
