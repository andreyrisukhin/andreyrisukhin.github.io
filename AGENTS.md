# AGENTS.md

Instructions for AI assistants working in this repo. Site source for andreyrisukhin.github.io (al-folio fork).

## Default mode: critique, do not rewrite

When I share prose (drafts of `_posts/*.md`, `_news/*.md`, `_pages/*.md`, README sections), the default response is a **critique with specific, line-referenced edits**, not a rewritten draft. Only rewrite when I explicitly ask ("rewrite this", "give me a version", etc.).

A good critique:
- Quotes the offending phrase, then says what is wrong, then proposes a concrete shorter alternative.
- Is ordered worst-offender first.
- Distinguishes mechanical issues (grammar, voice) from substantive ones (claim is vague, evidence is missing, structure buries the lede).
- Stops when there is nothing more to say. No filler, no "great work overall."

## Voice I am writing in

Read `_posts/2026-05-01-time-at-perceptron-ai.md` as the calibration sample. Concrete nouns, declarative sentences, named people, specific numbers. First person, conversational but not chatty. Em dashes are fine. Lists are fine when the items are genuinely parallel.

## Anti-patterns to flag aggressively

Reject these on sight in my drafts:

1. **AI tells.** "delve", "leverage", "in the realm of", "it's worth noting", "navigate the landscape", "tapestry", "underscore", "robust" (as filler), "seamless", "showcase", "myriad", "pivotal", "deep dive". Also: tricolons of abstract nouns ("clarity, scale, and impact").
2. **Throat-clearing openings.** "In this post, I will...", "I want to talk about...", "Recently, I have been thinking about...". Cut to the first real sentence.
3. **Hedge stacking.** "I think it might possibly be the case that..." Pick one hedge or none.
4. **Marketing voice.** Superlatives without evidence ("incredible team", "amazing journey", "game-changing"). If I keep one, it must be earned by a specific anecdote.
5. **Passive voice when the actor matters.** "Decisions were made" → who made them.
6. **Vague abstractions where a concrete noun would do.** "things", "stuff", "various aspects", "a number of".
7. **Adverb crutches.** "really", "very", "quite", "actually", "basically", "essentially", "literally". Almost always cut without loss.
8. **Sentences over ~25 words** when they could be split. Long sentences are fine when load-bearing; not as default.
9. **Bulleted lists used as a thinking shortcut** when the items are not actually parallel, or when prose would carry the idea better.
10. **Closing summaries that restate the post.** End on the strongest concrete sentence, not a recap.

## Substantive checks

Beyond mechanics, ask:
- What is the one sentence this post exists to deliver? Is it in the first paragraph?
- What claim is made without evidence? What number, anecdote, or example would back it?
- What does the reader know at the end that they did not know at the start? If the answer is "nothing specific", the post is not ready.
- Is anything here only true because it sounds nice?

## What not to touch unprompted

- Frontmatter (`layout`, `date`, `tags`, `categories`, `published`).
- Liquid tags and `{% include %}` blocks.
- Image paths and captions.
- Existing structure (headings, section order) unless I ask for structural feedback.

## Mechanical lint (optional, future)

If `vale` is installed in the repo, run it before responding and fold its output into the critique. Do not duplicate vale findings in prose; reference the file:line.

## Repo conventions (non-prose)

- Jekyll + al-folio. Upstream is `alshedivat/al-folio`; check there before assuming a bug is mine.
- Template example posts (`_posts/2015-*` through `_posts/2025-*`) are excluded in `_config.yml`. My posts are dated 2026 onward.
- The broken-links workflow excludes Liquid-templated pages (`_pages/kata.md`, `terrarium.md`, `golem-demo.md`, `_projects/3_project.md`). If a new page uses Liquid in URLs, add it to that exclude list.
- `.lycheeignore` covers bot-blocked domains (linkedin, reddit, unsplash, intmath).
