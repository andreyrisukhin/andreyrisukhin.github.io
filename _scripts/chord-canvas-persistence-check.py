#!/usr/bin/env python3
"""Run against a source server. Requires Playwright and an installed Chromium."""
import argparse
import json
from pathlib import Path
import tempfile

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:5173/_prototypes/chord-canvas/?v=saving-2")
parser.add_argument("--chromium")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
output = Path(tempfile.mkdtemp(prefix="chord-saving-"))
key = "chord-canvas.autosave.v1"
checks = 0


def check(value, message):
    global checks
    assert value, message
    checks += 1
    print("PASS", message)


def stored(page):
    return page.evaluate("(key) => JSON.parse(localStorage.getItem(key))", key)


def wait_saved(page, expression):
    page.wait_for_function(
        "(key) => { const d = JSON.parse(localStorage.getItem(key)); return d && ("
        + expression + "); }", arg=key
    )
    return stored(page)


def files(page):
    if not page.locator("#files").is_visible():
        page.locator("#file-toggle").click()


def upload(page, value):
    files(page)
    content = value if isinstance(value, str) else json.dumps(value)
    page.locator("#load-file").set_input_files(
        {"name": "canvas.json", "mimeType": "application/json", "buffer": content.encode()}
    )


def enter(page, name):
    page.locator("#chord-input").fill(name)
    page.locator("#chord-input").press("Enter")


