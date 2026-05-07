---
layout: post
title: A Year at Perceptron
date: 2026-05-01 12:00:00-0400
description: What I built, what I learned, and the people I'll miss.
# description (prior): A year at Perceptron, then south to Factory.
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

This weekend I left Bellevue and Perceptron AI after a year. The move to Factory gets its own post; this one is for Perceptron.

After less than 24 hours spanning an initial call, a three-round onsite, and an internship offer, I joined Perceptron AI last spring to work on multimodal data. After a month with the team, I knew I had to stay for a year and see how far we could take multimodal modeling with video data as a first-class citizen.

Perceptron was the best year of my career so far. I designed production systems for terabyte-scale video data, made friends I'll keep, and got to do it all close to home in Bellevue, WA.

{% include figure.liquid path="assets/img/posts/2026-perceptron/navdesk.jpg" class="img-fluid rounded z-depth-1" caption="Halloween at Naveen's desk: \"Are you Steve Jobs or Elizabeth Holmes?\"" %}

## What the year taught me

Naveen and Akshat taught me three things.

**Prioritize empirical feedback.** Just run it; the bottlenecks show themselves.
<!-- TODO: anchor with one specific scene where running it beat thinking it through. e.g. the time I spent N hours mapping out a bottleneck on paper, then Naveen ran the actual job and the real bottleneck was somewhere else. -->

**Get faster feedback.** A dataloading bug doesn't need a full training run to debug. Cutting iteration time from hours to seconds is the most leveraged thing you can do.
<!-- TODO: anchor with one specific bug or one specific tool that compressed the loop. -->

**Overcommunicate.** Faster feedback from humans starts with task visibility — Slack, Linear, logbooks. Pick a format and stick to it.
<!-- TODO: anchor with one specific moment when overcommunicating saved you (or undercommunicating cost you). -->

## What I built

Our work fell into a simple pipeline: take raw data, format it to our schema, augment it with annotations, and decide whether it belonged in evals or training. Across the year I built up each stage:

1. Hand-written processors on Day 1 became Claude-written, then proactively Claude-initiated. <!-- TODO: confirm "Claude-initiated" captures the actual progression; original said "proactive" -->
2. Built a modular pipeline with work distribution, reproducibility, versioning, and heavy/light data sharding.
3. Added human and synthetic annotation tools, plus producer-consumer systems balancing cheap and expensive compute.
4. Wrote diagnostic evals for video capabilities (physics tracking).
5. Automated the loop from experiment results to the next training run.

Along the way I built other CLI tools — a Slack bot for Slurm job status, plus inspection and render tooling for our datasets.

{% include figure.liquid path="assets/img/posts/2026-perceptron/newofficenight.jpg" class="img-fluid rounded z-depth-1" caption="The new office, after hours." %}

## Thanks

Thanks to everyone at Perceptron, especially:

* Maciej, for teaching me to bench and to love Claude.
* Jeremy, for inviting me to play music in public again.
* Akshat, for raising my bar on what a research scientist looks like.
* [Naveen](https://www.linkedin.com/in/naveensahi/), for being the kind of manager I want to be.

<div class="figure-pair">
{% include figure.liquid path="assets/img/posts/2026-perceptron/akshatprehug.jpg" class="img-fluid rounded z-depth-1" %}
{% include figure.liquid path="assets/img/posts/2026-perceptron/akshathug.jpg" class="img-fluid rounded z-depth-1" caption="Saying goodbye to Akshat." %}
</div>

---

<small>*Photos of the office desk and the goodbye hugs by [Cedric Ith](https://www.cedricith.com/).*</small>
