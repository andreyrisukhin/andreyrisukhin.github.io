---
name: site-design-review
description: Screenshot critique of andreyrisukhin.github.io after a UI change. Captures the core pages in light and dark at desktop and phone widths, grades cohesion, originality, craft, and function against DESIGN.md and calibration screenshots, and returns line-referenced fixes. Use before handing off or merging any change to layouts, Sass, navigation, or page chrome.
---

# Site design review

A second pair of eyes on rendered pages, not on code. Grade what a visitor sees.

## 1. Capture

Serve a production build (see `AGENTS.md`, “Local preview”), then capture the review set:

```sh
bin/design-screenshots http://localhost:<port> /tmp/design-review/<round>
```

The default set is the homepage, writing index, one post, publications, and the music notebook, each in light and dark at 1440 × 900 and 390 × 844. Add the pages the change touches as extra arguments. Pass `FULL=1` when the problem sits below the first screen.

## 2. Calibrate

Open the three approved screenshots in `calibration/` before grading. They show the bar: homepage (light), music notebook (dark), and a post on its paper sheet (light). A page that looks like it belongs next to them passes cohesion. If a calibration image no longer matches the approved design, say so and ask for a new one instead of grading against it.

## 3. Grade

Score each page 1 to 5 on four axes. Use the site’s vocabulary from `DESIGN.md`: paper and ink, site brown, dot grid, flat square surfaces, hairline rules, primary and secondary buttons. Do not use vague praise (“polished,” “museum quality,” “modern”).

- **Cohesion.** Does it read as the same site as the calibration set? One accent (the site brown), one face (Nunito Sans), flat square surfaces, the dot rule for section breaks.
- **Originality.** Is anything still a template default? Bootstrap cards with shadows, rounded pills, Font Awesome icons used as decoration, stock al-folio metadata lines.
- **Craft.** Run the checklist below on every screenshot.
- **Function.** Is the main content first and largest? Do controls say what they do? Does the phone layout keep the same hierarchy without sideways scrolling?

Craft checklist:

- Alignment: left edges of title, body, and grid share one line; nothing floats a few pixels off.
- Radii: all corners square. Any rounded corner is a finding.
- Control sizes: buttons and inputs in one group share a height and padding.
- Spacing: gaps follow a visible rhythm; no element is jammed against a heading or rule.
- Type: sizes come from the DESIGN.md scale; no one-off sizes.
- Color: dark mode keeps contrast (text 4.5:1, controls 3:1); no leftover maroon, teal, or Bootstrap blue.

## 4. Report

Lead with a table, worst finding first:

| Page and theme | Finding | Fix | File |
| -------------- | ------- | --- | ---- |

Then the four scores per page and one sentence on the single change that would most improve the set. Cite `file:line` for every fix you can locate.

## 5. Iterate

After fixes, capture a new round into a new directory and grade again. Stop after three rounds. If findings remain, list them for the user rather than continuing.
