# Sheet Music Design

Sheet music pages should feel like digital paper for practice: warm, readable,
quiet, and centered on the score. The page should feel closer to an annotated
music stand than to a generic web app.

## Palette

Use Flexoki as the sheet music palette because it is designed around ink, paper,
and long-form reading on screens.

Core light theme values:

- Paper: `#FFFCF0`
- Surrounding background: `#F2F0E5`
- Primary ink: `#100F0F`
- Muted ink: `#6F6E69`
- Faint marks: `#B7B5AC`
- Borders: `#E6E4D9`
- Active controls and cursor accents: `#24837B`
- Warnings and mistakes: `#AF3029`
- Highlights and practice marks: `#FAEEC6`, `#DDF1E4`, `#EDEECF`

Dark mode should still feel like ink and paper, not a black app shell. Use
Flexoki dark base colors for the surroundings, but keep the score surface warm
enough to read comfortably.

Core dark theme values:

- Surrounding background: `#100F0F`
- Secondary background: `#1C1B1A`
- Panel background: `#282726`
- Primary text: `#CECDC3`
- Muted text: `#878580`
- Borders: `#343331`
- Active controls and cursor accents: `#3AA99F`

## Surface model

- The browser page is the desk or room.
- The score is a warm paper sheet with a subtle edge and shadow.
- Controls are page furniture: small, quiet, and close to the score.
- Dev tools and practice overlays must remain subordinate to notation.

## Layout rules

- Keep the score centered with generous breathing room.
- Use a paper-toned score background instead of pure white.
- Use soft borders and shadows to suggest a sheet laid on a desk.
- Avoid heavy panels around notation.
- On mobile, let the score use the full width while keeping controls compact.

## Interaction rules

- The default mode is reading mode.
- Practice controls should appear as small paper-toned buttons.
- Active states use Flexoki cyan.
- Errors and wrong notes use Flexoki red.
- Highlights use pale Flexoki tints, never neon colors.
- Playback, Stradella overlays, and dev annotations should not obscure notes.

## Typography rules

- Surrounding prose follows the site-wide type scale.
- Control labels use the site small size.
- OSMD owns notation typography. Do not override score glyphs unless fixing
  contrast or page feel.

## Cogwork Dancers playback recipe

The Cogwork Dancers page uses a pre-rendered audio file by default, with live
SoundFont playback kept as a comparison mode.

What made the static render work:

- Run `node bin/render-sheet-audio.mjs cogwork-dancers`.
- The script exports a temporary MusicXML copy for audio only. Keep the
  committed MusicXML unchanged for score display.
- The script removes MusicXML `<harmony>` blocks before rendering. MuseScore
  treats hidden harmony/chord symbols as accompaniment, which created a second
  delayed playback line.
- The script sets the notated part to String Ensemble in the temporary MusicXML
  before rendering.
- The script renders the MP3 with MuseScore Basic and saves it as
  `assets/music/sheet-music/cogwork-dancers/cogwork-dancers-strings.mp3`.
- The script saves a timing map beside it as `cogwork-dancers-timing.json`. The
  map uses score tempo markings to drive measure seeking.
- Cache-bust both the MP3 and timing JSON whenever either asset changes.
- Keep the live SoundFont mode optional. It is useful for testing instrument
  colors, but it can lag because it schedules many notes and moves the OSMD
  cursor on the main thread.

## Do nots

- Do not use pure white page backgrounds for sheet music.
- Do not use permanent dark widgets on light paper.
- Do not use neon overlay colors.
- Do not add heavy app chrome around the score.
- Do not use em dashes.
