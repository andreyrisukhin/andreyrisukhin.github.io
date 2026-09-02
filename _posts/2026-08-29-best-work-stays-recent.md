---
layout: post
title: Trying to Measure My Best Work
date: 2026-08-29 12:00:00-0700
description: Intermediate thoughts on a six-week challenge, a weekly automation, and the missing context needed to measure judgment.
tags:
categories: [reflections]
related_posts: false
published: true
---

Every Monday, our CTO at Factory challenges Engineering, Product, and Design to answer one question:

> Are the last six weeks the best work you've ever done in your life? I suspect for many people it is not. If not, why not? What can you change to make the next six weeks the best work of your entire life?

Eno started asking this in the final weeks of last quarter, and we are approaching the first six-week mark. I believe these have been the best six weeks of work in my life, yet it is less clear how to evaluate that belief beyond anecdotes. I expected my record of shipped work to help. The first substantive run measured execution and feedback, but it could not tell whether I prioritized the right work.

As producing work gets cheaper, choosing what deserves work matters more. A reflection system that sees only finished artifacts can reward activity, luck, and hindsight rather than judgment.

## What the first run missed

I built a weekly [Factory Automation](https://docs.factory.ai/software-factory/automations) to examine six weeks of work. Rather than calculate a productivity score, it nominates the strongest work, makes the skeptical case against it, and proposes one experiment for the following week.

The first substantive run nominated a set of agent benchmarks and the harness that made them runnable. These had progressed from open to usable in under a week, were already finding bugs, and left reusable infrastructure.

The run then argued against its own choice. Nearly everything happened in the final week, so recency may have inflated the result. Subagents authored much of the dataset, making my contribution design and validation rather than authorship. The daily loop that would make the benchmarks matter had not landed.

The more useful finding came from raw counts: roughly forty pull requests opened in one week and seven merged. The run diagnosed excess work in progress and proposed that I land one change before opening the next.

But the six-to-one ratio overstated the problem. I had also started an automation that read task traces and proposed draft PRs. The drafts were poor, so we iterated on the automation without trying to land them.

The deeper limit was not a missing metric. The run could count open work, but it could not tell which changes were worth landing and which were already dead. GitHub records what shipped, and Linear records what finished, but neither records why I prioritized that work over the alternatives. Judging choices from outcomes rewards luck and hindsight. I need a contemporaneous record of why I chose the work.

## Record the choice

I initially treated Eno's question as a measurement problem, and measuring is the first way to know how to improve a system. But I think I lost sight of the purpose of measuring, which is to improve work including its prioritization. The most significant improvement is a record of prioritization: conversations and meetings that informed the timeline and priority for work, and what took its place (an urgent "fire" for example). This ledger is how we continue improving our work in a measurable way.
