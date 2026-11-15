---
version: alpha
name: Andrey Risukhin
description: Paper and ink. One warm brown accent, one face, flat square surfaces, and a dot-grid mark taken from bayan buttons.
colors:
  canvas: "#faf7f0"
  surface: "#fffcf7"
  text: "#29251f"
  text-muted: "#72665c"
  accent: "#80533f"
  accent-hover: "#5f3c2c"
  on-accent: "#fffaf4"
  border: "#e1d8cb"
  code-bg: "#f2ece1"
  canvas-dark: "#201d1a"
  surface-dark: "#292521"
  text-dark: "#f2eade"
  text-muted-dark: "#c0b2a2"
  accent-dark: "#dbb696"
  accent-hover-dark: "#ead0b5"
  on-accent-dark: "#201d1a"
  border-dark: "#3f3832"
  code-bg-dark: "#2a2622"
typography:
  h1:
    fontFamily: Nunito Sans
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: Nunito Sans
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.3
  h3:
    fontFamily: Nunito Sans
    fontSize: 1.125rem
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: Nunito Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  reading:
    fontFamily: Nunito Sans
    fontSize: 1.1875rem
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: Nunito Sans
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  tiny:
    fontFamily: Nunito Sans
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0px
spacing:
  dot-pitch: 12px
  dot-size: 1.6px
  reading-column: 42.5rem
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.none}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
  button-secondary-hover:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
  menu:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
  post-paper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
---

# DESIGN.md

Visual design principles for andreyrisukhin.github.io. These are taste calls I want preserved across edits and new pages. AI assistants: read this before changing layout, image placement, or spacing in any `_posts/*.md`, `_pages/*.md`, or `_layouts/*` file.

Pair with `AGENTS.md` (prose). This file governs the visual frame, that one governs the words.

Planned menu, motion, and palette work lives in [`SITE_DESIGN_REFRESH_PLAN.md`](SITE_DESIGN_REFRESH_PLAN.md).

## Core principles

### Creative pages: paper and ink

Music, color (the outfit palette and ditherer), and kata may gather soft watercolor washes as the reader interacts.
Keep this treatment off the homepage, writing, and other non-creative pages.
Music retains its instrument palette. Kata steps sit above a slowly drifting
landscape, with stars, fractured plains, and a distant campfire for Sleep Form.
Only the scenery fades; text remains legible. Keep navigation stationary, pause
step motion on hover or focus, offer a motion toggle, and honor reduced motion.

Tools on these pages (ditherer, outfit palette, color hub) share
`_sass/_creative-tools.scss`. Show the result first and largest. Keep
containers square and unboxed, and separate control groups with hairline rules
and small uppercase labels. Put advanced controls, analysis notes, and the
“why I made this” copy behind a quiet `details` disclosure, leaving the intro
at one line.

Check layout changes to these tools in a built page at desktop (1440 × 900)
and mobile (390 × 844) widths:

```sh
agent-browser eval --stdin < _scripts/ditherer-browser-check.js
agent-browser eval --stdin < _scripts/color-outfit-browser-check.js
```

Each prints its passed checks or throws on the first failure. Read the output:
`agent-browser` can exit 0 after an evaluation error.

### Signature, surfaces, and buttons

The site’s mark is a dot grid: bayan buttons, which also read as dither pixels and LEGO studs.

- The navbar mark (`_includes/dot-mark.liquid`) and the favicon share the same seven-dot shape. Use the accent color and do not redraw it per page.
- Section breaks use the dot rule (`@include dot-rule` or `.dot-rule`): homepage sections and `---` in posts. Hairline rules still separate groups inside a component.
- Surfaces are flat and square: a one-pixel border at most, no radius, no drop shadow. This includes the post paper sheet.
- Use two button styles, from the mixins in `_sass/_variables.scss`: `button-primary` (accent fill) for the one main action, and `button-secondary` (hairline outline) for everything else. Unavailable buttons use `button-disabled`: dashed outline, reduced opacity.

### Identity spec

