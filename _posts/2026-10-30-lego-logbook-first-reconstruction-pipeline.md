---
layout: post
title: >-
  LEGO logbook: the first reconstruction pipeline
date: 2026-10-30 12:00:00+0000
description: March 28–29, 2026. An end-to-end pipeline, a start-token bug, and invalid training assemblies.
tags: [lego, machine-learning]
categories: [lego]
related_posts: false
published: true
series: lego
experiment_date: "2026-03-28"
experiment_label: March 28–29, 2026
series_summary: An end-to-end pipeline, a start-token bug, and invalid LDraw assemblies.
---

I started with reconstruction: take a few photos of a LEGO model and recover its parts, colors, positions, and orientations.

_Entries from March 28–29, 2026, edited retrospectively from my project logbook on October 30, 2026._

## 2026-03-28: First end-to-end pipeline

**Setup.** Generate random assemblies, render four views, and train a model to predict the bricks one at a time. Procedural generation gives me the brick list for every image without labeling photos by hand.

- Data: 12 common brick and plate types, 33 colors, four rotations around the vertical axis.
- Images: a PIL software renderer, with four roughly evenly spaced viewpoints.
- Model: a ResNet-18 image encoder and a six-layer transformer decoder. Each decoder step predicts one brick’s part ID, position, rotation, and color.

**Results.** Training ran on CPU. Loss fell from 24.8 to 24.4 over two epochs on 32 samples. Inference exported LDraw files that viewers could parse.

That verified the pipeline ran, not that it reconstructed the inputs correctly.

**Next check.** Overfit one assembly. If the model cannot memorize one example, more training data will not fix it.

## 2026-03-29: Start and stop were the same token

**Failure.** Training loss could reach zero, but generation returned no bricks. The decoder started from an all-zero token, identical to its end-of-sequence token.

**Fix.** Give the decoder distinct `<bos>` and `<eos>` tokens for the beginning and end of a sequence.

**Test.** I used a two-piece model made in BrickLink Studio: a red 2×3 plate with a blue 1×3 brick on top.

{% include figure.liquid path="assets/img/posts/lego-first-pipeline/two-piece-input-views.png" class="img-fluid" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Four software-rendered views of the red plate and blue brick used in the two-piece test." caption="The test’s saved input views, not photographs." %}

From training step 100 onward, generation matched both pieces’ part IDs, colors, and positions exactly. Recorded brick accuracy and voxel IoU were both 1.0.

{% include figure.liquid path="assets/img/posts/lego-first-pipeline/two-piece-comparison.png" class="img-fluid" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Saved side-by-side plots of the two-piece ground truth and matching predicted assembly." caption="Saved comparison after 500 training steps on the same example. The plots use box approximations, not full brick geometry." %}

This was memorization of one example, not a generalization result.

**Data problem.** Opening the procedural assemblies in Studio exposed illegal intersections. The generator checked collisions at stud level, not across the full brick volumes.

{% include figure.liquid path="assets/img/posts/lego-first-pipeline/procedural-input-views.png" class="img-fluid" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Four saved software-rendered views of a nine-piece procedural assembly." caption="A saved nine-piece procedural example. Its LDraw file places two 1×1 plates at exactly the same position." %}

**Decision.** Use existing LDraw models from the community’s Official Model Repository, or models made in Studio, instead of building a separate construction validator.

---

Part of the [LEGO project](/projects/lego/). Source: project logbook entries for March 28–29, 2026.

<!-- Source notes: LOGBOOK.md, March 28 initial pipeline and March 29 BOS/EOS fix, Studio overfit test, and procedural-data decision. These are historical checks, not current performance claims. -->

<!-- Image provenance: byte-identical copies from commit 35e2284 (March 29, 2026). Sources: artifacts/overfit_real/input_views.png, artifacts/overfit_real/comparison.png, and artifacts/overfit/input_views.png. The comparison step count is recorded in artifacts/overfit_real/metrics.json. The duplicate plate positions are recorded in artifacts/overfit/gt.ldr. -->
