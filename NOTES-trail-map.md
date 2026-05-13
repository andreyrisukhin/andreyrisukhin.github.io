# Trail map iteration notes

A running record of how the Leaflet-based trail map at
`/trails/zion-dry-river-walk/` came together, and the concrete
gotchas worth remembering before extending it (or building a
second trail page).

Companion to `NOTES-dev-annotator.md` — both reuse the
`?dev=1` + sidecar + `sheet-dev-mode` opt-in pattern from the
sheet-music annotator. This file is focused on the Leaflet
specifics + the public-vs-editor split + the deploy gotchas.

## File layout

- `_pages/trails-zion-dry-river-walk.md` — Jekyll page, inlines
  `_data/zion-paths/dry-river-walk.json` via Liquid bracket
  notation (slug has hyphens, dot notation breaks).
- `_data/zion-paths/<slug>.json` — committed source of truth.
  Schema: `{ slug, name, updatedAt, center, zoom, pins[],
  segments[] }`. Each pin: `{ id, kind, lat, lng, note,
  labelLatLng? }`. Each segment: `{ id, kind, note,
  waypoints: [[lat,lng], ...] }`.
- `assets/js/map/leaflet-map.js` — public reader. Renders
  pins + always-on draggable speech-bubble labels + leader
  lines + segments. Returns a controller object the editor
  can hook into.
- `assets/js/map/leaflet-editor.js` — `?dev=1` editor. Mounts
  a floating panel, wraps `controller.render` to add edit
  popups + click-mode handlers, and POSTs back to the sidecar.
- `assets/js/map/leaflet-map.css` — shared styles (reader
  tooltips were removed; only label/leader/editor styles now).
- `bin/dev-annotator-server.mjs` — sidecar. Handles both the
  music annotator and the trail save/load endpoints.

## What we learned (Leaflet specifics)

### `.leaflet-popup-content-wrapper` inherits page colour

al-folio's dark theme sets a near-white text colour on `body`.
Leaflet popups have a white background but their content
wrapper inherits the parent colour, so in dark mode every
popup was white-on-white. **Lock it explicitly:**

```css
.leaflet-popup-content-wrapper {
  background: #ffffff !important;
  color: #0d1117 !important;
}
.leaflet-popup-content { color: #0d1117 !important; }
.leaflet-popup-tip    { background: #ffffff !important; }
```

Same bug applies to **form inputs inside popups** (`<select>`,
`<textarea>`) — they take their colour from the page, so dark
mode renders invisible typing on a white field. Pin `color` on
the form root.

### `transform` on `.leaflet-popup` / `.leaflet-marker-icon` breaks positioning

Leaflet writes `transform: translate3d(...)` inline on these
elements every frame to position them. CSS animations using
`transform` on the same element fight Leaflet and the popup
ends up at the wrong screen location. **Animate the inner
wrapper** (`.leaflet-popup-content-wrapper` for popups, the
inner span inside the divIcon for markers).

### `divIcon` `iconSize` is rigid; auto-size with the [0,0] hack

`L.divIcon({ iconSize: [W, H] })` gives the wrapper a fixed
hit box. For variable-width content (a speech-bubble label
that may say `"Park here"` or `"walk under road through
tunnel and keep walking, enjoy the view!"`) a fixed box
either:

- swallows nearby map clicks if the box is bigger than the
  visible label, or
- clips the label if the box is smaller.

**Workaround:** `iconSize: [0, 0]` + CSS:

```css
.your-wrap {
  width: auto !important;
  height: auto !important;
  background: transparent !important;
  border: 0 !important;
}
```

The `!important` overrides Leaflet's inline width/height. The
wrapper now hugs the visible content and `mousedown` fires
only on the actual visible bubble.

### Marker `iconAnchor [0, 0]` puts the lat/lng at top-left

Useful default for variable-size content (you can't pre-compute
"center" before the DOM exists). But if you want a leader line
to terminate at the **visible center** of the bubble, you have
to measure the rendered DOM:

```js
const r = inner.getBoundingClientRect();
const tl = map.latLngToContainerPoint(marker.getLatLng());
const center = L.point(tl.x + r.width / 2, tl.y + r.height / 2);
leader.setLatLngs([map.containerPointToLatLng(center), pinLL]);
```

