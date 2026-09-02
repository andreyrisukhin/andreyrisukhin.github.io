# DESIGN.md

Visual design principles for andreyrisukhin.github.io. These are taste calls I want preserved across edits and new pages. AI assistants: read this before changing layout, image placement, or spacing in any `_posts/*.md`, `_pages/*.md`, or `_layouts/*` file.

Pair with `AGENTS.md` (prose). This file governs the visual frame, that one governs the words.

## Core principles

### 1. Images need room to breathe

Pictures lose impact when crammed against text. A photo separated from the surrounding paragraphs by clear vertical space reads as deliberate; a photo flush against text reads as filler.

- Always leave a blank line above and below `{% include figure.liquid %}` blocks. In Markdown that means an empty line on each side.
- Do not stack two figures with no prose or visible spacing between them unless they form an intentional pair (then call it out with a caption, side-by-side layout, or shared frame).
- Default to one figure per "thought." If the thought is a single sentence, the figure stands alone; if it's a paragraph, the figure punctuates the paragraph.
- Prefer fewer larger images over many small ones. A single well-placed photo beats three half-relevant ones.

### 2. Captions are optional but should be earned

A caption that just restates what the photo shows is noise. Caption only when there is something the reader cannot see (who took it, what's just out of frame, why it's here). The Perceptron post photo credit at the end is the right shape.

### 3. Typographic restraint

- Use a small, discrete type scale across the site. Do not introduce one-off font sizes for page-specific polish.
- Default roles:
  - Body text: `1rem` / `16px`, line-height `1.5`.
  - Small text: `0.875rem` / `14px`, line-height `1.5`, for metadata, captions, dates, and helper text.
  - Tiny text: `0.75rem` / `12px`, line-height `1.4`, for dense labels only.
  - H1/page title: `2.5rem` / `40px`, line-height `1.2`.
  - H2/section title: `1.5rem` / `24px`, line-height `1.3`.
  - H3/card title: `1.125rem` / `18px`, line-height `1.35`.
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
  `img-fluid rounded z-depth-1` is the house style; do not change it without reason.
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
- Dark mode contrast on photo borders (`z-depth-1` shadow).
