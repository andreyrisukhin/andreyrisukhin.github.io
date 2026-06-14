---
layout: post
title: Clocking In to the Factory
date: 2026-05-01 12:00:00-0400
description: A year at Perceptron, then south to Factory.
# description: Moving to the San Francisco AI Factory, Inc.
# description: Leaving Perceptron AI for Factory; lessons from a year of multimodal data.
# description: From Bellevue to San Francisco, from video data to coding agents.
# description: What a year of multimodal data taught me, and why I'm joining Factory.
# description: A year at Perceptron AI, and the move to Factory.
tags:
categories: [reflections]
related_posts: false
published: true
---

I'm starting a new chapter: This weekend I left Bellevue and Perceptron, and arrived in SF for Factory.

{% include figure.liquid path="assets/img/posts/2026-perceptron/goldengate.jpg" class="img-fluid rounded z-depth-1" caption="Evening after Day One at Factory." %}

## Perceptron

After less than 24 hours spanning an initial call, a three-round onsite, and an internship offer, I joined Perceptron AI last spring to work on multimodal data. After a month with the team, I knew I had to defer the PhD. I stayed a year to see how far we could take multimodal modeling with video data as a first-class citizen.

Perceptron was the best year of my career so far. I designed production systems for terabyte-scale video data, made friends I’ll keep for life, and got to do it all close to home in Bellevue, WA.

{% include figure.liquid path="assets/img/posts/2026-perceptron/navdesk.jpg" class="img-fluid rounded z-depth-1" caption="Halloween: “Are you Steve Jobs or Elizabeth Holmes?”" %}

## Reflections

Our work fell into a simple pipeline: take raw data, format it to our schema, augment it with annotations, and decide whether it belonged in evals or training. Across the year I built up each stage:

1. Hand-written processors on Day 1 became Claude-written, then proactively Claude-initiated.
2. Built a modular pipeline with work distribution, reproducibility, versioning, and heavy/light data sharding.
3. Added human and synthetic annotation tools, plus producer-consumer systems balancing cheap and expensive compute.
4. Wrote diagnostic evals for video capabilities (physics tracking).
5. Automated the loop from experiment results to the next training run.

Along the way, I built other CLI tools: a Slack bot for Slurm job status, plus inspection and render tooling for our datasets.

Working with [Naveen](https://www.linkedin.com/in/naveensahi/) and Akshat taught me a few valuable lessons:

- **Prioritize empirical feedback.** Just run it; the bottlenecks show themselves.
- **Get faster feedback.** A dataloading bug doesn’t need a full training run to debug. Cutting iteration time from hours to seconds is the most leveraged thing you can do.
- **Overcommunicate.** Getting faster feedback from humans starts with task visibility (Slack/Linear/logbooks).

{% include figure.liquid path="assets/img/posts/2026-perceptron/newofficenight.jpg" class="img-fluid rounded z-depth-1" caption="The new office, after hours." %}

## Factory

I drove from Bellevue to SF this weekend to join [Factory](https://factory.ai/).

Factory accelerates each lesson. Code is empirically evaluated; The coding feedback loop is faster than the video feedback loop; And overcommunication matters for synchronization between humans and now Droids. The feedback loop also now improves itself, rather than staying constant and improving an accessory to the loop.

Month over month since January I’ve increasingly reached for code over spreadsheets and APIs over documents. Model capabilities appear across labs within months; the lasting moat is the interface, not the weights. I’m saying “until next time” to the PhD, because I’ll be working on implicit feedback at Factory and that’s been my primary research interest for several years.

Perceptron has been amazing. Thanks to everyone there, especially:

- Maciej, for teaching me to bench and to love Claude.
- Jeremy, for inviting me to play music in public again.
- Akshat, for raising my bar on what a research scientist looks like.
- Naveen, for being the kind of manager I want to be.

<div class="figure-pair">
{% include figure.liquid path="assets/img/posts/2026-perceptron/akshatprehug.jpg" class="img-fluid rounded z-depth-1" %}
{% include figure.liquid path="assets/img/posts/2026-perceptron/akshathug.jpg" class="img-fluid rounded z-depth-1" caption="Saying goodbye." %}
</div>

---

<small>_Photos of the office desk and the goodbye hugs by [Cedric Ith](https://www.cedricith.com/)._</small>