The front matter of this file holds the tokens in the [design.md](https://github.com/google-labs-code/design.md) format, so tools and agents can read them directly. `_themes.scss` is the source of truth; keep the two in step. Light values carry the plain name and dark values end in `-dark`.

**Color.** The site brown (`accent`) is the only accent, on every page including music and sheet music. Use it for links, the mark, the dot rule, focus rings, and the primary button. Page palettes may change paper and ink, never the accent. Text meets 4.5:1 against its surface in both themes; controls and focus rings meet 3:1.

The color palette tool at `/color/palette/` offers an explicit, browser-local exception: visitors may apply generated paper, ink, and accent colors across the website, or reset to the identity palette. Generated text and accent colors must retain 4.5:1 contrast in both themes. Do not recolor artwork or notation.

**Shape.** Every corner is square (`rounded.none`). Borders are one pixel in `border`. No drop shadows on surfaces, cards, menus, or post photos.

**Buttons.** Two styles. Primary is an accent fill with `on-accent` text; on hover it darkens (light) or lightens (dark) to `accent-hover`. Secondary is a one-pixel `border` outline on the page color; on hover the outline takes the text color. Disabled keeps its outline but goes dashed at 55% opacity. Callers set size and padding; one group of controls shares one height.

**Dot-grid mark.** Seven circles on a 32-unit grid in three rows (2, 3, 2), radius 3.6, stroke 1.7, filled or open as in `_includes/dot-mark.liquid`. It appears in the navbar and the favicon, in the accent color, at 18 px. The dot rule repeats one dot of 1.6 px every 12 px at 55% opacity. Allowed places: the navbar, the favicon, homepage section breaks, and `---` in posts. Not as a background texture, a bullet, or a loading indicator.

**Motion budget.** Motion explains a change; it never decorates.

- Hover and press: color, border, and underline changes only, 120 ms `ease`. No scale or lift.
- Menus: 120 ms crossfade with a 2 px translate from the trigger, `ease-out`, origin at the trigger.
- Nothing over 300 ms on navigation or content. Creative pages (kata scenery, watercolor washes) may run slower, behind a motion toggle.
- No entrance animation or stagger on page load.
- Under `prefers-reduced-motion: reduce`, drop every translate and keep only immediate visibility or opacity changes.

**Menu brief.** Use this prompt when changing the navbar menus:

> Create a flat disclosure menu attached to the navbar divider. Crossfade the panel while translating it 2 px from the trigger over 120 ms. Keep trigger and item geometry fixed. Use the canvas, border, focus, and accent tokens. Use underlines for pointer hover and a visible outline for keyboard focus. Respect reduced motion and keep disclosure click-driven.
> The homepage leads with the work. Its grid reads `_data/home_work.yml`; thumbnails are 720 × 480 WebP crops in `assets/img/home/`.

### 1. Images need room to breathe

Pictures lose impact when crammed against text. A photo separated from the surrounding paragraphs by clear vertical space reads as deliberate; a photo flush against text reads as filler.

- Always leave a blank line above and below `{% include figure.liquid %}` blocks. In Markdown that means an empty line on each side.
- Do not stack two figures with no prose or visible spacing between them unless they form an intentional pair (then call it out with a caption, side-by-side layout, or shared frame).
- Default to one figure per "thought." If the thought is a single sentence, the figure stands alone; if it's a paragraph, the figure punctuates the paragraph.
- Prefer fewer larger images over many small ones. A single well-placed photo beats three half-relevant ones.

### 2. Captions are optional but should be earned

A caption that just restates what the photo shows is noise. Caption only when there is something the reader cannot see (who took it, what's just out of frame, why it's here). The Perceptron post photo credit at the end is the right shape.

### 3. Typographic restraint

- One typeface sitewide: Nunito Sans (Google Fonts via `google_fonts` in `_config.yml`, upright and italic, weights 300-800), set as `$site-font` in `_sass/_variables.scss`. Body weight is 400; use 700 for bold. Code stays monospace.
- Use a small, discrete type scale across the site. Do not introduce one-off font sizes for page-specific polish.
- Default roles:
  - Body text: `1rem` / `16px`, line-height `1.5`.
  - Small text: `0.875rem` / `14px`, line-height `1.5`, for metadata, captions, dates, and helper text.
  - Tiny text: `0.75rem` / `12px`, line-height `1.4`, for dense labels only.
  - H1/page title: `2.5rem` / `40px`, line-height `1.2`.
  - H2/section title: `1.5rem` / `24px`, line-height `1.3`.
  - H3/card title: `1.125rem` / `18px`, line-height `1.35`.
- Blog posts (`layout: post`) use a reading scale instead of the body role above, defined in `_sass/_post-reading.scss`:
  - Column: `42.5rem` / `680px`, about 70 characters per line. Long lines are the main cause of reading fatigue.
  - Body: the site face at `1.1875rem` / `19px`, line-height `1.6`, weight 400, near-black text. `1.125rem` on phones.
  - Title, H2/H3, and captions use the same face: bold headings with generous space above, italic muted captions at the small size.
  - In local previews, `?font=<name>` on a post URL tries other faces (`assets/js/post-font-preview.js`).
  - Posts sit on a Flexoki paper sheet by default (`post_style: paper` in `_config.yml`), matching the sheet music pages. This is the one allowed exception to keeping paper treatment off writing pages. A post can opt out with `post_style: reading` in its front matter.
- Page descriptions should not look like second-class body copy. If a description is the lead sentence for a page, render it at body size, not metadata size.
- Tool-specific UI can use small/tiny text for controls, badges, and compact diagrams, but explanatory prose on tool pages should stay at body size.
- One H1 per page (the title), then H2 sparingly. Do not use H3+ unless the post genuinely has nested structure.
- Bold and italics carry weight only when rare. If most paragraphs contain a bold phrase, none of them do.
- Inline code (`<code>` or backticks in body Markdown) is for actual identifiers, file paths, regex, and shell. Not for emphasis.
- **Quotation marks: use curly, not straight.**
  - Prose body and image captions both use `“…”` (U+201C / U+201D) for double quotes and `‘…’` (U+2018 / U+2019) for single quotes.
  - Apostrophes in contractions (`it’s`, `I’m`, `Andrey’s`) use `’` (U+2019), not `'`.
  - Straight quotes (`"`, `'`) are reserved for code, file paths, command-line args, and Liquid/HTML attributes, places where a string is a literal, not prose.
  - **Why this matters mechanically.** Liquid include args use `param="value"` syntax; an embedded straight `"` inside the value silently terminates it and crashes the build (e.g. `caption="A: "B""` parses as `caption="A: "` followed by garbage). Curly quotes are invisible to the parser, so quoted speech inside a caption Just Works. See `_posts/2026-05-01-time-at-perceptron-ai.md` for a working example (`caption="Halloween: “Are you Steve Jobs or Elizabeth Holmes?”"`).
  - **Why this matters aesthetically.** Mixing straight and curly quotes within a single page reads as careless. Pick one and hold the line.
  - When AI assistants edit prose, replace any straight `"`/`'` they introduce with the curly equivalents on save, except inside fenced code blocks, inline backticks, or Liquid/HTML attribute values.
- **No em dashes.** Do not use the U+2014 em dash in prose, captions, or docs. Prefer a comma, colon, semicolon, parentheses, or a new sentence.

### 4. Writing should get out of its own way

The visual design works only if the prose is clean. A page with careful type and loose sentences still feels noisy.

- Delete every word doing no work. If removing a word leaves the meaning intact, cut it.
- Kill weak qualifiers: “very,” “rather,” “somewhat,” “quite,” “fairly,” “in a sense,” and “a bit.” If the sentence needs a hedge, make the uncertainty explicit.
- Prefer active verbs with clear subjects. Use passive voice only when the actor truly does not matter.
- Keep one thought per sentence. Split sentences that carry two ideas unless the tension between them is the point.
- Cut throat-clearing openings. Start where the page has something to say.
- Prefer the short word: “use” over “utilize,” “now” over “at this point in time,” “show” over “demonstrate,” “help” over “facilitate.”
- Replace adverb-plus-verb pairs with exact verbs when possible: “sprinted” beats “ran quickly.”
- Write for one intelligent, curious reader, not for an average crowd.
- Let endings land. Do not summarize the thing the reader just read.
- Treat the first draft as raw material. Rewrite by cutting.

### 5. Lists are punctuation, not scaffolding

- Use a list when items are genuinely parallel and prose would force a stilted "first... second... third..." structure.
- Three to five items is the sweet spot. Two-item lists are usually a sentence with a comma. Eight-item lists are usually two grouped sub-lists.

### 6. Whitespace is the cheapest design tool

Blank lines between sections cost nothing and buy clarity. Err on the side of more.

### 7. Front-matter values that contain prose-like content

When a YAML front-matter value (e.g. `subtitle:`, `description:`, `caption:`) includes inline HTML, punctuation, or any `: ` / `"` / `'` sequence, **use a block scalar**, not an unquoted or single-line quoted scalar:

```yaml
subtitle: >-
  Self-Improving <code title="Kleene plus notation: {&quot;Coding Droids&quot;, ...}">…</code> at <a href='https://factory.ai/'>Factory AI</a>.
```

`>-` means _folded scalar, strip trailing newline_. It tolerates any character without escaping: `:`, `"`, `'`, `#`, leading dashes, all safe. Same rationale as the curly-quotes rule: the parser shouldn't have to wade through prose looking for sigils.

Symptom when violated: `YAML Exception ... mapping values are not allowed in this context at line N column M`. The watcher then silently stops regenerating that page (the homepage when it's `_pages/about.md`).

- `figure.liquid` block:
  ```
  {% include figure.liquid path="assets/img/posts/<dir>/<file>.jpg" class="img-fluid rounded z-depth-1" %}
  ```
  `img-fluid rounded z-depth-1` is the house style; do not change it without reason. Inside posts, `_sass/_post-reading.scss` overrides the radius and shadow so photos sit square and flat.
- Image dirs follow `assets/img/posts/<year>-<short-slug>/`.
- Photo credits go at the bottom of the post inside `<small>*…*</small>` after a horizontal rule (`---`). See the Perceptron post.

## Things to flag

When reviewing my drafts, raise these visual issues with the same priority as the prose anti-patterns in `AGENTS.md`:

1. Adjacent figures with no separating prose or whitespace.
2. Figures jammed against the section heading above them.
3. More than ~5 images in a single post (consider gallery layout instead).
4. Heading hierarchy violations (H3 with no H2 parent, multiple H1s).
5. Captions that restate the obvious.
6. Bold/italic emphasis used as decoration rather than meaning.

## Open questions / future entries

- Side-by-side image pairs: pick a single Liquid pattern and document it here.
- Mobile rendering audit: figure widths and caption wrapping.
