(function () {
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocalhost) {
    return;
  }

  const DEV_MODE_KEY = "site-dev-mode";
  const STORAGE_KEY = `site-dev-annotations:${window.location.pathname}`;
  const PANEL_COLLAPSED_KEY = "site-dev-annotator-panel-collapsed";
  const PADDING = 48;

  const state = {
    enabled: readDevMode(),
    annotations: readAnnotations(),
    pendingPoint: null,
    panelCollapsed: window.localStorage.getItem(PANEL_COLLAPSED_KEY) !== "0",
  };

  const overlay = document.createElement("div");
  overlay.className = "site-dev-annotator-overlay";
  overlay.setAttribute("data-site-dev-annotator", "overlay");
  overlay.innerHTML = '<svg class="site-dev-annotator-lines"></svg><div class="site-dev-annotator-points"></div>';
  document.body.appendChild(overlay);

  const panel = buildPanel();
  document.body.appendChild(panel.root);

  document.addEventListener("click", onDocumentClick, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      state.pendingPoint = null;
      render();
    }
  });
  window.addEventListener("resize", render);

  render();

  function readDevMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "1") {
      window.localStorage.setItem(DEV_MODE_KEY, "1");
      return true;
    }
    if (params.get("dev") === "0") {
      window.localStorage.removeItem(DEV_MODE_KEY);
      return false;
    }
    return window.localStorage.getItem(DEV_MODE_KEY) === "1";
  }

  function readAnnotations() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_error) {
      return [];
    }
  }

  function saveAnnotations() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.annotations));
  }

  function setDevMode(enabled) {
    state.enabled = enabled;
    state.pendingPoint = null;
    if (enabled) {
      window.localStorage.setItem(DEV_MODE_KEY, "1");
    } else {
      window.localStorage.removeItem(DEV_MODE_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete("dev");
      window.history.replaceState({}, "", url.toString());
    }
    render();
  }

  function onDocumentClick(event) {
    if (!state.enabled) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("[data-site-dev-annotator]")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const point = capturePoint(event);
    if (!state.pendingPoint) {
      state.pendingPoint = point;
      render();
      return;
    }

    const note = window.prompt("Annotation for this line segment", "") || "";
    const annotation = {
      id: Date.now(),
      type: "line-segment",
      marker: "conjoined",
      pathname: window.location.pathname,
      start: state.pendingPoint,
      end: point,
      note,
      screenshot: captureRegion(state.pendingPoint, point),
      createdAt: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
    };
    state.annotations.push(annotation);
    state.pendingPoint = null;
    saveAnnotations();
    state.panelCollapsed = false;
    window.localStorage.setItem(PANEL_COLLAPSED_KEY, "0");
    render();
    panel.focusAnnotation(annotation.id);
  }

  function capturePoint(event) {
    return {
      pageX: Math.round(event.pageX),
      pageY: Math.round(event.pageY),
      clientX: Math.round(event.clientX),
      clientY: Math.round(event.clientY),
      target: describeElement(event.target),
    };
  }

  function describeElement(target) {
    if (!(target instanceof Element)) {
      return null;
    }
    const rect = target.getBoundingClientRect();
    const section = target.closest("section, article, main, header, footer, nav, [data-homepage-section]");
    return {
      selector: cssPath(target),
      tag: target.tagName.toLowerCase(),
      id: target.id || null,
      className: target.className && typeof target.className === "string" ? target.className : null,
      text: (target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
      rect: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      section: section ? cssPath(section) : null,
    };
  }

  function cssPath(target) {
    const path = [];
    let el = target;
    while (el && el.nodeType === 1 && path.length < 7) {
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector += `#${CSS.escape(el.id)}`;
        path.unshift(selector);
        break;
      }
      const stableAttr = ["data-homepage-section", "data-bayan-row", "data-bayan-col"].find((attr) => el.hasAttribute(attr));
      if (stableAttr) {
        selector += `[${stableAttr}="${CSS.escape(el.getAttribute(stableAttr))}"]`;
      } else if (el.classList.length) {
        selector += `.${[...el.classList]
          .slice(0, 2)
          .map((className) => CSS.escape(className))
          .join(".")}`;
      }
      const siblings = el.parentElement ? [...el.parentElement.children].filter((child) => child.tagName === el.tagName) : [];
      if (siblings.length > 1) {
        selector += `:nth-of-type(${siblings.indexOf(el) + 1})`;
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(" > ");
  }

  function captureRegion(start, end) {
    const left = Math.max(0, Math.min(start.pageX, end.pageX) - PADDING);
    const top = Math.max(0, Math.min(start.pageY, end.pageY) - PADDING);
    const right = Math.min(documentWidth(), Math.max(start.pageX, end.pageX) + PADDING);
    const bottom = Math.min(documentHeight(), Math.max(start.pageY, end.pageY) + PADDING);
    const width = Math.max(120, right - left);
    const height = Math.max(80, bottom - top);

    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("[data-site-dev-annotator], script").forEach((node) => node.remove());
    const cssText = collectCssText();
    const bodyHtml = clone.innerHTML.replace(/<svg[\s\S]*?site-dev-annotator[\s\S]*?<\/svg>/g, "");
    const line = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;width:${documentWidth()}px;height:${documentHeight()}px;overflow:visible;pointer-events:none"><line x1="${
      start.pageX
    }" y1="${start.pageY}" x2="${end.pageX}" y2="${end.pageY}" stroke="#d7263d" stroke-width="3"/><circle cx="${start.pageX}" cy="${
      start.pageY
    }" r="8" fill="#d7263d"/><circle cx="${end.pageX}" cy="${end.pageY}" r="8" fill="#d7263d"/></svg>`;
    const foreignObject = `
      <foreignObject x="0" y="0" width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${documentWidth()}px;min-height:${documentHeight()}px;transform:translate(${-left}px, ${-top}px);transform-origin:top left;background:var(--global-bg-color, #fff);">
          <style>${escapeHtml(cssText)}</style>
          ${bodyHtml}
          ${line}
        </div>
      </foreignObject>
    `;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${foreignObject}</svg>`;
    return {
      kind: "svg-foreign-object",
      dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      rect: { x: left, y: top, width, height },
    };
  }

  function collectCssText() {
    return [...document.styleSheets]
      .map((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
        } catch (_error) {
          return "";
        }
      })
      .join("\n");
  }

  function documentWidth() {
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
  }

  function documentHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
  }

  function render() {
    document.body.classList.toggle("site-dev-annotator-active", state.enabled);
    overlay.hidden = !state.enabled;
    overlay.style.width = `${documentWidth()}px`;
    overlay.style.height = `${documentHeight()}px`;
    panel.render();
    renderOverlay();
  }

  function renderOverlay() {
    const svg = overlay.querySelector("svg");
    const points = overlay.querySelector(".site-dev-annotator-points");
    svg.setAttribute("width", documentWidth());
    svg.setAttribute("height", documentHeight());
    svg.replaceChildren();
    points.replaceChildren();

    state.annotations.forEach((annotation) => {
      svg.appendChild(svgLine(annotation.start, annotation.end, annotation.id));
      points.append(pointMarker(annotation.start, annotation.id, "start"), pointMarker(annotation.end, annotation.id, "end"));
    });
    if (state.pendingPoint) {
      points.appendChild(pointMarker(state.pendingPoint, "pending", "pending"));
    }
  }

  function svgLine(start, end, id) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", start.pageX);
    line.setAttribute("y1", start.pageY);
    line.setAttribute("x2", end.pageX);
    line.setAttribute("y2", end.pageY);
    line.setAttribute("class", "site-dev-annotator-line");
    line.dataset.annotationId = String(id);
    line.addEventListener("click", (event) => {
      event.stopPropagation();
      panel.focusAnnotation(id);
    });
    return line;
  }

  function pointMarker(point, id, role) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `site-dev-annotator-point is-${role}`;
    marker.dataset.annotationId = String(id);
    marker.style.left = `${point.pageX}px`;
    marker.style.top = `${point.pageY}px`;
    marker.title = `${role}: ${point.target?.selector || "page"}`;
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      if (id !== "pending") {
        panel.focusAnnotation(id);
      }
    });
    return marker;
  }

  function buildPanel() {
    const root = document.createElement("aside");
    root.className = "site-dev-annotator-panel";
    root.setAttribute("data-site-dev-annotator", "panel");
    root.innerHTML = `
      <button type="button" class="site-dev-annotator-panel__toggle" data-action="toggle"></button>
      <div class="site-dev-annotator-panel__inner">
        <header>
          <strong>Site dev annotations</strong>
          <button type="button" data-action="close" aria-label="Collapse">×</button>
        </header>
        <label class="site-dev-annotator-panel__mode">
          Marker
          <select>
            <option value="line-segment">conjoined line segment</option>
          </select>
        </label>
        <p>Dev mode is active. Click once for the first marker and click again anywhere on the page to create an annotated segment. Use “Turn off dev mode” or visit with <code>?dev=0</code> to disable it.</p>
        <div class="site-dev-annotator-panel__actions">
          <button type="button" data-action="turn-off">Turn off dev mode</button>
          <button type="button" data-action="copy">Copy JSON</button>
          <button type="button" data-action="clear-pending">Clear pending</button>
          <button type="button" data-action="clear-all">Clear all</button>
        </div>
        <ol class="site-dev-annotator-panel__list"></ol>
      </div>
    `;

    const toggle = root.querySelector('[data-action="toggle"]');
    const list = root.querySelector("ol");
    const api = {
      root,
      render() {
        root.classList.toggle("is-off", !state.enabled);
        root.classList.toggle("is-collapsed", state.panelCollapsed);
        toggle.textContent = state.enabled ? "Dev mode on" : "Turn dev mode on";
        list.replaceChildren();
        state.annotations.forEach((annotation) => list.appendChild(renderListItem(annotation, api)));
      },
      focusAnnotation(id) {
        state.panelCollapsed = false;
        window.localStorage.setItem(PANEL_COLLAPSED_KEY, "0");
        api.render();
        root.querySelectorAll(".is-active").forEach((item) => item.classList.remove("is-active"));
        const item = root.querySelector(`[data-annotation-id="${id}"]`);
        item?.classList.add("is-active");
        item?.scrollIntoView({ block: "nearest" });
      },
    };

    toggle.addEventListener("click", () => {
      if (!state.enabled) {
        setDevMode(true);
        state.panelCollapsed = false;
      } else {
        state.panelCollapsed = !state.panelCollapsed;
      }
      window.localStorage.setItem(PANEL_COLLAPSED_KEY, state.panelCollapsed ? "1" : "0");
      render();
    });
    root.querySelector('[data-action="close"]').addEventListener("click", () => {
      state.panelCollapsed = true;
      window.localStorage.setItem(PANEL_COLLAPSED_KEY, "1");
      render();
    });
    root.querySelector('[data-action="turn-off"]').addEventListener("click", () => {
      state.panelCollapsed = true;
      window.localStorage.setItem(PANEL_COLLAPSED_KEY, "1");
      setDevMode(false);
    });
    root.querySelector('[data-action="clear-pending"]').addEventListener("click", () => {
      state.pendingPoint = null;
      render();
    });
    root.querySelector('[data-action="clear-all"]').addEventListener("click", () => {
      state.annotations = [];
      state.pendingPoint = null;
      saveAnnotations();
      render();
    });
    root.querySelector('[data-action="copy"]').addEventListener("click", async () => {
      const json = JSON.stringify({ pathname: window.location.pathname, annotations: state.annotations }, null, 2);
      try {
        await window.navigator.clipboard.writeText(json);
      } catch (_error) {
        window.prompt("Copy site dev annotations", json);
      }
    });

    return api;
  }

  function renderListItem(annotation, panelApi) {
    const item = document.createElement("li");
    item.className = "site-dev-annotator-panel__item";
    item.dataset.annotationId = String(annotation.id);
    item.innerHTML = `
      <div class="site-dev-annotator-panel__item-head">
        <button type="button" data-action="jump">${annotation.start.pageX},${annotation.start.pageY} → ${annotation.end.pageX},${
          annotation.end.pageY
        }</button>
        <button type="button" data-action="delete" aria-label="Delete annotation">×</button>
      </div>
      <div class="site-dev-annotator-panel__meta">${escapeHtml(annotation.start.target?.selector || "page")} → ${escapeHtml(
        annotation.end.target?.selector || "page"
      )}</div>
      ${annotation.screenshot?.dataUrl ? `<img src="${annotation.screenshot.dataUrl}" alt="annotation crop">` : ""}
      <textarea rows="3" placeholder="Annotation text"></textarea>
    `;
    const textarea = item.querySelector("textarea");
    textarea.value = annotation.note || "";
    textarea.addEventListener("input", () => {
      annotation.note = textarea.value;
      saveAnnotations();
    });
    item.querySelector('[data-action="jump"]').addEventListener("click", () => panelApi.focusAnnotation(annotation.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => {
      state.annotations = state.annotations.filter((entry) => entry.id !== annotation.id);
      saveAnnotations();
      render();
    });
    return item;
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
