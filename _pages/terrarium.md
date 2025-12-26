---
layout: none
permalink: /terrarium/
title: Terrarium
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ page.title }}</title>
    <link rel="stylesheet" href="{{ '/assets/css/main.css' | relative_url }}">
  </head>
  <body>
    <div id="terrarium-root">
      <canvas id="terrarium-canvas"></canvas>

      <div id="terrarium-ui">
        <button id="btn-pause">Pause</button>
        <button id="btn-reset">Reset</button>
        <div class="terrarium-scenes" role="group" aria-label="Scenes">
          <button data-scene="particles" class="is-active">Particles</button>
          <button data-scene="creatures">Creatures</button>
        </div>
        <span id="terrarium-alert" role="status" aria-live="polite"></span>
        <span id="fps"></span>
      </div>
    </div>

    <script type="module" src="{{ '/assets/js/terrarium/main.js' | relative_url }}"></script>
  </body>
</html>
