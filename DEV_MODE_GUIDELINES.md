# Dev Mode Guidelines

Dev mode is a local-only feedback layer for inspecting, annotating, and tuning
the site while developing. It should never feel like a second product UI.

## Activation

- Use `?dev=1` to turn dev mode on.
- Use `?dev=0` to turn dev mode off and clear persisted mode flags.
- Persist the enabled state in localStorage so reloads keep the same mode.
- Keep dev mode disabled by default on production URLs and non-local hosts.

## One page, one dev control

- A page should show only one dev-mode entry point.
- The global site annotator owns general pages.
- Specialized pages may replace the global annotator with a domain-specific
  tool, such as the sheet music annotator.
- When a specialized annotator is active for a route family, the global
  annotator should opt out for that route family.
- Shared storage keys can be mirrored, but duplicated buttons or sidebars
  should not appear.

## Current route ownership

- General local pages use `assets/js/site-dev-annotator.js`.
- Sheet music pages under `/music/sheet/` use
  `assets/js/sheet-music/dev-annotator.js`.
- Sheet music pages skip the global site annotator so the sheet-specific
  control is the only visible dev button.

## Interaction rules

- Dev controls must stay out of the reading path.
- Dev controls must not obscure primary page content, notation, or playback
  controls.
- Dev clicks must not leak into production interactions.
- Sheet music reserves shift-click and two-finger tap for annotation pins.
- Playback and chord-inspector interactions should ignore dev UI elements.

## Storage and sidecar rules

- Use localStorage for mode persistence and offline fallback state.
- Use route-scoped storage keys for annotations.
- Keep the sidecar local, currently `http://127.0.0.1:4001`.
- Sidecar failures should degrade to localStorage, not block page use.
- Never require the sidecar for normal reading mode.

## Implementation checklist

- Gate dev tools by local host or explicit local-only loading.
- Support both `?dev=1` and `?dev=0`.
- Cache-bust dev scripts when behavior changes.
- Use one route owner per page.
- Add selectors so interactive tools can ignore each other.
- Verify with a browser check that only one dev button appears.
- Run Prettier and the relevant site validators before committing.

## Do nots

- Do not show multiple dev toggles on one page.
- Do not make dev mode visible by default.
- Do not let dev overlays capture clicks when disabled.
- Do not require a running local server for normal visitors.
- Do not store secrets or credentials in annotation payloads.
- Do not use em dashes.
