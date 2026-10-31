---
layout: post
title: My LEGO recognizer failed on a white background
date: 2026-10-30 12:00:00+0000
description: A clean-render score hid a failure that targeted augmentation only partly fixed.
tags: [lego, machine-learning]
categories: [lego]
related_posts: false
published: false
---

My LEGO part recognizer scored 95% on clean renders and 2% after a white-background transformation. Training against that failure improved the score, but did not establish recognition outside the renderer.

_Experiments conducted April 14, 2026. Written retrospectively from my project logbook on October 30, 2026._

{% include figure.liquid path="assets/img/posts/lego-background/background-transform.svg" class="img-fluid" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Current red and gray 2-by-4 brick renders before and after the white-background transform. The gray brick loses much of its top surface as well as its background." caption="Recreated on current renders using the evaluation function, not archived predictions. The gray brick shows that threshold-based replacement can change the part itself." %}

<!-- TODO before publication: add an archived clean/transformed query pair with its actual predictions and checkpoint IDs. Do not present a newly reconstructed illustration as an April 14 prediction. -->

## A smaller problem than a pile

I want to find particular pieces in a pile of LEGO. Here I tested a smaller problem: given an isolated part image, retrieve its part number.

An encoder turns the image into a vector; the nearest catalog vector gives the predicted part number. Top-1 accuracy measures how often that prediction is correct.

## Change the image, keep the part number

I transformed rendered views and queried the catalog again, keeping the expected part numbers unchanged.

The background replacement estimated brightness from the image corners, then replaced pixels with similar grayscale values. It could also erase pixels on the part, as the gray brick above shows. The test exposed sensitivity to that transformation, not to background alone.

## Train against the failure

I compared three augmentation configurations with the unaugmented baseline:

- **v3:** randomize the background with probability 0.7.
- **v4:** randomize it with probability 1.0.
- **v5:** add explicit white-background and edge-overlay transformations to the augmentation recipe.

The April 14 logbook records these top-1 accuracies:

| Test image            | Baseline (v2) | v3  | v4  | v5  |
| --------------------- | ------------- | --- | --- | --- |
| Clean render          | 95%           | 92% | 86% | 92% |
| White background      | 2%            | 47% | 49% | 61% |
| Light-blue background | 1%            | 48% | 49% | 59% |
| Edge overlay          | 8%            | 46% | 43% | 87% |

<!-- TODO before publication: recover the run outputs, evaluated sample count, and checkpoint/catalog pairing for this table. The logbook calls the unaugmented column v2; an earlier entry describes a v1 baseline with similar rounded scores. Keep those runs distinct. -->

Always changing the background was not better: v4 lost six points of clean-render accuracy for a two-point gain on white backgrounds.

The targeted v5 recipe kept v3’s 92% clean accuracy while improving white-background accuracy from 47% to 61% and edge-overlay accuracy from 46% to 87%.

{% include figure.liquid path="assets/img/posts/lego-background/augmentation-results.svg" class="img-fluid" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Baseline v2 versus targeted v5 top-1 accuracy: clean renders 95 versus 92 percent; white background 2 versus 61; light-blue background 1 versus 59; edge overlay 8 versus 87." caption="Baseline v2 and targeted recipe v5, replotted from the April 14 logbook. These are transformed-render tests, not real-photo results." %}

But I had trained against transformations resembling the tests. Those gains were not independent evidence of general recognition.

## The test outside the renderer

On real LEGO instruction thumbnails, the recorded similarity barely changed:

| Model | Recorded real-thumbnail similarity |
| ----- | ---------------------------------- |
| v3    | 0.812 ± 0.070                      |
| v5    | 0.811 ± 0.076                      |

<!-- TODO before publication: recover the similarity metric definition and what the reported ± values represent. Do not call them confidence intervals or standard deviations without the run artifact. -->

This was similarity, not accuracy. Cropping also complicated the comparison: the code guessed boxes near OCR-detected quantity labels rather than detecting pieces. A crop could cut off a piece or include its neighbor.

<!-- Future post: manual crop review and correction tools. Keep that timeline separate from these April 14 encoder experiments. The initial crop commit already flagged segmentation quality; the exact moment of diagnosis is not established. -->

Neither test established recognition in photographs of a real pile.

The next result I needed was a correctly identified piece outside the renderer, not a higher score on another transformation of its output.

---

Part of the [LEGO project](/projects/lego/). Source: project logbook entries and evaluation code from the April 14 experiments.
