---
layout: none
permalink: /golem-demo/
title: Golem Demo
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ page.title }}</title>
    <link rel="stylesheet" href="{{ '/assets/css/main.css' | relative_url }}">
    <link rel="stylesheet" href="{{ '/assets/css/golem-demo.css' | relative_url | bust_file_cache }}">
  </head>
  <body>
    <div id="golem-demo-root">
      <header id="golem-header">
        <h1>Golem Demo</h1>
        <p>Bevy + WebAssembly sandbox. Build the wasm output to see the game render.</p>
      </header>
      <main id="golem-stage">
        <canvas id="golem-canvas"></canvas>
        <div id="golem-status" role="status" aria-live="polite"></div>
      </main>
    </div>

    <script>
      window.__GOLEM_WASM_URL__ = "{{ '/assets/wasm/golem-demo/golem_demo.js' | relative_url }}";
    </script>
    <script type="module" src="{{ '/assets/js/golem-demo/main.js' | relative_url | bust_file_cache }}"></script>
  </body>
</html>