Recompute on `add` (after one rAF so the DOM is mounted), on
every `drag` tick, and on `zoomend` — the bubble's pixel width
is constant across zooms but its **geographic** centre shifts.

### Layer click events also bubble to `map.on('click')`

By default, clicking a marker or polyline triggers BOTH the
layer's click handler AND the map's. In editor mode, that
meant clicking an existing pin in "Drop pin" mode dropped a
second pin on top, and clicking a polyline in "New segment"
mode added a stray waypoint. **Always**:

```js
layer.on('click', (ev) => { L.DomEvent.stopPropagation(ev); });
```

…inside editor click handlers, where modal modes interact with
the map background.

### Hover-vs-touch UX branching

Detect the device once at init, not per-event:

```js
const isHoverDevice = window.matchMedia(
  '(hover: hover) and (pointer: fine)'
).matches;
```

Use this to decide whether to wire `mouseover`/`mouseout` (or
to bind a tooltip vs handle click-toggling for tap-to-peek).

### Tooltips were the wrong primitive; so were popups

We iterated through:

1. `bindPopup` + custom hover-open + 220 ms close timer → still
   needed an X click to dismiss reliably; popup chrome too
   heavy.
2. `bindTooltip` + tap-toggle for touch → cleaner, but the
   tooltip was ephemeral. When the user wants to read a map
   they want labels persistent.
3. Permanent draggable `L.marker` with a `divIcon` containing
   the label HTML, plus a separate `L.polyline` leader line.
   Each label is a full Leaflet marker — geographic position,
   draggable, persists via `pin.labelLatLng`.

The lesson: **decide what the primitive is supposed to be**
before iterating on its CSS. We rebuilt the popup styling 4
times before realising "always-on draggable label" wasn't the
same shape as a popup at all.

### Snap-to-pin via container pixels

For the "click anywhere near a pin to extend a segment to that
exact pin" affordance:

```js
const target = map.latLngToContainerPoint(latlng);
let best = null, bestDist = SNAP_PX;
for (const p of state.pins) {
  const px = map.latLngToContainerPoint([p.lat, p.lng]);
  const d = Math.hypot(px.x - target.x, px.y - target.y);
  if (d < bestDist) { best = p; bestDist = d; }
}
```

Pixel distance, not geographic. The visual hit area should
feel like ~24 px regardless of zoom level.

### Persist screen state in geographic coords

Pixel positions are zoom-dependent. Geographic positions are
zoom-stable. Store `labelLatLng: { lat, lng }`, never
`labelOffsetPx`. Same reasoning for default placements:
compute once in pixels, immediately convert to lat/lng, then
forget the pixel value.

### Stagger defaults to avoid pile-ups

When all pins shared one default offset (`+28 right, -36 up`)
a cluster of nearby pins stacked every label at the same
spot. Cheap fix: rotate through 8 angles by pin index.
Doesn't guarantee non-overlap but the starting layout is
usable instead of confusing. (We deferred force-directed
auto-layout — manual drag + persist was good enough.)

### Strip session-only flags before save

Anything starting with `_` is session state, not data:

```js
function stripPrivateFields(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (!k.startsWith('_')) out[k] = obj[k];
  }
  return out;
}
```

Pass each pin through this before POSTing to the sidecar so
`_labelAuto` (and any future helper flag) doesn't leak into
the committed JSON.

### Zoom-tier visibility

Treat the data file's `zoom` as "base" and compute deltas:

```js
const BASE_ZOOM = initialData.zoom ?? FALLBACK_ZOOM;
function applyZoomScale() {
  const delta = BASE_ZOOM - map.getZoom();
  const c = map.getContainer();
  c.classList.toggle('zoom-shrink', delta === 1);
  c.classList.toggle('zoom-hide-labels', delta >= 2);
}
map.on('zoomend', applyZoomScale);
```

Lets viewers zoom out for regional context without label
noise; pin dots stay visible to anchor the view.

## What we learned (deploy + caching)

### `.github/workflows/deploy.yml` `paths:` excludes `_data/**` by default

The al-folio deploy workflow's `paths:` filter only watches
source-code files (`assets/**`, `_sass/**`, `**.html`,
`**.js`, `**.md`, `**.yml`, etc.). It **does not** watch
`_data/**` or `**.json`. We were saving label positions to
`_data/zion-paths/dry-river-walk.json`, pushing, and watching
nothing happen — Pages never rebuilt because the workflow
didn't trigger.

