---
layout: page
title: Kata
permalink: /kata/
description: "Breath and motion recipes for quick resets."
---

<div class="kata-intro">  
  <p>
    Breathing is important. Marching band focused on air support and control, steady breathing.
  </p>
  <p>
    Inspired by the kata from Brandon Sanderson's "Stormlight Archive", these are combined yoga and marching band ideas.
  </p>
</div>

<div class="kata-practice" data-kata-practice data-scene="morning">
  <div class="kata-toolbar">
    <nav class="kata-nav" aria-label="Kata recipes" hidden>
      {% for recipe in site.data.kata.recipes %}
        <button type="button" data-kata-toggle="{{ recipe.id }}" aria-controls="{{ recipe.id }}" aria-pressed="{% if forloop.first %}true{% else %}false{% endif %}">
          {{ recipe.title }}
        </button>
      {% endfor %}
    </nav>
    <button type="button" class="kata-motion" data-kata-motion aria-pressed="false" hidden>Pause motion</button>
  </div>

  <div class="kata-landscape">
    {% include kata-scene.liquid %}
    <div class="kata-recipes">
      {% for recipe in site.data.kata.recipes %}
        <section id="{{ recipe.id }}" class="kata-recipe" data-kata-recipe data-scene="{% if recipe.id == 'night-soften' %}night{% else %}morning{% endif %}" aria-labelledby="{{ recipe.id }}-title">
          <header class="kata-recipe-header">
            <p class="kata-eyebrow">{% if recipe.id == 'night-soften' %}Beneath the stars{% else %}With the first light{% endif %}</p>
            <h2 id="{{ recipe.id }}-title">{{ recipe.title }}</h2>
            <p class="kata-summary">{{ recipe.summary }}</p>
            <p class="kata-hint">Open a step. Take your time.</p>
          </header>
          <ol class="kata-steps">
            {% for item in recipe.details %}
              <li style="--step: {{ forloop.index0 }}">
                <details class="kata-step">
                  <summary>
                    <span class="kata-step-number" aria-hidden="true">0{{ forloop.index }}</span>
                    <span>{{ item.label | default: item }}</span>
                    <span class="kata-step-mark" aria-hidden="true">+</span>
                  </summary>
                  {% if item.detail %}<p>{{ item.detail }}</p>{% endif %}
                </details>
              </li>
            {% endfor %}
          </ol>
          {% if recipe.tip %}<p class="kata-tips">Cue: {{ recipe.tip }}</p>{% endif %}
        </section>
      {% endfor %}
    </div>
    <p class="kata-scene-caption" aria-hidden="true"><span class="kata-caption-morning">A little light. A little room to breathe.</span><span class="kata-caption-night">The shattered plains. A fire still burning.</span></p>
  </div>
</div>

<script defer src="{{ '/assets/js/kata.js' | relative_url | bust_file_cache }}"></script>
