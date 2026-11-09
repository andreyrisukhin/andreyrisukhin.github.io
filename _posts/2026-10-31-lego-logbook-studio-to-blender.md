---
layout: post
title: >-
  LEGO logbook: from boxes to Blender
date: 2026-10-31 12:00:00+0000
description: Real stud geometry, washed-out colors, a mirrored model, and the same two-brick test.
tags: [lego, machine-learning]
categories: [lego]
related_posts: false
published: true
series: lego
experiment_date: "2026-03-31"
experiment_label: March 31, 2026
series_summary: Studio geometry and Blender renders exposed color and coordinate bugs before the two-brick overfit test passed again.
---

My first Blender renders turned a red plate pink and mirrored the model. After fixing both bugs, the reconstruction model passed the same two-brick memorization test.

_Entry from March 31, 2026, edited retrospectively from my project logbook on October 31, 2026._

{% include figure.liquid path="assets/img/posts/2026-lego-rendering/boxes-and-studs.png" class="img-fluid rounded z-depth-1" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Blender renders of the saved red plate and blue brick, comparing per-piece bounding boxes with detailed LDraw part geometry." caption="New Blender/Cycles renders, made October 31, 2026 from the saved two-piece assembly. These use current LDraw geometry, not the original Studio mesh or archived March 31 inputs. Camera and lighting match. Saved coordinates are unchanged, including the visible part intersections." %}

## Getting the studs into the image

**Setup.** Keep the red plate and blue brick from the [first reconstruction test]({% post_url 2026-10-30-lego-logbook-first-reconstruction-pipeline %}), but render their geometry instead of their bounding boxes.

The Studio `.io` file contained both assembly information and detailed geometry. Extracting this two-piece model increased the face count from 12 to 1,372.

The detailed mesh carried different color codes from the assembly. I took shape from `model2.ldr` and colors from `model.ldr`.

The software renderer could now draw studs, but sorting faces to draw them back-to-front still left visible artifacts.

## A renderer I could run from a script

Studio’s bundled Eyesight renderer produced blank or nearly blank images despite repeated settings and camera fixes. I switched to Blender, exporting the Studio geometry as OBJ:

```text
Studio .io → extracted mesh → OBJ + materials → Blender → four views
```

## Two bugs that looked like rendering choices

**Color.** Blender interpreted the palette’s sRGB values as linear light, making the colors too bright. Red looked pink; blue looked pale. Converting the values to linear light before assigning them to the shader fixed that mismatch.

I also switched from EEVEE to Cycles and changed the lighting and plastic material. This was not a controlled comparison of the rendering engines.

{% include figure.liquid path="assets/img/posts/2026-lego-rendering/color-comparison.png" class="img-fluid rounded z-depth-1" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Actual Blender renders of the same two-piece assembly, with brighter colors when sRGB values are used as linear light and darker colors after conversion." caption="New renders reproducing the color encoding error. Only the material color conversion changes; the camera, lighting, Cycles settings, exposure, and display transform stay fixed." %}

**Coordinates.** My first axis conversion put the model upright but also reflected it. Changing one sign gave a rotation without the reflection.

{% include figure.liquid path="assets/img/posts/2026-lego-rendering/reflection-comparison.png" class="img-fluid rounded z-depth-1" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Blender renders showing how the offset between the red plate and blue brick changes when the assembly is reflected, with the camera unchanged." caption="New renders of the same assembly from the same camera. Left: the reflected mapping (x, −z, −y), determinant −1. Right: the corrected mapping (x, z, −y), determinant +1. The brick’s offset from the plate makes the reflection visible." %}

## The same test, with different inputs

**Test.** Render four Cycles views of `plate-brick.io`, then train the reconstruction model on that one assembly for 2,000 steps on CPU.

**Result.** The logbook records loss reaching zero around step 200, with brick accuracy and voxel IoU both 1.0: exact recovery of both pieces.

This showed the model could memorize the detailed renders, not reconstruct an unseen assembly or work from photographs.

Could it reconstruct an assembly it had never trained on?

---

Part of the [LEGO project](/projects/lego/). Source: project logbook entries for March 31, 2026.

Render geometry: [LDraw Parts Library](https://www.ldraw.org/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Part authors, source hashes, Blender settings, and raw-image hashes are in the [render record](/assets/img/posts/2026-lego-rendering/blender/provenance.json).

<!-- Source notes: LOGBOOK.md, March 31 rendering-pipeline and Cycles/color/mirror entries. Historical implementation checked at LEGO commit 96c4607a40d35cdeae14ac1861d82c2382895710: scripts/blender_render.py and src/data/obj_export.py. The overfit numbers are reported by the logbook and commit message; that commit does not archive a fresh set of Blender overfit metrics or input images. Do not reuse the March 29 software-rendered figures as evidence of the March 31 Cycles run. -->

<!-- Figure provenance: actual CPU-only Blender/Cycles renders made by _scripts/lego_rendering_blender.py from _scripts/fixtures/lego-rendering/two-piece.ldr, a byte-identical copy of the saved March 29 assembly. Surfaces resolve from the current LDraw Parts Library, not the unavailable original Studio mesh. _scripts/lego_blender_figures.py places raw PNG pixels side by side and adds labels without altering the renders. This reproduces failure modes, not the historical experiment or its predictions. -->
