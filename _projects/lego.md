---
layout: page
title: LEGO
permalink: /projects/lego/
description: ""
importance: 1
category: fun
published: true
img: assets/img/projects/lego/lego-menger.webp
breadcrumbs: false
---

<!-- Add a short introduction and a concrete example or visual here. -->

## Anyone Can Build (Masterfully)

I want to let anyone be a Lego Master Builder. For example, anybody should be enabled to:

- Take reference views of the Toppat Clan airship, and create a 42-stud-long digital LEGO airship and parts list.
- Find all part 2780 pins in a 78-piece pile image and label the five matches.
- Reconstruct a digital LEGO tank from video frames and adapt its style to a custom faction.

{% include figure.liquid path="assets/img/projects/lego/project-examples.svg" class="img-fluid" figure_class="figure-spaced" avoid_scaling=true zoomable=true alt="Target LEGO tasks: generate a 42-stud airship and parts list from reference views; label matching pins in a pile; reconstruct a tank from video frames and adapt it for GIA use." caption="I did this! As a kid! A model can, too." %}

{% capture lego_logbook %}{% include project-series.liquid series="lego" mode="logbook" %}{% endcapture %}
{{ lego_logbook | strip }}

## Let Kids Play

I spent 23 years training to be a master builder. Each example above is something I did myself. Yet even today, organic shapes are hard for me to build.

Wouldn't it be wonderful to give people a tool that helps them master Lego building? In addition to finding communities online, growing their collection large enough to experiment, and making the time to learn by trial and error?

## Save Me Time & Build In Public

A system that saves me time sorting pieces out after building is the highest leverage improvement to my quality of life. After that I'll reuse the system to achieve the other goals (`img->Lego, ...`), which helps me create the Lego animation studio my brother and I dreamed about running as kids.

We want to help people become Lego Master Builders. Posting publicly about my work does two things to accelerate reaching that goal:

- If someone else tries to build this, failed experiment logs save them time.
- If someone really cares, they might donate a gpu to speed up my experiments :)

_(seriously, email me or tag me on twitter)_

Also I want to try visualizing experiments as version control trees! Branches that spread, eventually the best ones merging into the main baseline.

## Approach

I'm a scientist, I like science - Richard Sutton's bitter lesson suggests scaling compute and data outperform human hand-crafted heuristics. But Lego is a discrete _and_ continuous verifiable orientation problem. I'll start with recognition and move to the harder problems after that.

{% include figure.liquid path="assets/img/projects/lego/lego-menger.webp" class="img-fluid d-block mx-auto" figure_class="figure-spaced" width="450" avoid_scaling=true zoomable=true alt="A blue and yellow LEGO Menger sponge with nested square openings." %}
