# Design audit: the Bayan notebook

September 12, 2026. Based on the Harmony archive through September 7, public reference pages, and desktop/mobile inspection of the site and local workbench prototype.

## Thesis

The site is readable and functional, but still feels like an academic theme containing personal projects. The saved references feel authored because each has one clear visual premise.

The direction is not to imitate one of them. Build a quiet editorial site around a recurring visual language: **grids that produce behavior**. This connects bayan button layouts, musical scales and chord matrices, Bayer dithering, coding-agent loops, and the existing bayan sketch. The music section should become the clearest expression of that identity.

## What makes the references work

| Reference                                                  | Defining aesthetic                                                                                                        | Useful lesson                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Benji Taylor](https://benji.org/)                         | Extreme typographic restraint. Biography and writing carry the page.                                                      | Remove elements that do not reveal personality or help navigation.                  |
| [Justin Rands](https://jrands.com/)                        | Full-screen pastoral image, floating controls, tiny metadata, environmental sound.                                        | Create a place rather than display a document. Sound can deepen direct interaction. |
| [Tereza Tizkova](https://www.terezatizkova.com/)           | Editorial hierarchy with personality in the words, small jokes, location, feedback prompts.                               | Personality does not require visual chaos.                                          |
| [Ben Dicken](https://benjdd.com/)                          | Warm, narrow, content-first column. Minimal navigation and strong article descriptions.                                   | Expose the actual work immediately.                                                 |
| [Pei Zheng](https://peizheng224.github.io/peizheng-guqin/) | Instrument-specific atmosphere: bilingual type, warm colors, performance footage, cultural context, spacious composition. | Let visitors see and hear the instrument, not only read utilities about it.         |
| [Shed](https://shedsgns.me/27)                             | Personal essay with handwritten accents, narrow measure, marginal controls, candid language.                              | Structure and voice should reinforce each other.                                    |
| [Keerthi](https://kiira.in/)                               | Image-led editorial portfolio, dramatic serif typography, animation, botanical imagery, large shifts in scale.            | Establish rhythm with a few large artifacts, not a uniform wall of cards.           |
| [Anirudh Pareek](https://www.anirudh.info/)                | Dappled light, paper-like grid, hand-drawn portrait, vintage television, personal illustrations.                          | One custom illustration has more identity than a dozen stock icons.                 |
| [Tom](https://tomm.page/)                                  | Almost empty screen with one carefully typeset introduction.                                                              | Confidence can look like aggressive omission.                                       |
| [Phil Schmid](https://www.philschmid.de/testing-skills)    | Plain article frame, strong name mark, clear reading hierarchy.                                                           | The academic/editorial core can remain simple while looking intentional.            |

### Linked discussions

> “A personal website should feel like you’ve briefly left the rest of the internet.”

Benji Taylor, [X post](https://x.com/benjitaylor/status/2096656821591413161). Saved by `lordthunderpork` in `#ideas-for-projects`, message `1546301443018072134`, September 6, 2026 at 23:29 UTC.

> “The sites I love to showcase … bring in elements that show off someone’s personality. The perfect blend of all the life they have lived.”

Kelindi, [X reply](https://x.com/_kelindi_/status/2096664584018899105). Saved by the same author in the same channel, reply message `1546304195907551344`, September 6, 2026 at 23:40 UTC.

> “Make this more obviously true. UI buttons from homepage?”

Andrey’s follow-up, message `1546363122116329472`, September 7, 2026 at 03:34 UTC, same author and channel. [Original post](https://x.com/andreyrisuka/status/2096803988171788339).

Other useful saved process references:

- [Emil Kowalski](https://x.com/emilkowalski/status/2061426518333571576): describe motion precisely, including stagger, direction, spatial consistency, crossfade, and layout animation.
- [Fiona Fang](https://x.com/fiof_25/status/2077566947470745875): visualize the animation path and tune its timing rather than accepting a first generated curve.
- [Jacky](https://x.com/_jzhao/status/2061143603246952820): procedural dappled light and dithering as personal-site experiments.

Public indexing exposed only part of the X reply and quote-post graph. Accessible discussions and linked portfolios were followed; this is not a complete inventory of every quote post.

## Current site assessment

### What works

- Concrete, credible content and readable prose.
- The distinctive homepage bayan button sketch.
- Unusually substantive music tools.
- The conceptual separation between tools and references.
- The workbench prototype: one entry point interpreting chords, notes, progressions, recipes, and notation.

### What weakens the identity

1. **The frame advertises al-folio.** The navbar, typography, magenta accent, cards, social row, and footer read as a customized academic theme. The bayan sketch is a separator instead of an organizing idea.
2. **Music is hidden as a resource.** It deserves a direct navigation link and an obvious homepage entry, preferably both.
3. **Duplicated positioning copy.** The title, SEO-style description, and second byline repeat the same names and subject matter. Use a human promise: “Explore a chord as notes, buttons, notation, and sound.” Keep aliases in metadata or a quiet attribution.
4. **Equal cards erase priority.** Build a Set List, Stradella Recipes, Chord Recognizer, Songs, and Workbench overlap. They receive the same weight as a single arrangement. The mobile page becomes a long stack with no early demonstration.
5. **Generic utility UI.** Font Awesome icons, magenta borders, rounded cards, and hover elevation communicate “web application,” not bayan or music practice. Replace them with actual button fragments, notation, chord paths, and drawings.
6. **The fixed footer obscures content.** It crossed the circle of fifths and mobile cards in captures. Correct this before adding polish.

## Recommended direction: the Bayan notebook

Keep the editorial calm. Derive the music section’s tactile identity from an accordionist’s notebook or practice desk.

### Visual system

- Warm paper canvas, near-black ink.
- One restrained lacquer red, oxblood, or deep plum accent, not saturated theme magenta.
- A warm serif for selected personal or musical headings; a clean sans for the interface.
- Monospaced recipes and music notation where structurally useful.
- Button circles, staff lines, grids, ruled margins, compact annotations.
- One original drawing of Andrey with the bayan, plus occasional photographs or recordings when available.

Borrow Pei Zheng’s instrument specificity, Anirudh’s personal illustration, Ben Dicken’s restraint, and Justin Rands’s sensory quality without copying their surface treatments.

## Music information architecture

### Make the workbench the page

Do not introduce Workbench as a twelfth destination. Make it the primary experience at `/music/`.

```text
Bayan workbench
Explore a chord as notes, buttons, notation, and sound.

[ C E G · Am7 · 2 5 1 in G                          ]

Explore a chord       Practice a progression       Play the keyboard

[ live result ]

Practice notebook
Reno di Bono turnaround · Cogwork Dancers · recordings when available

Field notes
Stradella recipes · Scales and intervals · All references
```

Keep old routes as durable deep links. Stop asking visitors to choose between overlapping implementations.

### Organize around intentions

1. Explore a chord or collection of notes.
2. Practice a progression or exercise.
3. Play the bayan keyboard.
4. Read theory and Stradella notes.

Songs, setlists, chord matrices, and sheet drafts are features within these activities, not top-level destinations.

## Workbench critique

The transformation from `2 5 1 in G` to chords, a circle-of-fifths path, notation, and Stradella recipes is the site’s strongest material.

### Initial state

- Show a small working example, not a mostly empty screen.
- Render a bayan-button field beside the input or result.
- Expose three starting actions, not every feature.
- Put advanced tools behind “More ways to explore.”
- Do not advertise URL ingestion until it works.

### Result hierarchy

- Chord name and audio action first.
- Bayan/Stradella fingering next.
- Notes and staff together.
- Intervals and semitones inside expandable theory details.
- Alternate analyses quietly below.

Do not give the full chord matrix, notation, circle, setlist controls, and alternate analyses equal emphasis.

### Connect representations

- Hover or focus a note to highlight its bayan button and interval.
- Press a bayan button to hear its corresponding note.
- Change key without losing the selected chord or spatial orientation.
- Play a progression and advance the path and chord controls in time.
- Keep motion meaningful, restrained, and removable with reduced motion.

The goal is a coherent instrument model, not a collection of calculators.

### Sound

- Never autoplay.
- Sound follows an intentional button or key press.
- Provide a visible mute state.
- Prefer bayan or reed-like samples where available; identify fallbacks honestly.
- Use physical labels: Hear chord, Play progression, Roll upward.

Sound should make the tool understandable, not merely make the portfolio atmospheric.

### Mobile

- Keep input near the top and results easy to reach.
- Scroll twelve key choices horizontally instead of wrapping them into uneven rows.
- Collapse secondary theory.
- Use the available width for the circle.
- Make saved material an expandable drawer.
- Remove the fixed footer.
- Keep play targets at least 44px.

## Homepage

### Give the existing button sketch a job

Make it an obvious entry point rather than a static separator. A later shared-grid interaction could transform circles into bayan buttons, a Bayer matrix, or an agent-feedback graph. Essential navigation must remain visible and stable.

### Hierarchy

1. One-sentence professional introduction.
2. Signature grid with direct paths to Music, Dither, and selected work.
3. Two or three selected pieces with visible artifacts.
4. A short current-status/news section.
5. Publications, quieter and lower.
6. Contact.

Music should be a direct navigation item. “Resources” is too generic for a defining body of work. Do not reorganize the entire academic site merely to ship the music redesign.

## What not to copy

- Keerthi’s botanical treatment.
- Dappled light without a personal reason.
- Ambient audio across the site.
- A combination of handwriting, glass pills, procedural light, huge serif text, and floating illustrations.
- Generic bento grids or animation on every card.
- Experimental navigation that evades the pointer or requires hover.

Build one authored system, not a collage of references.

## Rollout

### P0: Correctness

Remove the fixed footer; check 390px and 1440px layouts; verify contrast, focus, touch targets, and reduced motion.

### P1: Product hierarchy

Make the workbench primary; organize around four intentions; remove redundant copy; expose Music directly in navigation and on the homepage.

### P2: Visual identity

Define paper, ink, muted text, border, and lacquer tokens; use functional diagrams instead of stock icons; connect the existing bayan/dither motif. Add original personal artwork when available.

### P3: Interaction

Link notation, bayan buttons, recipes, and playback; retain context during transposition; start sound only on request; simplify mobile hierarchy.

### P4: Human material

Feature real exercises and arrangements. Add recordings and “currently practicing” only from actual supplied material, never invented activity.

## Acceptance test

A new visitor should understand within ten seconds:

- Andrey builds coding systems and plays bayan.
- The site contains an interactive bayan/music environment.
- Typing a chord produces something visible or audible.
- This music experience could not plausibly belong to another academic portfolio.

## Audit validation

No source changes were made during the audit. The existing Jekyll build passed with Sass/Rails deprecation warnings. The homepage, public and local music pages, and local workbench were captured at desktop and mobile sizes. Playback quality was not audited by listening. The working tree already contained an uncommitted workbench, scale reference, and site-refresh plan.