**Fixed in `69b805c` by adding:**

```yaml
paths:
  - "_data/**"
  - "**.json"
```

…to both `push:` and `pull_request:` blocks. **Apply the same
fix in any forked al-folio repo before relying on
data-driven content.**

### How to verify what's actually live

Browser cache and CDN cache lie. To see what the public is
served:

```sh
curl -sL 'https://andrey.risukh.in/trails/zion-dry-river-walk/?cb='$(date +%s) \
  | grep -oE '"updatedAt":"[^"]*"'
```

Compare against the `updatedAt` in `_data/zion-paths/<slug>.json`.
Mismatch = build hasn't shipped (check `gh run list`) or CDN
hasn't propagated (Fastly/Pages tier, usually <2 min).

### Pages workflow trigger sanity-check

After any push that "should" deploy:

```sh
gh run list --limit 5 --json status,conclusion,name,headSha \
  --jq '.[] | "\(.status) \(.conclusion // "-") \(.name) \(.headSha[0:7])"'
```

Look for `Deploy site` against the new sha. If only
`Prettier code formatter` ran, your change didn't match
deploy's `paths:` filter — extend the filter (see above) or
touch one of its watched paths.

## Editor + reader split

The reader (`leaflet-map.js`) is self-contained. It returns
a **controller object** with everything the editor needs to
hook into:

```js
{
  map, state, render,
  pinLayer, segmentLayer, labelLayer, leaderLayer,
  onLabelDrag,    // { fn: null } -- editor sets fn to mark dirty
  PIN_COLORS, SEGMENT_COLORS,
}
```

The page wires `window.__trailMap = controller` after
calling `init()`, and `leaflet-editor.js` polls for it on
boot. Editor wraps `controller.render` to add edit-form
popups, drag handlers on pin markers, and click-mode
behaviour, **without modifying** the reader. This keeps the
public bundle small (no edit code on cold loads) and the
editor file purely additive.

The "set a function on a config object" pattern
(`controller.onLabelDrag.fn = setDirty`) is how the reader
exposes hooks the editor opts into without the reader
needing to know about the editor.

## Editor UX patterns worth keeping

- **Items list with focus + delete buttons** in the editor
  panel — discoverable way to nuke a segment without having
  to click its thin polyline.
- **Visible waypoint dots while building a segment** — first
  click was invisible until the polyline materialised on
  click 2; visible markers fix that.
- **Toggle-mode button** (`New segment` ↔ `Finish segment`)
  — explicit Finish action instead of "press Esc and hope
  for the best".
- **Snap-to-pin highlight**: blue ring waypoint dot when
  snapped, red ring when free; status text says "snapped to
  p2".

## Patterns to reuse for the next trail page

1. Copy `_pages/trails-<slug>.md` and change the Liquid
   `assign trail = trailsRoot["<slug>"]` line.
2. `cp _data/zion-paths/<existing>.json
   _data/zion-paths/<new-slug>.json`, edit `slug`, `name`,
   `center`, `zoom`, blank pins/segments.
3. Visit `/trails/<new-slug>/?dev=1` and start dropping pins.
4. Save → `git add _data/zion-paths/<new-slug>.json && git
   commit && git push`. Pages now rebuilds because the
   workflow filter includes `_data/**`.

If sharing publicly, keep `nav: false`, `sitemap: false`,
and the `<meta name="robots" content="noindex, nofollow">`
in the page body.

## Pending / deferred

- **Auto-layout for overlapping labels.** Started a force-
  directed pass; cut it because manual drag + persist was
  faster to ship. Worth revisiting for trails with >5 close
  pins.
- **Per-trail label scale config.** Hard-coded "shrink at
  -1, hide at -2" might want per-page tuning if a future
  trail's base zoom is much wider.
- **Touch-device label drag UX.** Drag works on touch via
  Leaflet defaults; haven't validated the feel on a real
  phone.
- **Batch-save UX in the editor.** Currently every drag flips
  dirty + status, but Save is still a manual click. Auto-save
  on dragend would shorten the drag-loop, at the cost of more
  sidecar requests.
