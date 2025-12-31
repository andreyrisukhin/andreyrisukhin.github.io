---
layout: page
title: kata
permalink: /kata/
description: "Breath and motion recipes for quick resets."
_styles: |
  .kata-intro {
    margin-bottom: 1.5rem;
  }

  .kata-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.75rem 0 1.5rem;
  }

  .kata-nav button {
    background: transparent;
    border: 1px solid var(--global-divider-color, #d0d0d0);
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
    font-size: 0.95rem;
    text-decoration: none;
    cursor: pointer;
  }

  .kata-nav button.is-active {
    background: var(--global-theme-color, #222);
    color: var(--global-bg-color, #fff);
    border-color: var(--global-theme-color, #222);
  }

  .kata-recipe {
    border: 1px solid var(--global-divider-color, #d0d0d0);
    border-radius: 16px;
    padding: 1.25rem;
    background: var(--global-card-bg-color, #fff);
    display: none;
    cursor: pointer;
  }

  .kata-recipe.is-visible {
    display: grid;
  }

  .kata-detail {
    margin-top: 0.75rem;
  }

  .kata-recipe.is-expanded .kata-detail-label {
    font-weight: 700;
  }

  .kata-detail-text {
    display: none;
  }

  .kata-recipe.is-expanded .kata-detail-text {
    display: inline;
  }

  .kata-recipe .kata-toggle {
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .kata-recipes {
    display: grid;
    gap: 2rem;
  }

  .kata-recipe {
    gap: 1.25rem;
  }

  .kata-recipe img {
    border-radius: 12px;
    width: 100%;
    height: auto;
  }

  .kata-recipe h2 {
    margin-top: 0;
  }

  .kata-steps {
    display: grid;
    gap: 0.5rem;
  }

  .kata-steps li {
    line-height: 1.5;
  }

  .kata-tips {
    font-size: 0.95rem;
    color: var(--global-text-muted-color, #555);
  }

  @media (min-width: 860px) {
    .kata-recipe {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      align-items: start;
    }
  }
---

## Kata

<div class="kata-intro">
  <p>
    These short routines pair breathing with simple motion. Each recipe is a
    6-10 minute loop you can run any time. Use the quick links to jump to a
    section and follow the step list in order.
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
