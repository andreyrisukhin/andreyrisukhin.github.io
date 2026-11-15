# Site cohesion assessment

Status: assessment, November 2026. Recommendations 1 to 4 are implemented (homepage work grid, dot-grid mark and rules, research and workshop menus, flat surfaces and two button styles). The accent color and the theme residue await case-by-case decisions.

Reviewed on the live site at 1440 × 900: home, writing, one post, music, kata, chess, ditherer, outfit palette, LEGO, and fireplace. Mobile and dark mode were not reviewed. Companion to [`SITE_DESIGN_REFRESH_PLAN.md`](SITE_DESIGN_REFRESH_PLAN.md), which covers the menu and color tokens.

## Summary

The site reads as two sites sharing a navbar: a tidy academic template and a set of handmade objects (fireplace, kata, ditherer, bayan tools, LEGO). The handmade work is what a visitor would remember, but the homepage and navigation lead with the template. The first impression is “another al-folio site,” and the distinctive work feels like extras rather than the point.

## Findings

### 1. The homepage is the most generic page

Name as H1, one-line subtitle, bio on the left, headshot on the right with “San Francisco, CA” under it, then News and selected papers. This is the standard al-folio composition. The memorable work appears only as one small “Bayan workbench” link and one inline LEGO link.

### 2. Navigation hides the personality

“resources” mixes tools (ditherer, outfit palette, chess), a mood piece (fireplace), a routine (kata), and a research project (LEGO). LEGO is also a project on the homepage, so it has two identities. “academic” is a dropdown with two items. A label like “resources” gives no reason to explore.

### 3. Each creative page invents its own visual language

Each page works alone; nothing ties them together.

- The fireplace drops the site chrome and has its own dark pixel-art world and header.
- Kata uses a full-bleed watercolor panel.
- Music has a maroon accent and its own tab bar; the rest of the site is brown.
- Posts sit on a rounded, shadowed card, and the LEGO figure sits in a bordered box. `DESIGN.md` asks for square, unboxed containers.
- At least four button styles: filled brown (chess “Copy link”), solid black (ditherer “Download PNG”), dashed outline (kata “Back”), and plain outline (kata “Next”).

### 4. The shared core is pleasant but anonymous

Cream canvas, warm brown accent, and Nunito Sans are calm and readable, but they match the current default “warm minimal” look. The site has no signature: no mark, no recurring shape, no layout move that belongs to it. The Sass shows the same pattern: about 12,000 lines in per-page files, with `_sass/_sheet-music.scss` and `_sass/_music-books.scss` each holding more than 40 literal colors.

### 5. Template residue still reads as template

- The writing index uses 2.5 rem titles with a calendar icon, the year, and hashtag tags.
- Posts say “Created on May 01, 2026.”
- The footer credits Jekyll, al-folio, and GitHub Pages.

### 6. The one brand joke reads as a rendering glitch

“(Coding Droids)+” renders in a grey code chip. Programmers read the regex joke; everyone else sees monospace in a box under the name.

## The unused motif

Most of the distinctive work is a grid of discrete units:

- bayan buttons (the homepage sketch);
- dither pixels;
- LEGO studs;
- the pixel-art fire.

That is a real thread: things built from small units, analog instruments drawn as pixels. Today the bayan sketch appears once, small and unexplained, and does not align with the text column below it.

## Recommendations

In rough order of payoff:

1. **Make the homepage show the work.** Keep the short bio. Replace News and papers as the main content with a small set of handmade pieces, each with a real thumbnail (a dithered still, the fire, a watercolor crop, a score). Move papers to the academic page.
2. **Adopt the dot grid as the signature.** Use it as a mark beside the name, for section dividers, loading states, the favicon, and the fallback social image. One size, one color, everywhere.
3. **Name navigation by what things are.** For example: writing, research (LEGO and papers), music, and a “workshop” for the ditherer, palette, chess, fireplace, and kata. Use one label case throughout.
4. **One accent, one surface rule.** Fold music’s maroon into the site brown, or make maroon the site accent. Choose cards or hairline rules and drop the shadowed post card. Standardize one primary and one secondary button.
5. **Frame the immersive rooms consistently.** The fireplace and kata keep their worlds but share an entry title, a small “back to site” control, and the dot mark, so they feel like rooms in one house.
6. **Remove theme residue.** Calendar and hashtag icons, “Created on,” and the template footer. Style the “(Coding Droids)+” subtitle deliberately or replace it with plain text.

The refresh plan already names the goal: “feel authored rather than inherited from a Bootstrap theme.” That work has covered the menu and color tokens. The larger gap is the homepage and the information architecture.
