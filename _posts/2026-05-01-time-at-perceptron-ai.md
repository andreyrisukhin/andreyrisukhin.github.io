---
layout: post
title: Clocking In to the Factory
date: 2026-05-01 12:00:00-0400
description: Moving to the San Francisco AI Factory, Inc.
tags:
categories: [reflections]
related_posts: false
published: true
---

{% include figure.liquid path="assets/img/posts/2026-perceptron/goldengate.jpg" class="img-fluid rounded z-depth-1" %}

After less than 24 hours spanning an initial call, a three-round onsite, and an internship offer, I joined Perceptron AI last spring to work on multimodal data. After a month with the team, I knew I had to stay for a year and see how far we could take multimodal modeling with video data as a first-class citizen. 

Perceptron was my best experience to date. I made lifelong friends on the team, built and scaled production systems to terabyte-scale data, and got to do it all in beautiful Bellevue, WA.

{% include figure.liquid path="assets/img/posts/2026-perceptron/navdesk.jpg" class="img-fluid rounded z-depth-1" %}

Our work fell into a simple pipeline: take raw data, format it to our schema, augment it with annotations, and decide whether it belonged in evals or training. Across the year I built up each stage:

1. Hand-written processors on Day 1 became claude-written and proactive.
2. A modular pipeline with work distribution, reproducibility, built-in versioning, and heavy/light shard segmentation.
3. Human and synthetic annotation tools, plus producer-consumer systems balancing cheap and expensive compute.
4. Diagnostic evals for video capabilities (physics tracking).
5. An automated loop between experiment results and the next launch.

Built a few other tools — a Slack bot for Slurm job status, plus inspection and render tooling for our datasets.

Working with [Naveen](https://www.linkedin.com/in/naveensahi/) and Akshat taught me a few valuable lessons:
* **Prioritize empirical feedback.** Just test it, see where the bottlenecks and issues are rather than trying to anticipate them all.
* **Get faster feedback.** A dataloading bug doesn't need a full training run to debug, reduces iteration time from hours to seconds.
* **Overcommunicate.** Getting faster feedback from humans starts with task visibility (Slack/Linear/logbooks).

{% include figure.liquid path="assets/img/posts/2026-perceptron/newofficenight.jpg" class="img-fluid rounded z-depth-1" %}


I'm driving from Bellevue to SF tomorrow morning to join [Factory AI](https://factory.ai/), the model-agnostic coding interface.

Factory supercharges each lesson, both because code completes a feedback cycle faster than video (copy, train, evaluate over TB-scale data is expensive) and because each step through the cycle improves the cycle directly (coding), rather than an ancillary artifact (video) with the cycle mechanism (coding) staying constant. 

Every month since January I've increasingly reached for code over spreadsheets and APIs over documents. That trend, plus my view of model capabilities as commodities, is why I'm excited to jump in. I'm saying "until next time" to the PhD, because I'll be working on implicit feedback at Factory and that's been my primary research interest for several years. 

Perceptron has been amazing. Thanks to everyone there, especially:

* Maciej, for teaching me to bench and to love Claude.
* Jeremy, for inviting me to play music in public again.
* Akshat, for raising my bar on what a research scientist looks like.
* Naveen, for being the kind of manager I want to be.

{% include figure.liquid path="assets/img/posts/2026-perceptron/akshatprehug.jpg" class="img-fluid rounded z-depth-1" %}

{% include figure.liquid path="assets/img/posts/2026-perceptron/akshathug.jpg" class="img-fluid rounded z-depth-1" %}

---

<small>*Photos of the office desk and the goodbye hugs by [Cedric Ith](https://www.cedricith.com/).*</small>
