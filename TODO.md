2026-05-12 - On /music/sheet/cogwork-dancers/, add a chord inspector: hover or click a chord stack and surface bass-button combos, notes, semitones, and interval names using the existing music tools (stradella-data.js, tonal.min.js). Integrate with OSMD graphical-note model.

2026-01-05 - Add PT to Kata section

Add library

2025-12-31 - How to add little info piece to each of my photos? Like XKCD. Each photo has meaning, neat to show on hover or something. 
2025-12-31 - Interactive chromatic accordion keyboard on Music tab? 

reorder color pallete (drag and drop) to try variants, order seems to matter with luminance bands
Reintroduce per-swatch move controls in ditherer with more reliable interaction (was in assets/js/ditherer/main.js)
Add layout settings to _config.yml (single page vs. multi-page)
Debug prod-only CSS: run `JEKYLL_ENV=production bundle exec jekyll build`, then `rg "hsl\\(a" _site/assets/css/main.css`; if present, minifier is corrupting `hsla(...)` into `hsl(a,...)` and dropping ditherer panel borders/backgrounds.

2025-12-27 - Rolled back the Bootstrap container/row/col layout and bounded preview viewport changes for the ditherer page. Attempted to align with al-folio mobile conventions and cap canvas sizes for small screens, but the desktop layout degraded (previews looked cramped and the two-up desktop view regressed). Reverted to the original grid-based layout with aspect-driven stacking; revisit mobile behavior later with a lighter touch.