with sync_playwright() as p:
    options = {"args": ["--no-sandbox"]}
    if args.chromium:
        options["executable_path"] = args.chromium
    browser = p.chromium.launch(**options)
    errors = []
    try:
        for width in (320, 390, 768, 1440):
            context = browser.new_context(viewport={"width": width, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            accept = True
            dialogs = []

            def dialog_handler(dialog):
                dialogs.append(dialog.type)
                dialog.accept() if accept else dialog.dismiss()

            page.on("dialog", dialog_handler)
            page.goto(args.url)
            result = page.evaluate((root / "_scripts/chord-canvas-browser-check.js").read_text())
            check(result["checks"] == 29, f"Existing canvas controls pass at {width}px")
            original = wait_saved(page, "d.meter.numerator === 6 && d.cells.length === 4")
            page.reload()
            check(page.locator(".tile").count() == 4, f"Reload restores all spans at {width}px")
            check(stored(page) == original, "Reload preserves exact saved document")
            check(page.locator("#undo").is_disabled(), "Reload starts with fresh undo history")
            check(page.locator("#meter-bottom").input_value() == "8", "Reload restores meter")
            check(page.locator("#zoom-fit").inner_text() == f'{original["view"]["zoom"]}×', "Reload restores zoom")

            files(page)
            check(page.locator("#files").inner_text().split() == ["Save", "Load", "Copy"], "File panel has only three button titles")
            check(page.locator("#files").bounding_box()["height"] <= 64, "File panel is compact")
            page.get_by_role("button", name="Copy", exact=True).click()
            page.wait_for_function("document.getElementById('file-message').textContent === 'Copied.'")
            clipboard = json.loads(page.evaluate("navigator.clipboard.readText()"))
            check(clipboard == stored(page), "Copy writes the complete canvas JSON to the clipboard")
            # Clipboard data is also accepted by the normal file loader.
            upload(page, clipboard)
            page.wait_for_function("document.getElementById('files').hidden")
            files(page)
            check(page.locator("#file-message").inner_text() == "", "Reopening the panel clears old confirmations")
            with page.expect_download() as download:
                page.locator("#download").click()
            target = output / f"canvas-{width}.json"
            download.value.save_as(target)
            exported = json.loads(target.read_text())
            check(exported == stored(page), "Downloaded JSON matches browser save")
            check(exported["cells"] == original["cells"], "Download retains exact fractions and rests")
            page.screenshot(path=str(output / f"files-{width}.png"))
            check(page.evaluate("document.documentElement.scrollWidth === innerWidth"), "File controls do not overflow")

            # Native entry, then opening a downloaded file through the file chooser.
            page.keyboard.press("Escape")
            first = page.locator(".tile").first
            first.focus()
            first.press("Enter")
            enter(page, "G7")
            changed = wait_saved(page, "d.cells.some(c => c.name === 'G7')")
            accept = False
            upload(page, exported)
            page.wait_for_function("document.getElementById('file-message').textContent.includes('cancelled')")
            check(stored(page) == changed, "Cancelled import preserves current canvas and autosave")
            accept = True
            with page.expect_file_chooser() as chooser:
                page.locator("#load").click()
            chooser.value.set_files(target)
            page.wait_for_function("!Array.from(document.querySelectorAll('.chord-name')).some(n => n.textContent === 'G7')")
            wait_saved(page, "!d.cells.some(c => c.name === 'G7')")
            check(stored(page)["cells"] == exported["cells"], "Opening downloaded JSON restores arrangement")
            page.locator("#undo").click()
            wait_saved(page, "d.cells.some(c => c.name === 'G7')")
            check(stored(page)["cells"] == changed["cells"], "One undo restores pre-load canvas")
            page.locator("#redo").click()
            wait_saved(page, "!d.cells.some(c => c.name === 'G7')")
            check(stored(page)["cells"] == exported["cells"], "Redo restores imported canvas")

            before = stored(page)
            prompt_count = len(dialogs)
            upload(page, '{"broken":')
            page.wait_for_function("document.getElementById('file-message').textContent.includes('not valid JSON')")
            check(stored(page) == before, "Malformed file leaves saved canvas untouched")
            bad = json.loads(json.dumps(exported))
            bad["cells"][0]["duration"]["n"] = "0"
            upload(page, bad)
            page.wait_for_function("document.getElementById('file-message').textContent.includes('positive integer')")
            check(stored(page) == before and len(dialogs) == prompt_count, "Invalid durations reject before replacement prompt")
            upload(page, " " * (2 * 1024 * 1024 + 1))
            page.wait_for_function("document.getElementById('file-message').textContent.includes('smaller than 2 MB')")
            check(stored(page) == before, "Oversized file leaves saved canvas untouched")

            # Loading the same file again still fires change after a rejected file.
            upload(page, exported)
            page.wait_for_function("document.getElementById('files').hidden")
            with page.expect_download() as shortcut_download:
                page.keyboard.press("Control+s")
            check(shortcut_download.value.suggested_filename.endswith(".json"), "Ctrl+S downloads JSON")
            context.close()

        # Actual shared-origin tabs must not clobber each other's local save.
        context = browser.new_context()
        a = context.new_page()
        a.on("pageerror", lambda error: errors.append(str(error)))
        a.goto(args.url)
        enter(a, "C")
        wait_saved(a, "d.cells.length === 1")
        b = context.new_page()
        b.on("dialog", lambda dialog: dialog.accept())
        b.on("pageerror", lambda error: errors.append(str(error)))
        b.goto(args.url)
        a.locator(".tile").focus()
        a.keyboard.press("Enter")
        enter(a, "D7")
        wait_saved(a, "d.cells[0].name === 'D7'")
        b.wait_for_function("document.getElementById('save-indicator').textContent === 'Not saved'")
        check(b.locator(".chord-name").inner_text() == "C", "Competing tab preserves its in-memory canvas")
        b.locator(".tile").focus()
        b.keyboard.press("Enter")
        enter(b, "E7")
        files(b)
        check("Another tab" in b.locator("#save-status").inner_text(), "Competing tab clearly reports paused autosave")
        check(stored(b)["cells"][0]["name"] == "D7", "Paused tab does not overwrite newer save")
        b.locator("#load-browser").click()
        b.wait_for_function("document.querySelector('.chord-name').textContent === 'D7'")
        check(b.locator("#undo").is_enabled(), "Loading browser save remains undoable")
        b.locator("#undo").click()
        b.wait_for_function("document.querySelector('.chord-name').textContent === 'E7'")
        wait_saved(b, "d.cells[0].name === 'E7'")
        check(stored(b)["cells"][0]["name"] == "E7", "Explicit recovery resumes saving")
        context.close()

        # Blank canvases can open files; touch controls, pan, snapping, and
        # clearing the final measure also persist without stale arrangements.
        context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        page = context.new_page()
        page.on("dialog", lambda dialog: dialog.accept())
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.locator("#file-toggle").tap()
        check(page.locator("#load").is_visible(), "Open JSON is available on an empty touch canvas")
        empty = {"format": "chord-canvas", "version": 1, "meter": {"numerator": 3, "denominator": 4}, "cells": []}
        upload(page, exported)
        page.wait_for_function("document.querySelectorAll('.tile').length === 4")
        check(page.locator("#load-file").input_value() == "", "File input resets for repeated loads")
        page.locator("#settings-toggle").tap()
        page.locator("#snap").select_option("7")
        wait_saved(page, "d.view.snap === '7'")
        page.keyboard.press("Escape")
        page.mouse.move(200, 680)
        page.mouse.wheel(55, 93)
        wait_saved(page, "d.view.pan.y !== " + str(exported["view"]["pan"]["y"]))
        before_view = stored(page)["view"]
        page.reload()
        check(stored(page)["view"] == before_view, "Pan and snapping survive reload")
        check(page.locator("#snap").input_value() == "7", "Restored snapping updates the control")
        upload(page, empty)
        wait_saved(page, "d.cells.length === 0 && d.meter.numerator === 3")
        page.reload()
        check(page.locator(".tile").count() == 0 and page.locator("#editor").is_visible(), "An empty saved file reloads with a fresh input")
        enter(page, "C")
        wait_saved(page, "d.cells.length === 1")
        page.locator("#remove").tap()
        wait_saved(page, "d.cells[0].name === null")
        page.locator("#clear-measure").tap()
        wait_saved(page, "d.cells.length === 0")
        page.reload()
        check(page.locator(".tile").count() == 0, "Clearing the last measure does not resurrect it on reload")
        page.locator("#chord-input").fill("Am")
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        check(stored(page)["cells"] == [], "Uncommitted typing never becomes a saved chord")
        page.locator("#file-toggle").tap()
        with page.expect_download() as download:
            page.locator("#download").tap()
        path = output / "touch-draft.json"
        download.value.save_as(path)
        check(json.loads(path.read_text())["cells"][0]["name"] == "Am", "Download commits a valid unfinished chord")
        wait_saved(page, "d.cells[0].name === 'Am'")
        files(page)
        page.keyboard.press("Escape")
        check(page.locator("#file-toggle").evaluate("(el) => el === document.activeElement"), "Escape returns focus to File")
        context.close()

        context = browser.new_context(permissions=["clipboard-read", "clipboard-write"])
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.locator("#chord-input").fill("F#7/C#")
        files(page)
        page.get_by_role("button", name="Copy", exact=True).click()
        page.wait_for_function("document.getElementById('file-message').textContent === 'Copied.'")
        copied = page.evaluate("navigator.clipboard.readText()")
        check(json.loads(copied)["cells"][0]["name"] == "F#7/C#", "Copy commits a valid unfinished chord")
        check(page.locator("#file-message").is_visible(), "Copy confirmation stays visible after committing a draft")
        page.keyboard.press("Escape")
        page.locator(".tile").focus()
        page.keyboard.press("Enter")
        page.locator("#chord-input").fill("not a chord")
        files(page)
        page.get_by_role("button", name="Copy", exact=True).click()
        check(page.locator("#chord-input").get_attribute("aria-invalid") == "true", "Copy rejects invalid unfinished input")
        check(page.evaluate("navigator.clipboard.readText()") == copied, "Invalid input leaves the clipboard untouched")
        page.keyboard.press("Escape")
        # Exercise rejected and missing clipboard APIs without affecting Save.
        for setup in (
            "navigator.clipboard.writeText = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))",
            "Object.defineProperty(navigator, 'clipboard', {value: undefined})",
        ):
            page.evaluate("() => { " + setup + "; }")
            files(page)
            page.get_by_role("button", name="Copy", exact=True).click()
            page.wait_for_function("document.getElementById('file-message').textContent.includes('Copy unavailable')")
            check(page.get_by_role("button", name="Copy", exact=True).is_enabled(), "Clipboard failure re-enables Copy")
            with page.expect_download() as download:
                page.get_by_role("button", name="Save", exact=True).click()
            check(download.value.suggested_filename.endswith(".json"), "Save still works after clipboard failure")
        context.close()

        for failure in ("corrupt", "newer", "denied", "quota"):
            context = browser.new_context()
            if failure in ("corrupt", "newer"):
                raw = "{corrupt" if failure == "corrupt" else json.dumps({**exported, "version": 999})
                context.add_init_script(f"localStorage.setItem({json.dumps(key)}, {json.dumps(raw)})")
            elif failure == "denied":
                context.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked');}})")
            else:
                context.add_init_script("Storage.prototype.setItem = function() {throw new DOMException('full', 'QuotaExceededError');}")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("dialog", lambda dialog: dialog.accept())
            page.goto(args.url)
            enter(page, "Am7")
            page.wait_for_function("document.getElementById('save-indicator').textContent === 'Not saved'")
            files(page)
            with page.expect_download() as download:
                page.locator("#download").click()
            path = output / f"{failure}.json"
            download.value.save_as(path)
            check(json.loads(path.read_text())["cells"][0]["name"] == "Am7", f"JSON backup works with {failure} storage")
            if failure in ("corrupt", "newer"):
                check(page.evaluate("(key) => localStorage.getItem(key)", key) == raw, f"{failure} save is preserved")
                page.locator("#replace-save").click()
                wait_saved(page, "d.cells[0].name === 'Am7'")
                check(stored(page)["version"] == 1, "Explicit confirmation replaces unreadable save")
            context.close()

        check(not errors, f"No browser errors: {errors}")
        print(f"{checks} persistence checks passed. Evidence: {output}")
    finally:
        browser.close()
