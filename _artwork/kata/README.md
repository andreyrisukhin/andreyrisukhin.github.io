# Kata watercolor artwork

Created September 18, 2026, during the paper-and-ink kata design session.
This directory records the process; Jekyll does not publish it.

## Origin

The starting brief was blank paper gradually filling with ink and watercolor
during interaction, limited to creative pages. For kata, the requested setting
was floating steps, slowly fading fog, shattered plains and chasms below,
a distant campfire, and stars above.

Both images were generated using the session’s `GenerateImage` tool. No stock
image or external reference image was supplied. The night image was generated
from text. The dawn image was an edit using the generated night image as its
reference. There was one generation call for each, with no additional image-model
iterations.

The tool did not report the underlying image model, version, or seed. These
prompts document the process, not a guarantee of identical regenerated pixels.
“Watercolor” and “hand-painted” describe the requested appearance, not a physical
painting process.

## Exact night prompt

> Create a landscape watercolor and ink illustration for the decorative background of a calm breathing practice webpage. Aspect ratio 3:2, landscape. No text, letters, borders, UI, people, or labels. A contemplative starry night over a vast shattered plateau landscape, huge flat-topped slate mesas separated by deep dark chasms, seen from above the near edge looking out toward the horizon. Several layers of angular broken stone plains diminishing into blue-gray fog. Ground occupies the bottom 45% of image with deepest crevices toward bottom corners. Small single distant amber campfire on a plateau around 72% horizontal, 66% vertical, a tiny warm light rather than a large fire. Upper half spacious midnight-indigo sky with a scatter of tiny warm-white stars, more stars toward upper corners. Thin crescent moon high right, very small. Wide soft fog banks drift across middle. Keep the central middle 60% quiet, subdued, and low contrast, suitable for readable text over it. Watercolor on cold-pressed paper: granulating indigo, Payne’s grey and muted slate teal pigments, wet-on-wet blooms, lost and found edges, expressive ink delineation of fractured rock, visible paper grain. Very restrained palette, restful and spacious, no bright saturation, no glossy digital gradients, no photorealism, no 3D render. Dark navy paper color #1c2631 at outer edges, a soft luminous cool grey-blue mist at horizon. Elegant hand-painted fantasy travel sketch, atmospheric, tactile, understated.

The submitted prompt used a straight apostrophe in `Payne's`; the quotation
above follows the repository’s prose typography.

## Exact dawn edit prompt

Input: the generated night PNG, passed through `input_image_paths`.

> Edit this watercolor landscape into a very pale dawn painting on warm ivory cold-pressed paper (#faf7f0). Keep the same composition and fractured plateaus and chasms, but turn night into first light: no stars, no crescent moon, no campfire. Use diluted sage green, muted blue-grey ink, and the faintest peach-gold tint near the horizon. The land is barely emerging from white morning fog, with generous blank paper in the upper half. Make the overall image 80% light paper and only 20% delicate ink and pigment. Soften all outer edges into blank ivory paper. Preserve the hand-painted granulation, stone cracks, and wet-on-wet watercolor character. Low contrast, calm, understated, landscape illustration, no text or UI.

## Saved files

Both PNG outputs are 1536 × 1024 pixels. Lossless masters are archived locally:

- `/home/risuka/data/website-art/kata/shattered-plains-night.png`
- `/home/risuka/data/website-art/kata/shattered-plains-dawn.png`

Master SHA-256:

```text
night dc62ea4eeca6e3ce0b785ad995a5d69df744a1d270e0b463167cd067ea729c18
dawn  232ae6fd080f5f569db28384c2b70b755b0bd506b4435f31e8c6ef354ec16fa4
```

The full-resolution web versions are committed in `assets/img/kata/`:

| Asset                    |      PNG master |          WebP |
| ------------------------ | --------------: | ------------: |
| `shattered-plains-night` | 3,209,620 bytes | 336,176 bytes |
| `shattered-plains-dawn`  | 2,128,574 bytes |  88,548 bytes |

Conversion used Pillow, RGB mode, WebP quality 86, method 6. No resizing or
retouching was applied:

```python
from pathlib import Path
from PIL import Image

masters = Path("/home/risuka/data/website-art/kata")
assets = Path("/home/risuka/repos/andreyrisukhin.github.io/assets/img/kata")
for scene in ("night", "dawn"):
    name = f"shattered-plains-{scene}"
    Image.open(masters / f"{name}.png").convert("RGB").save(
        assets / f"{name}.webp", "WEBP", quality=86, method=6
    )
```

## Website integration

An initial procedural SVG landscape was replaced with these paintings after
browser inspection. The final implementation uses static images, not generated
video, a canvas simulation, or a runtime image service.

- `_includes/kata-scene.liquid` layers the dawn and night backgrounds.
- `_sass/_kata.scss` adds the dissolving edges, fog layers, readable ink beneath
  the text, and a five-pixel vertical step drift over 14 seconds.
- Fog layers move and change opacity over 32- and 43-second cycles.
- `assets/js/kata.js` selects the form and develops the painting as steps open.
  The scene opacity rises from 0.1 to at most 0.75, with a seven-second transition.
- Steps use native `details` disclosures. Hover or keyboard focus pauses a step.
  The motion control pauses the scene; reduced-motion preferences disable motion.
- The shared creative-page wash uses CSS gradients. It is separate from the
  generated paintings and loads only for music, ditherer, and kata.
- Original kata instructions remain in `_data/kata.yml`.

No image generation happens when someone visits the website.

## Validation

The implementation was checked with a production Jekyll build, focused Node
tests, formatting checks, and isolated browser sessions at desktop, 390-pixel,
and 320-pixel widths. Tests covered form selection, native disclosures, keyboard
input, text visibility, layout overlap, pause/resume, reduced motion, light/dark
themes, music integration, and exclusion from non-creative pages.

The scoped axe audit found no violations. It could not automatically determine
contrast behind the decorative pseudo-elements, so the rendered light and dark
pages were also inspected visually.
