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

<div class="kata-practice" data-kata-practice data-scene="morning" data-view="bounded">
  <div class="kata-toolbar">
    <nav class="kata-nav" aria-label="Kata recipes" hidden>
      {% for recipe in site.data.kata.recipes %}
        <button type="button" data-kata-toggle="{{ recipe.id }}" aria-controls="{{ recipe.id }}" aria-pressed="{% if forloop.first %}true{% else %}false{% endif %}">
          {{ recipe.title }}
        </button>
      {% endfor %}
    </nav>
    <div class="kata-view" role="group" aria-label="Scene view" hidden>
      <button type="button" data-kata-view="bounded" aria-pressed="true">Bounded</button>
      <button type="button" data-kata-view="immersive" aria-pressed="false">Immersive</button>
    </div>
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
          </header>
          <ol class="kata-steps" id="{{ recipe.id }}-steps">
            {% for item in recipe.details %}
              <li class="kata-step" style="--step: {{ forloop.index0 }}">
                <p class="kata-step-number">Step {{ forloop.index }} of {{ recipe.details.size }}</p>
                <h3>{{ item.label | default: item }}</h3>
                {% if item.detail %}<p>{{ item.detail }}</p>{% endif %}
                {% if forloop.last and recipe.tip %}<p class="kata-tips">Cue: {{ recipe.tip }}</p>{% endif %}
              </li>
            {% endfor %}
          </ol>
          <nav class="kata-step-nav" aria-label="{{ recipe.title }} steps" hidden>
            <button type="button" data-kata-back aria-controls="{{ recipe.id }}-steps">Back</button>
            <button type="button" data-kata-next aria-controls="{{ recipe.id }}-steps">Next</button>
          </nav>
        </section>
      {% endfor %}
    </div>
  </div>
</div>

<dialog class="kata-immersive" aria-label="Immersive kata practice" data-kata-immersive></dialog>

<script defer src="{{ '/assets/js/kata.js' | relative_url | bust_file_cache }}"></script>
