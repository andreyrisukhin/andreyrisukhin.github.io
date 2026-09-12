# Site design refresh plan

Status: menu implemented; palette and optional ambient details remain proposed.

## Goal

Keep the site quiet and readable, but make it feel authored rather than inherited from a Bootstrap theme. Use motion to clarify relationships, not to decorate every interaction. Give AI implementation work explicit visual and motion constraints so it does not converge on generic “modern” styling.

The target is a calm academic core with a small number of crafted details:

- warm, low-contrast surfaces;
- one accent hue shared by light and dark modes;
- menus with clear grouping and depth;
- short, spatially consistent motion;
- optional stylized texture away from text and navigation.

## Direction from the Discord ingest

These saved references point to a consistent approach:

- [Emil Kowalski’s motion vocabulary](https://x.com/emilkowalski/status/2061426518333571576) says AI needs specific animation language: stagger, direction-aware motion, spatial consistency, crossfade, and layout animation. Use those terms in implementation prompts instead of “make it feel polished.” ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1511970837413105715), vault source `sources/x/726c643abbe7c080`)
- [Gabriel’s proximity interaction](https://x.com/gabriell_lab/status/2060336070059864461) suggests responding before the cursor reaches an element. This can suit decorative or exploratory controls, but essential navigation targets should not move under the pointer. ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1510144598570434661), vault source `sources/x/d8e226a6ad141c74`)
- [Fiona Fang’s portfolio animation process](https://x.com/fiof_25/status/2077566947470745875) makes the motion path visible and tunes its timing interactively. Use the same method for any signature animation: expose the curve and duration during development rather than accepting the first AI-generated easing. ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1527160727335338096), vault source `sources/x/8c695587653acf63`)
- [Jacky’s personal-site experiments](https://x.com/_jzhao/status/2061143603246952820) use procedurally generated dappled light and dithering to make a personal site distinctive. Treat this as an optional ambient layer, never as a background behind body text or a substitute for hierarchy. ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1511191309266976848), vault source `sources/x/7c8fa3012e119a35`)
- [Triyansha’s Hallmark note](https://x.com/tranquilquill/status/2060181066883998129) values an opinionated design system over copying reference sites. References should inform constraints and taste, not become templates. ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1509905783930880121), vault source `sources/x/e6080076c142eade`)
- [Tereza Tizkova’s site](https://terezatizkova.com) is a useful hierarchy reference: plain navigation, a clear introduction, and writing and projects visible without ornamental containers. Borrow the restraint, not the layout. ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1512594438386356455), vault source `sources/web/8acba62f4e352368`)
- [Checklist Design](https://checklist.design) is the final QA reference for component states and flows. ([Discord note](https://discord.com/channels/1336807647055183964/1458611638239236259/1535750156090347541), vault source `sources/web/d44931c0c157b160`)

## Menu refresh

### Problem addressed

The original dropdown inherited a generic Bootstrap box. Early prototypes added rounded corners, tint, a layered shadow, and hover-driven disclosure. Those treatments felt detached from the site and made a two-link menu look more important than it is.

### Implemented treatment

1. Keep the top-level labels typographically quiet. Use weight and a short underline or tint for the active section, not a filled pill.
2. Attach the square dropdown directly to the navbar divider. Use a one-pixel boundary below and on the sides, with no top rule, radius, tint, or shadow.
3. Give each item a full-row hit area. Underline labels on hover and use a three-pixel accent outline for keyboard focus.
4. Animate only opacity and a two-pixel vertical translation over 120 ms.
5. Keep disclosure click-driven. Hover still indicates a target but never opens or closes the menu.
6. On mobile, render child links as indented rows with a quiet vertical divider rather than a separate panel.
7. Preserve spatial consistency. Do not scale or move the trigger, change panel width during opening, or make targets evade the cursor.
8. Disable translation under `prefers-reduced-motion`; retain the immediate visibility change.
9. Support keyboard navigation, visible focus, Escape to close, and touch without hover dependence.

### AI implementation brief

Use this vocabulary when asking an AI to implement the menu:

> Create a flat disclosure menu attached to the navbar divider. Crossfade the panel while translating it 2 px from the trigger over 120 ms. Keep trigger and item geometry fixed. Use semantic canvas, border, focus, and accent tokens. Use underlines for pointer hover and a visible outline for keyboard focus. Respect reduced motion and keep disclosure click-driven.

Do not prompt with “clean,” “sleek,” “modern,” or “make it pop” without measurable constraints.

## Centralized color system

### Current architecture

The site already has the right two-level shape:

- `_sass/_variables.scss` defines Sass color primitives.
- `_sass/_themes.scss` maps them to light- and dark-mode `--global-*` custom properties.
- Most owned components consume those custom properties.

The weaknesses are naming and leakage. `--global-theme-color` carries too many meanings, light and dark modes use unrelated accent hues, and several owned components still contain literal status and surface colors.

### Proposed palette

This is a starting palette, not an approved visual decision. It keeps the current violet identity but removes the saturated magenta/cyan split.

| Role       | Light     | Dark      | Purpose                       |
| ---------- | --------- | --------- | ----------------------------- |
| canvas     | `#fbfaf7` | `#17151c` | page background               |
| surface    | `#ffffff` | `#211e29` | menus, cards, raised controls |
| text       | `#24212b` | `#f0edf4` | primary text                  |
| text-muted | `#6f6978` | `#aaa3b3` | metadata and secondary labels |
| accent     | `#5b4fcf` | `#a99cff` | links, active states, focus   |
| on-accent  | `#ffffff` | `#17151c` | text on solid accent          |

The proposed text and accent pairs meet WCAG AA for normal text. The palette still needs visual testing against photographs, diagrams, syntax highlighting, and the music tools.

### Token model

Add semantic custom properties in `_sass/_themes.scss`:

```scss
--color-canvas;
--color-surface;
--color-surface-raised;
--color-text;
--color-text-muted;
--color-accent;
--color-accent-hover;
--color-on-accent;
--color-border;
--color-focus;
--color-shadow;
--color-success;
--color-warning;
--color-danger;
```

During migration, keep existing variables as aliases:

```scss
--global-bg-color: var(--color-canvas);
--global-card-bg-color: var(--color-surface);
--global-text-color: var(--color-text);
--global-text-color-light: var(--color-text-muted);
--global-theme-color: var(--color-accent);
--global-hover-color: var(--color-accent-hover);
--global-hover-text-color: var(--color-on-accent);
--global-divider-color: var(--color-border);
```

This lets the palette change in one place without requiring a site-wide component rewrite in the same change.

### Migration sequence

1. Add the semantic primitives and compatibility aliases to `_sass/_themes.scss`; keep `_sass/_variables.scss` for raw Sass values required by build-time color functions.
2. Implement the menu refresh using only semantic tokens. Treat it as the first component proving the palette.
3. Audit owned styles for literal colors. Convert shared UI states first. Do not rewrite vendored CSS or deliberately art-directed modules such as the terrarium merely to eliminate every hex value.
4. Separate accent from status colors. Success, warning, danger, focus, and selected states should not all inherit `--global-theme-color`.
5. Compare light and dark screenshots for the homepage, writing index, one post, publications, and each interactive music page.
6. Run automated contrast checks for text, links, controls, focus rings, and menu states. Require at least 4.5:1 for normal text and 3:1 for large text and component boundaries.
7. Test system, forced light, and forced dark theme settings. Verify transitions do not flash the wrong canvas color.
8. Remove compatibility aliases only after all owned components use semantic tokens.

## Rollout

1. **Menu prototype (complete):** build the flat dropdown, states, and reduced-motion behavior with the existing colors.
2. **Palette branch:** apply the proposed tokens and candidate colors without changing component geometry.
3. **Side-by-side review:** capture the same five representative pages in both themes before choosing the palette.
4. **Controlled merge:** land menu structure and palette separately so either choice can be evaluated or reverted.
5. **Optional signature detail:** only after the core passes, prototype one dithered or dappled-light accent on the homepage. Keep it behind content, motion-reduced, and disposable.

## Acceptance criteria

- The header remains legible and operable at mobile and desktop widths.
- Dropdowns work with mouse, keyboard, and touch.
- Focus is always visible.
- Reduced-motion users receive no translation or stagger.
- No body text or essential target moves in response to pointer proximity.
- Light and dark themes share the same color roles and visual hierarchy.
- Changing the accent or canvas requires editing one theme definition, not individual components.
- The writing index, publications, and interactive tools retain readable contrast.
- Decorative motion can be removed without changing navigation or content hierarchy.
