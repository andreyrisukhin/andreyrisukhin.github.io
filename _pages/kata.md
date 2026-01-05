---
layout: page
title: kata
permalink: /kata/
description: "Breath and motion recipes for quick resets."
---

## Kata

<div class="kata-intro">  
  <p>
    Breathing is important. Marching band focused on air support and control, steady breathing.
  </p>
  <p>
    Inspired by the kata from Brandon Sanderson's "Stormlight Archive", these are combined yoga and marching band ideas.
  </p>
</div>

{% assign kata_recipes = site.data.kata.recipes %}

<nav class="kata-nav" aria-label="Kata recipes">
  {% for recipe in kata_recipes %}
    <button type="button" data-kata-toggle="{{ recipe.id }}" aria-pressed="false">
      {{ recipe.title }}
    </button>
  {% endfor %}
</nav>

<div class="kata-recipes">
  {% for recipe in kata_recipes %}
    <section id="{{ recipe.id }}" class="kata-recipe" data-kata-recipe>
      <img src="{{ recipe.image | relative_url }}" alt="{{ recipe.image_alt }}">
      <div>
        <h2>{{ recipe.title }}</h2>
        <p class="kata-summary">
          <button class="kata-toggle" type="button" aria-expanded="false">
            {{ recipe.summary }}
          </button>
        </p>
        <div class="kata-detail">
          <ol class="kata-steps">
            {% for item in recipe.details %}
              {% assign detail_label = item.label | default: item %}
              {% assign detail_text = item.detail %}
              <li>
                <span class="kata-detail-label">{{ detail_label }}</span>
                {% if detail_text %}
                  <span class="kata-detail-text">: {{ detail_text }}</span>
                {% endif %}
              </li>
            {% endfor %}
          </ol>
        </div>
        {% if recipe.tip %}
          <p class="kata-tips">Cue: {{ recipe.tip }}</p>
        {% endif %}
      </div>
    </section>
  {% endfor %}
</div>

<script>
  (() => {
    const buttons = Array.from(document.querySelectorAll("[data-kata-toggle]"));
    const sections = new Map(
      Array.from(document.querySelectorAll("[data-kata-recipe]")).map((section) => [
        section.id,
        section,
      ])
    );

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-kata-toggle");
        const section = sections.get(targetId);
        if (!section) return;

        const isActive = button.classList.toggle("is-active");
        button.setAttribute("aria-pressed", String(isActive));
        section.classList.toggle("is-visible", isActive);
        if (!isActive) {
          section.classList.remove("is-expanded");
          const toggle = section.querySelector(".kata-toggle");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
        }
      });
    });

    sections.forEach((section) => {
      const toggle = section.querySelector(".kata-toggle");
      if (!toggle) return;

      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isExpanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(isExpanded));
      });

      section.addEventListener("click", () => {
        const isExpanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", String(isExpanded));
      });
    });
  })();
</script>
