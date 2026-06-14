(function () {
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocalhost) {
    return;
  }

  const layout = document.querySelector("[data-homepage-layout]");
  const profile = document.querySelector("[data-homepage-profile]");
  if (!layout) {
    return;
  }

  const storageKey = "homepage-layout-editor";
  const sections = () => Array.from(layout.querySelectorAll("[data-homepage-section]"));
  const defaultState = {
    profileWidth: Number.parseInt(profile?.style.getPropertyValue("--homepage-profile-width"), 10) || 30,
    sectionOrder: sections().map((section) => section.dataset.homepageSection),
  };

  const readState = () => {
    try {
      return { ...defaultState, ...JSON.parse(window.localStorage.getItem(storageKey)) };
    } catch (_error) {
      return defaultState;
    }
  };

  let state = readState();
  let draggedSection = null;
  const bayanLabelsStorageKey = "homepage-bayan-button-labels-v3";
  const bayanRemovalStorageKey = "homepage-bayan-buttons-to-remove-v1";
  window.localStorage.removeItem("homepage-bayan-button-labels");
  window.localStorage.removeItem("homepage-bayan-button-labels-v2");
  window.localStorage.removeItem(bayanLabelsStorageKey);
  let bayanButtonsToRemove = new Set();

  const saveState = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  };

  const sectionMap = () =>
    sections().reduce((map, section) => {
      map.set(section.dataset.homepageSection, section);
      return map;
    }, new Map());

  const yaml = () =>
    ["home_layout:", `  profile_width: ${state.profileWidth}`, "  sections:", ...state.sectionOrder.map((section) => `    - ${section}`)].join("\n");

  const sortBayanButtonIds = (a, b) => {
    const aMatch = a.match(/^r(\d+)c(\d+)$/);
    const bMatch = b.match(/^r(\d+)c(\d+)$/);
    if (!aMatch || !bMatch) {
      return a.localeCompare(b);
    }
    return Number(aMatch[1]) - Number(bMatch[1]) || Number(aMatch[2]) - Number(bMatch[2]);
  };

  const readBayanButtonsToRemove = () => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(bayanRemovalStorageKey)) || []);
    } catch (_error) {
      return new Set();
    }
  };

  const saveBayanButtonsToRemove = () => {
    window.localStorage.setItem(bayanRemovalStorageKey, JSON.stringify([...bayanButtonsToRemove].sort(sortBayanButtonIds)));
  };

  const bayanRemovalYaml = () => {
    const entries = [...bayanButtonsToRemove].sort(sortBayanButtonIds);
    if (entries.length === 0) {
      return "";
    }
    return ["", "bayan_buttons_to_remove:", ...entries.map((id) => `  - ${id}`)].join("\n");
  };

  const applyState = () => {
    if (profile) {
      profile.style.setProperty("--homepage-profile-width", `${state.profileWidth}%`);
    }

    const byId = sectionMap();
    state.sectionOrder.forEach((id) => {
      const section = byId.get(id);
      if (section) {
        layout.appendChild(section);
      }
    });
  };

  const updateOrderFromDom = () => {
    state = {
      ...state,
      sectionOrder: sections().map((section) => section.dataset.homepageSection),
    };
    saveState();
    renderOutput();
  };

  const closestSection = (target) => target.closest("[data-homepage-section]");

  const getDropTarget = (event) => {
    const target = closestSection(event.target);
    if (!target || target === draggedSection) {
      return null;
    }
    const rect = target.getBoundingClientRect();
    return {
      section: target,
      before: event.clientY < rect.top + rect.height / 2,
    };
  };

  const addSectionChrome = () => {
    sections().forEach((section) => {
      section.draggable = true;
      if (!section.querySelector(":scope > .homepage-editor-label")) {
        const label = document.createElement("span");
        label.className = "homepage-editor-label";
        label.textContent = section.dataset.homepageSectionLabel || section.dataset.homepageSection;
        section.prepend(label);
      }

      section.addEventListener("dragstart", () => {
        draggedSection = section;
        section.classList.add("homepage-editor-dragging");
      });
      section.addEventListener("dragend", () => {
        section.classList.remove("homepage-editor-dragging");
        draggedSection = null;
        updateOrderFromDom();
      });
      section.addEventListener("dragover", (event) => {
        event.preventDefault();
        const dropTarget = getDropTarget(event);
        if (!dropTarget || !draggedSection) {
          return;
        }
        layout.insertBefore(draggedSection, dropTarget.before ? dropTarget.section : dropTarget.section.nextSibling);
      });
    });
  };

  const initBayanButtonLabeler = async () => {
    const image = document.querySelector('.homepage-intro__sketch img[src*="home-bayan-b-system.svg"]');
    if (!image) {
      return;
    }

    bayanButtonsToRemove = readBayanButtonsToRemove();

    const response = await window.fetch(image.src);
    if (!response.ok) {
      return;
    }

    const wrapper = image.closest(".homepage-intro__sketch");
    if (!wrapper) {
      return;
    }

    const svgText = await response.text();
    const documentSvg = new window.DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
    documentSvg.classList.add("homepage-bayan-labeler");
    wrapper.replaceChildren(documentSvg);

    const circles = Array.from(documentSvg.querySelectorAll("circle"));
    circles.forEach((circle, index) => {
      const row = Number.parseInt(circle.dataset.bayanRow, 10) || Math.floor(index / 22) + 1;
      const col = Number.parseInt(circle.dataset.bayanCol, 10) || (index % 22) + 1;
      const id = `r${row}c${col}`;
      circle.dataset.bayanButtonId = id;
      circle.classList.add("homepage-bayan-button");

      const renderRemovalState = () => {
        circle.classList.toggle("is-marked-for-removal", bayanButtonsToRemove.has(id));
      };

      const toggleRemovalState = () => {
        if (bayanButtonsToRemove.has(id)) {
          bayanButtonsToRemove.delete(id);
        } else {
          bayanButtonsToRemove.add(id);
        }
        saveBayanButtonsToRemove();
        renderRemovalState();
        renderOutput();
      };

      circle.addEventListener("click", toggleRemovalState);
      renderRemovalState();
    });

    renderOutput();
  };

  const panel = document.createElement("aside");
  panel.className = "homepage-editor-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <h2>Homepage dev layout</h2>
    <label>
      Profile width: <span data-homepage-profile-width>${state.profileWidth}%</span>
      <input min="15" max="50" step="1" type="range" value="${state.profileWidth}" data-homepage-profile-slider>
    </label>
    <p>Drag sections on the page to reorder them. Changes are saved in this browser.</p>
    <div class="homepage-editor-actions">
      <button type="button" data-homepage-copy>Copy YAML</button>
      <button type="button" data-homepage-reset>Reset</button>
      <button type="button" data-homepage-close>Close</button>
    </div>
    <textarea class="homepage-editor-output" readonly data-homepage-output></textarea>
  `;

  const toggle = document.createElement("button");
  toggle.className = "homepage-editor-toggle";
  toggle.type = "button";
  toggle.textContent = "Edit layout";

  document.body.append(toggle, panel);

  const output = panel.querySelector("[data-homepage-output]");
  const profileWidthText = panel.querySelector("[data-homepage-profile-width]");
  const profileSlider = panel.querySelector("[data-homepage-profile-slider]");

  function renderOutput() {
    output.value = yaml() + bayanRemovalYaml();
  }

  profileSlider.addEventListener("input", (event) => {
    state = {
      ...state,
      profileWidth: Number.parseInt(event.target.value, 10),
    };
    profileWidthText.textContent = `${state.profileWidth}%`;
    applyState();
    saveState();
    renderOutput();
  });

  panel.querySelector("[data-homepage-copy]").addEventListener("click", async () => {
    output.select();
    try {
      await window.navigator.clipboard.writeText(output.value);
    } catch (_error) {
      document.execCommand("copy");
    }
  });

  panel.querySelector("[data-homepage-reset]").addEventListener("click", () => {
    window.localStorage.removeItem(storageKey);
    state = defaultState;
    profileSlider.value = state.profileWidth;
    profileWidthText.textContent = `${state.profileWidth}%`;
    applyState();
    saveState();
    renderOutput();
  });

  panel.querySelector("[data-homepage-close]").addEventListener("click", () => {
    panel.hidden = true;
    toggle.hidden = false;
    document.body.classList.remove("homepage-editor-active");
  });

  toggle.addEventListener("click", () => {
    panel.hidden = false;
    toggle.hidden = true;
    document.body.classList.add("homepage-editor-active");
  });

  applyState();
  addSectionChrome();
  initBayanButtonLabeler();
  renderOutput();
})();
