#!/usr/bin/env python3
"""Native pointer/keyboard editing and imported-score audio in isolated contexts."""
import argparse
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:4173/music/bass-patterns/")
parser.add_argument("--chromium")
args = parser.parse_args()
output = Path(tempfile.mkdtemp(prefix="bass-staff-check-"))
checks = 0


def check(value, message):
    global checks
    assert value, message
    checks += 1
    print("PASS", message)


def draft(page):
    return page.evaluate("JSON.parse(localStorage.getItem('bayan.bass-patterns.v1')).draft")


def point(page, index, position):
    slot = page.locator(f'[data-bp-slot="{index}"]').first
    slot.scroll_into_view_if_needed()
    return slot.evaluate("""(el,position) => {
      const point = new DOMPoint(+el.getAttribute('x') + +el.getAttribute('width')/2,
        +el.getAttribute('y') + 110 - (position-16)*3.875).matrixTransform(el.parentNode.getScreenCTM());
      return {x: point.x, y: point.y};
    }""", position)


def click_note(page, index, position, touch=False):
    target = point(page, index, position)
    (page.touchscreen.tap if touch else page.mouse.click)(target["x"], target["y"])


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(**({"executable_path": args.chromium} if args.chromium else {}), args=["--no-sandbox"])
    errors = []
    try:
        for width in (320, 390, 768, 1440):
            context = browser.new_context(viewport={"width": width, "height": 950}, has_touch=True,
                                          permissions=["clipboard-read", "clipboard-write"])
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("dialog", lambda dialog: dialog.accept())
            page.goto(args.url)
            check(page.locator("#bp-prison-blues svg").count() == 1, f"Imported staff renders at {width}px")
            slots = page.locator("[data-bp-slot]").evaluate_all("els => [...new Set(els.map(el => Number(el.dataset.bpSlot)))].sort((a,b)=>a-b)")
            check(slots == list(range(22)), "Every note, rest, and entry slot has a hit box across barlines")
            card_steps = page.locator("#bp-prison-blues [data-bp-step]").evaluate_all(
                "els => [...new Set(els.map(el => Number(el.dataset.bpStep)))].sort((a,b)=>a-b)")
            check(card_steps == list(range(18)), "Every saved staff step can be selected and highlighted during playback")
            page.locator("#bp-prison-blues").screenshot(path=str(output / f"prison-{width}.png"))
            for index, position, midi in ((4, 20, 47), (8, 19, 46), (13, 21, 50)):
                page.locator(f'#bp-prison-blues [data-bp-step="{index}"]').first.click()
                check(page.locator("#bp-score .bp-active-note").first.get_attribute("data-bp-step") == str(index),
                      f"Card selection reaches the first note/rest in measure { {4:2,8:3,13:4}[index] }")
                click_note(page, index, position, touch=width < 400)
                page.keyboard.press("ArrowUp")
                check(draft(page)["steps"][index]["notes"][0]["midi"] == midi,
                      f"First note/rest after barline edits its own step {index + 1}")
                focused = page.locator(f'[data-bp-slot="{index}"]').first
                check(focused.evaluate("el => el === document.activeElement && getComputedStyle(el).stroke !== 'none'"),
                      "Keyboard focus box remains visible on the bar-start note")
                page.locator("#bp-undo").click()
            page.locator("#bp-new").click()
            check(page.locator("[data-bp-slot]").count() == 4, "Blank staff has four unsaved entry slots")
            click_note(page, 0, 21, touch=width < 400)
            click_note(page, 1, 23)
            check([s["notes"][0]["midi"] for s in draft(page)["steps"]] == [48, 52], "Native staff taps enter C3 and E3")
            start, end = point(page, 0, 21), point(page, 0, 22)
            page.mouse.move(start["x"], start["y"])
            page.mouse.down()
            page.mouse.move(end["x"], end["y"], steps=5)
            page.mouse.up()
            check(draft(page)["steps"][0]["notes"][0]["midi"] == 50, "Native drag moves C3 to D3")
            page.locator("#bp-undo").click()
            check(draft(page)["steps"][0]["notes"][0]["midi"] == 48, "Dragging is one undo action")
            page.locator("#bp-redo").click()
            page.locator("#bp-chord-mode").click()
            click_note(page, 0, 25)
            check([n["midi"] for n in draft(page)["steps"][0]["notes"]] == [50, 55], "Chord mode adds a simultaneous G3")
            page.locator("#bp-note-mode").click()
            click_note(page, 0, 25)
            page.locator("#bp-accidental").select_option("-1")
            check(draft(page)["steps"][0]["notes"][1] == {"midi": 54, "name": "Gb"}, "Flat applies to the selected chord tone only")
            page.locator("#bp-duration").select_option("9")
            check(draft(page)["steps"][0]["ticks"] == 9, "Dotted eighth duration edits the selected step")
            page.locator("#bp-rest-mode").click()
            click_note(page, 2, 21)
            check(draft(page)["steps"][2]["notes"] == [], "Rest mode enters silence directly on the staff")
            page.locator("#bp-note-mode").click()
            click_note(page, 1, 23)
            page.keyboard.press("ArrowUp")
            check(draft(page)["steps"][1]["notes"][0]["midi"] == 53, "Keyboard moves E3 to F3")
            before = draft(page)
            page.keyboard.press("Control+c")
            check(draft(page) == before, "Copy shortcut does not type a C note")
            page.locator("#bp-copy").click()
            page.wait_for_function("document.getElementById('bp-status').textContent === 'Pattern code copied.'")
            code = page.evaluate("navigator.clipboard.readText()")
            check(code.startswith("BP2.") and page.evaluate("(s)=>BassPatterns.decode(s)", code) == draft(page), "BP2 copies exact notes and rhythm")
            page.locator("#bp-title").fill("Staff test")
            page.locator("#bp-save").click()
            saved = draft(page)
            page.reload()
            check(draft(page) == saved, "Staff edits and named save survive reload")
            check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Staff scroll stays inside the viewport")
            page.locator("#bp-score").screenshot(path=str(output / f"editor-{width}.png"))
            # A real imported pattern crosses the old four-bar line-break boundary.
            page.locator("#bp-prison-blues").get_by_role("button", name="Edit", exact=True).click()
            click_note(page, 17, 20)
            page.keyboard.press("ArrowUp")
            check(draft(page)["steps"][17]["notes"][0]["midi"] == 48, "Last imported note remains editable after four bars")
            page.locator("#bp-undo").click()
            check(draft(page)["steps"][17]["notes"][0]["midi"] == 47, "Undo restores the imported B-natural")
            click_note(page, 1, 30)
            check(page.locator("#bp-accidental").input_value() == "-1", "Selecting imported E-flat updates the accidental control")
            page.locator("#bp-accidental").select_option("0")
            check(draft(page)["steps"][1]["notes"][1]["midi"] == 64, "Natural changes only imported E-flat to E")
            page.locator("#bp-undo").click()
            click_note(page, 1, 30)
            page.keyboard.press("Delete")
            check([n["midi"] for n in draft(page)["steps"][1]["notes"]] == [60, 67], "Delete removes the selected chord tone, not the entire chord")
            context.close()

        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        context.add_init_script("""(() => {
          const Native = AudioContext;
          window.audioNotes = [];
          window.AudioContext = class extends Native {
            createOscillator() {
              const osc = super.createOscillator(), start = osc.start.bind(osc);
              osc.start = when => { audioNotes.push({when, frequency: osc.frequency.value}); return start(when); };
              return osc;
            }
          };
        })();""")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.locator("#bp-tempo").fill("240")
        page.locator("#bp-tempo").press("Tab")
        page.locator("#bp-prison-blues").get_by_role("button", name="Play", exact=True).click()
        page.wait_for_function("audioNotes.length === 32")
        page.wait_for_function("document.querySelector('#bp-prison-blues button').textContent === 'Play'")
        expected = page.evaluate("""() => {
          const p = JSON.parse(document.getElementById('bp-imported').textContent);
          let time = 0; const result = [];
          for (let pass=0; pass<2; pass++) for (const step of p.steps) {
            for (const note of BassPatterns.pitches(step)) result.push({when:time,frequency:440*2**((note.midi-69)/12)});
            time += step.ticks/48;
          }
          return result;
        }""")
        actual = page.evaluate("audioNotes")
        start = actual[0]["when"]
        check(len(actual) == len(expected) == 32, "Prison Blues plays all chord tones across exactly two passes")
        check(all(abs(a["when"] - start - e["when"]) < .002 and abs(a["frequency"] - e["frequency"]) < .001
                  for a, e in zip(actual, expected)), "Playback matches every imported pitch, dotted rhythm, rest, and repeat onset")
        context.close()
        check(not errors, f"No page errors: {errors}")
        print(f"{checks} staff checks passed. Evidence: {output}")
    finally:
        browser.close()
