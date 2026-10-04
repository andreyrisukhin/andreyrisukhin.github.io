(function () {
  const O = window.OutfitColor;
  const root = document.querySelector("[data-outfit]");
  if (!O || !root) return;

  const $ = (id) => document.getElementById(id);
  const wheel = $("outfit-wheel");
  const valueInput = $("outfit-value");
  const valueOut = $("outfit-value-out");
  const colorInput = $("outfit-color-input");
  const hexInput = $("outfit-hex");
  const selectedLabel = $("outfit-selected-label");
  const swatchesEl = $("outfit-swatches");
  const harmonySelect = $("outfit-harmony");
  const suggestionsEl = $("outfit-suggestions");
  const barEl = $("outfit-bar");
  const autoButton = $("outfit-auto");
  const autoNote = $("outfit-auto-note");
  const piecesEl = $("outfit-pieces");
  const addSelect = $("outfit-add-garment");
  const addButton = $("outfit-add");
  const figure = $("outfit-figure");
  const skinEl = $("outfit-skin");
  const notesEl = $("outfit-notes");
  const examplesEl = $("outfit-examples");
  const saveName = $("outfit-save-name");
  const saveButton = $("outfit-save");
  const copyButton = $("outfit-copy");
  const savedEl = $("outfit-saved");
  const statusEl = $("outfit-status");
  const ideasEl = $("outfit-ideas");
  const ideasNote = $("outfit-ideas-note");
  const moreButton = $("outfit-more");

  const STORAGE_LAST = "outfit-palette:last";
  const STORAGE_SAVED = "outfit-palette:saved";

  const CLOTHING_COLORS = [
    ["White", "#f4f2ec"],
    ["Cream", "#e9e1cc"],
    ["Light gray", "#b9b9b4"],
    ["Charcoal", "#3a3d40"],
    ["Black", "#1c1c1e"],
    ["Navy", "#1f2a44"],
    ["Denim", "#3d5a80"],
    ["Light blue", "#a9c4e0"],
    ["Olive", "#5b6236"],
    ["Sage", "#9caf88"],
    ["Khaki", "#c3b091"],
    ["Tan", "#b08a5a"],
    ["Brown", "#5c4033"],
    ["Burgundy", "#6d1f2b"],
    ["Rust", "#a4472c"],
    ["Mustard", "#c9a227"],
  ];
  const COLOR_NAMES = Object.fromEntries(CLOTHING_COLORS.map(([name, hex]) => [hex, name]));
  const SKIN_TONES = ["#f3d7c3", "#e6b896", "#c68e6a", "#a26a47", "#7a4a2e", "#4e2e1d"];

  const EXAMPLES = [
    { name: "Olive chinos", query: "o=tee.f4f2ec_chinos.5b6236_shoes.5c4033" },
    { name: "Olive shorts", query: "o=tee.f4f2ec_shorts.5b6236_shoes.5c4033" },
    { name: "Navy and gray", query: "o=sweater.1f2a44_chinos.b9b9b4_shoes.f4f2ec" },
    { name: "Rust accent", query: "o=shirt.e9e1cc_overshirt.a4472c_jeans.3d5a80_boots.5c4033" },
  ];

  let state = loadInitial();
  let selected = 0;
  let wheelCacheKey = null;
  let wheelImage = null;
  let ideaVariant = 0;

  function defaultState() {
    return O.decodeOutfit(EXAMPLES[0].query);
  }

  function loadInitial() {
    const fromHash = O.decodeOutfit(location.hash);
    if (fromHash) return withSkin(fromHash);
    try {
      const last = O.decodeOutfit(localStorage.getItem(STORAGE_LAST));
      if (last) return withSkin(last);
    } catch (err) {
      // Storage can be blocked; fall back to the default outfit.
    }
    return withSkin(defaultState());
  }

  function withSkin(s) {
    s.skin = s.skin || SKIN_TONES[2];
    return s;
  }

  const nameOf = (piece) => O.garment(piece.garment).label;
  const colorName = (hex) => COLOR_NAMES[hex] || hex;
  const inkFor = (hex) => (O.hexToOklch(hex).l > 0.62 ? "#1c1c1e" : "#ffffff");

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function recomputeAuto() {
    if (!state.auto) return;
    const shares = O.defaultShares(state.pieces.map((p) => p.garment));
    state.pieces.forEach((p, i) => (p.share = shares[i]));
  }

  function commit() {
    recomputeAuto();
    const query = O.encodeOutfit(state);
    history.replaceState(null, "", "#" + query);
    try {
      localStorage.setItem(STORAGE_LAST, query);
    } catch (err) {
      // Ignore blocked storage.
    }
    render();
  }

  // ----- Wheel -----

  function wheelGeometry() {
    const size = wheel.clientWidth || 280;
    const ratio = window.devicePixelRatio || 1;
    return { size, ratio, radius: size / 2 - 10, center: size / 2 };
  }

  function hsAt(x, y, geo) {
    const dx = x - geo.center;
    const dy = y - geo.center;
    const s = Math.min(1, Math.hypot(dx, dy) / geo.radius);
    const h = O.wrapHue((Math.atan2(dx, -dy) * 180) / Math.PI);
    return { h, s };
  }

  function pointFor(hsv, geo) {
    const angle = (hsv.h * Math.PI) / 180;
    return { x: geo.center + Math.sin(angle) * hsv.s * geo.radius, y: geo.center - Math.cos(angle) * hsv.s * geo.radius };
  }

  function buildWheelImage(geo, v) {
    const px = Math.round(geo.size * geo.ratio);
    const image = new ImageData(px, px);
    const r = geo.radius * geo.ratio;
    const c = geo.center * geo.ratio;
    for (let y = 0; y < px; y += 1) {
      for (let x = 0; x < px; x += 1) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const dist = Math.hypot(dx, dy);
        if (dist > r + 1) continue;
        const rgb = O.hsvToRgb({ h: (Math.atan2(dx, -dy) * 180) / Math.PI, s: Math.min(1, dist / r), v });
        const i = (y * px + x) * 4;
        image.data[i] = rgb.r;
        image.data[i + 1] = rgb.g;
        image.data[i + 2] = rgb.b;
        image.data[i + 3] = dist > r ? Math.round(255 * (r + 1 - dist)) : 255;
      }
    }
    return image;
  }

  const leadIndex = () => O.anchorIndex(state.pieces);

  function drawWheel() {
    const geo = wheelGeometry();
    const piece = state.pieces[selected];
    const hsv = O.hexToHsv(piece.hex);
    const px = Math.round(geo.size * geo.ratio);
    if (wheel.width !== px) {
      wheel.width = px;
      wheel.height = px;
    }
    const v = Math.max(0.12, hsv.v);
    const key = px + ":" + v.toFixed(2);
    if (key !== wheelCacheKey) {
      wheelImage = buildWheelImage(geo, v);
      wheelCacheKey = key;
    }
    const ctx = wheel.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.putImageData(wheelImage, 0, 0);
    ctx.scale(geo.ratio, geo.ratio);

    const scheme = harmonySelect.value;
    const lead = state.pieces[leadIndex()];
    if (lead && scheme !== "neutrals") {
      const leadHsv = O.hexToHsv(lead.hex);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      [leadHsv.h, ...O.harmonyHues(leadHsv.h, scheme)].forEach((h) => {
        const end = pointFor({ h, s: 1 }, geo);
        ctx.beginPath();
        ctx.moveTo(geo.center, geo.center);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    state.pieces.forEach((p, i) => {
      const point = pointFor(O.hexToHsv(p.hex), geo);
      const r = markerRadius(p);
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.hex;
      ctx.fill();
      ctx.lineWidth = i === selected ? 3 : 1.5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y, r + (i === selected ? 2.5 : 1.5), 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.stroke();
    });
  }

  const markerRadius = (piece) => 5 + Math.sqrt(piece.share) * 1.1;

  let wheelDrag = false;

  function capture(el, event) {
    try {
      el.setPointerCapture(event.pointerId);
    } catch (err) {
      // Synthetic or already-released pointers cannot be captured; dragging still works without it.
    }
  }

  function wheelPointer(event) {
    const rect = wheel.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function applyWheel(point) {
    const geo = wheelGeometry();
    const piece = state.pieces[selected];
    const hsv = O.hexToHsv(piece.hex);
    const hs = hsAt(point.x, point.y, geo);
    piece.hex = O.hsvToHex({ h: hs.h, s: hs.s, v: hsv.v < 0.04 ? 0.5 : hsv.v });
    commit();
  }

  wheel.addEventListener("pointerdown", (event) => {
    const point = wheelPointer(event);
    const geo = wheelGeometry();
    const hit = state.pieces
      .map((p, i) => ({ i, d: Math.hypot(pointFor(O.hexToHsv(p.hex), geo).x - point.x, pointFor(O.hexToHsv(p.hex), geo).y - point.y), r: markerRadius(p) }))
      .filter((m) => m.d <= m.r + 4)
      .sort((a, b) => a.d - b.d)[0];
    wheelDrag = true;
    capture(wheel, event);
    if (hit) {
      selected = hit.i;
      render();
    } else {
      applyWheel(point);
    }
  });
  wheel.addEventListener("pointermove", (event) => {
    if (wheelDrag) applyWheel(wheelPointer(event));
  });
  const endWheelDrag = () => (wheelDrag = false);
  wheel.addEventListener("pointerup", endWheelDrag);
  wheel.addEventListener("pointercancel", endWheelDrag);

  valueInput.addEventListener("input", () => {
    const piece = state.pieces[selected];
    const hsv = O.hexToHsv(piece.hex);
    piece.hex = O.hsvToHex({ ...hsv, v: Number(valueInput.value) / 100 });
    commit();
  });

  colorInput.addEventListener("input", () => setSelectedHex(colorInput.value));
  hexInput.addEventListener("change", () => {
    const hex = O.normalizeHex(hexInput.value);
    if (hex) setSelectedHex(hex);
    else hexInput.value = state.pieces[selected].hex;
  });

  function setSelectedHex(hex) {
    state.pieces[selected].hex = O.normalizeHex(hex);
    commit();
  }

  // ----- Swatches -----

  function swatchButton(hex, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "outfit-swatch";
    button.style.background = hex;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", onClick);
    return button;
  }

  CLOTHING_COLORS.forEach(([name, hex]) => swatchesEl.append(swatchButton(hex, name, () => setSelectedHex(hex))));

  SKIN_TONES.forEach((hex, i) => {
    const button = swatchButton(hex, "Skin tone " + (i + 1), () => {
      state.skin = hex;
      commit();
    });
    button.dataset.skin = hex;
    skinEl.append(button);
  });

  harmonySelect.addEventListener("change", render);

  function renderSuggestions() {
    const lead = state.pieces[leadIndex()];
    suggestionsEl.replaceChildren(
      ...O.harmonySuggestions(lead.hex, harmonySelect.value).map((hex) => swatchButton(hex, colorName(hex), () => setSelectedHex(hex)))
    );
  }

  // ----- Proportion bar -----

  function renderBar() {
    const segments = state.pieces.map((p, i) => {
      const seg = document.createElement("button");
      seg.type = "button";
      seg.className = "outfit-bar__seg" + (i === selected ? " is-selected" : "");
      seg.style.flexBasis = p.share + "%";
      seg.style.background = p.hex;
      seg.style.color = inkFor(p.hex);
      seg.title = `${nameOf(p)}: ${colorName(p.hex)}, ${p.share}%`;
      seg.setAttribute("aria-label", seg.title);
      if (p.share >= 9) seg.innerHTML = `<span>${nameOf(p)}</span><span>${p.share}%</span>`;
      else if (p.share >= 4) seg.innerHTML = `<span>${p.share}</span>`;
      seg.addEventListener("click", () => {
        selected = i;
        render();
      });
      return seg;
    });
    let offset = 0;
    const handles = state.pieces.slice(0, -1).map((p, i) => {
      offset += p.share;
      const handle = document.createElement("div");
      handle.className = "outfit-bar__handle";
      handle.style.left = offset + "%";
      handle.tabIndex = 0;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      handle.setAttribute("aria-valuenow", String(p.share));
      handle.setAttribute("aria-label", `Border between ${nameOf(p)} and ${nameOf(state.pieces[i + 1])}`);
      bindHandle(handle, i);
      return handle;
    });
    barEl.replaceChildren(...segments, ...handles);
    autoNote.textContent = state.auto ? "Sizes follow the garments. Drag a border to set your own." : "Custom sizes.";
    autoButton.hidden = state.auto;
  }

  function bindHandle(handle, index) {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startShares = state.pieces.map((p) => p.share);
      const width = barEl.getBoundingClientRect().width;
      capture(handle, event);
      const move = (e) => {
        const shares = O.moveBoundary(startShares, index, ((e.clientX - startX) / width) * 100);
        state.auto = false;
        state.pieces.forEach((p, i) => (p.share = shares[i]));
        commit();
        const fresh = barEl.querySelectorAll(".outfit-bar__handle")[index];
        if (fresh) fresh.classList.add("is-dragging");
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        render();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    handle.addEventListener("keydown", (event) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const shares = O.moveBoundary(
        state.pieces.map((p) => p.share),
        index,
        step * (event.shiftKey ? 5 : 1)
      );
      state.auto = false;
      state.pieces.forEach((p, i) => (p.share = shares[i]));
      commit();
      barEl.querySelectorAll(".outfit-bar__handle")[index].focus();
    });
  }

  autoButton.addEventListener("click", () => {
    state.auto = true;
    commit();
  });

  // ----- Pieces -----

  function garmentOptions(selectedId) {
    return O.GARMENTS.map((g) => `<option value="${g.id}"${g.id === selectedId ? " selected" : ""}>${g.label}</option>`).join("");
  }

  addSelect.innerHTML = garmentOptions("shoes");

  function renderPieces() {
    const anchorAt = leadIndex();
    const rows = state.pieces.map((p, i) => {
      const li = document.createElement("li");
      li.className = "outfit-piece" + (i === selected ? " is-selected" : "") + (p.locked ? " is-locked" : "");
      li.innerHTML = `
        <button type="button" class="outfit-piece__swatch" style="background:${p.hex}" aria-label="Edit ${nameOf(p)} color" title="${colorName(p.hex)}${i === anchorAt ? " (anchor)" : ""}"></button>
        <select class="outfit-piece__garment" aria-label="Garment">${garmentOptions(p.garment)}</select>
        <label class="outfit-piece__share"><input type="number" min="1" max="99" value="${p.share}" aria-label="${nameOf(p)} share">%</label>
        <button type="button" class="outfit-piece__lock${p.locked ? " is-locked" : ""}" aria-pressed="${Boolean(p.locked)}" aria-label="Lock ${nameOf(p)} color" title="${p.locked ? "Locked: ideas build around this color and never change it" : "Lock this color so ideas never change it"}"><i class="ti ti-lock${p.locked ? "" : "-open"}" aria-hidden="true"></i><span>${p.locked ? "Locked" : "Lock"}</span></button>
        <button type="button" class="outfit-piece__remove" aria-label="Remove ${nameOf(p)}"${state.pieces.length < 2 ? " disabled" : ""}>&times;</button>`;
      li.addEventListener("click", (event) => {
        if (event.target.closest("select, input, .outfit-piece__remove, .outfit-piece__lock")) return;
        selected = i;
        render();
      });
      li.querySelector("select").addEventListener("change", (event) => {
        p.garment = event.target.value;
        selected = i;
        commit();
      });
      li.querySelector("input").addEventListener("change", (event) => {
        const shares = O.setShare(
          state.pieces.map((x) => x.share),
          i,
          Number(event.target.value) || 1
        );
        state.auto = false;
        state.pieces.forEach((x, k) => (x.share = shares[k]));
        selected = i;
        commit();
      });
      li.querySelector(".outfit-piece__lock").addEventListener("click", () => {
        p.locked = !p.locked;
        ideaVariant = 0;
        commit();
      });
      li.querySelector(".outfit-piece__remove").addEventListener("click", () => {
        state.pieces.splice(i, 1);
        const shares = O.toPercentages(state.pieces.map((x) => x.share));
        state.pieces.forEach((x, k) => (x.share = shares[k]));
        selected = Math.min(selected, state.pieces.length - 1);
        commit();
      });
      return li;
    });
    piecesEl.replaceChildren(...rows);
  }

  addButton.addEventListener("click", () => {
    const id = addSelect.value;
    const used = new Set(state.pieces.map((p) => p.hex));
    const hex = ["#b9b9b4", "#1f2a44", "#c3b091", "#3a3d40", "#f4f2ec"].find((h) => !used.has(h)) || "#8a8d8f";
    const weights = O.garmentWeights([...state.pieces.map((p) => p.garment), id]);
    const share = Math.round((weights[weights.length - 1] / weights.reduce((a, b) => a + b, 0)) * 100);
    state.pieces.push({ garment: id, hex, share: 1 });
    if (!state.auto) {
      const shares = O.setShare(
        state.pieces.map((p) => p.share),
        state.pieces.length - 1,
        share
      );
      state.pieces.forEach((p, i) => (p.share = shares[i]));
    }
    selected = state.pieces.length - 1;
    commit();
  });

  // ----- Figure -----

  function renderFigure() {
    const bySlot = {};
    state.pieces.forEach((p) => {
      const slot = O.garment(p.garment).slot;
      if (!bySlot[slot]) bySlot[slot] = p;
    });
    const top = bySlot.top;
    const outer = bySlot.outer;
    const bottom = bySlot.bottom;
    const shoes = bySlot.shoes;
    const isShorts = bottom && bottom.garment === "shorts";
    const isBoots = shoes && shoes.garment === "boots";
    const longSleeve = top && O.garment(top.garment).sleeve === "long";
    const isCoat = outer && outer.garment === "coat";
    const outerLong = outer && O.garment(outer.garment).sleeve === "long";

    const paint = (name, piece, visible = true) => {
      figure.querySelectorAll(`[data-region="${name}"]`).forEach((el) => {
        el.style.display = visible ? "" : "none";
        el.classList.toggle("is-empty", !piece);
        el.setAttribute("fill", piece ? piece.hex : "currentColor");
        el.dataset.piece = piece ? String(state.pieces.indexOf(piece)) : "";
        el.classList.toggle("is-selected", Boolean(piece) && piece === state.pieces[selected]);
      });
    };

    figure.querySelectorAll('[data-region="skin"]').forEach((el) => el.setAttribute("fill", state.skin));
    paint("top", top);
    paint("sleeve-long", top, Boolean(top && longSleeve));
    paint("sleeve-short", top, Boolean(top && !longSleeve));
    paint("outer", outer, Boolean(outer) && !isCoat);
    paint("coat", outer, Boolean(isCoat));
    paint("outer-sleeve", outer, Boolean(outerLong));
    paint("outer-sleeve-short", outer, Boolean(outer) && !outerLong);
    paint("bottom-long", bottom, !isShorts);
    paint("bottom-short", bottom, Boolean(isShorts));
    paint("socks", bySlot.socks, Boolean(bySlot.socks) && Boolean(isShorts));
    paint("shoes", shoes, !isBoots);
    paint("boots", shoes, Boolean(isBoots));
    paint("belt", bySlot.belt, Boolean(bySlot.belt));
    paint("hat", bySlot.hat, Boolean(bySlot.hat));
    paint("bag", bySlot.bag, Boolean(bySlot.bag));
    skinEl.querySelectorAll("button").forEach((b) => b.classList.toggle("is-selected", b.dataset.skin === state.skin));
  }

  figure.addEventListener("click", (event) => {
    const region = event.target.closest("[data-region]");
    if (!region || !region.dataset.piece) return;
    const index = Number(region.dataset.piece);
    if (state.pieces[index]) {
      selected = index;
      render();
    }
  });

  // ----- Notes -----

  function renderNotes() {
    const { notes } = O.analyzeOutfit(state.pieces.map((p) => ({ label: nameOf(p), hex: p.hex, share: p.share })));
    notesEl.replaceChildren(
      ...notes.map((note) => {
        const li = document.createElement("li");
        li.className = "outfit-note outfit-note--" + note.level;
        const title = document.createElement("strong");
        title.textContent = note.title;
        const body = document.createElement("span");
        body.textContent = note.text;
        li.append(title, body);
        return li;
      })
    );
  }

  // ----- Ideas -----

  function renderIdeas() {
    const locked = state.pieces.map((p, i) => (p.locked ? i : -1)).filter((i) => i >= 0);
    const base = state.pieces[O.ideaBaseIndex(state.pieces, locked)];
    const ideas = O.suggestOutfits(state.pieces, { locked, variant: ideaVariant });
    const describe = (p) => `${colorName(p.hex).toLowerCase()} ${nameOf(p).toLowerCase()}`;
    const others = locked.map((i) => state.pieces[i]).filter((p) => p !== base);
    const keeping = others.length ? ` Also keeping ${others.map(describe).join(", ")}.` : "";
    const lockTip = locked.length ? "" : " Lock pieces you can’t change and ideas will work around them.";
    ideasNote.textContent = ideas.length
      ? `Built around ${describe(base)}.${keeping} Click one to try it.${lockTip}`
      : locked.length === state.pieces.length
        ? "Every piece is locked. Unlock one to get ideas for it."
        : "Add a piece to get ideas.";
    moreButton.hidden = !ideas.length;
    ideasEl.replaceChildren(
      ...ideas.map((idea) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "outfit-idea";
        const bar = document.createElement("span");
        bar.className = "outfit-idea__bar";
        idea.hexes.forEach((hex, i) => {
          const seg = document.createElement("span");
          seg.style.flexBasis = state.pieces[i].share + "%";
          seg.style.background = hex;
          seg.title = `${nameOf(state.pieces[i])}: ${colorName(hex)}`;
          bar.append(seg);
        });
        const title = document.createElement("strong");
        title.textContent = idea.name;
        const body = document.createElement("span");
        body.className = "outfit-idea__text";
        body.textContent = idea.text;
        const tag = document.createElement("span");
        tag.className = "outfit-idea__tag";
        tag.textContent = idea.proven ? "Proven pairing" : "Color theory";
        button.append(bar, tag, title, body);
        button.addEventListener("click", () => {
          idea.hexes.forEach((hex, i) => (state.pieces[i].hex = hex));
          commit();
          setStatus("Applied " + idea.name.toLowerCase() + ".");
        });
        li.append(button);
        return li;
      })
    );
  }

  moreButton.addEventListener("click", () => {
    ideaVariant += 1;
    renderIdeas();
  });

  // ----- Saving -----

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SAVED)) || [];
    } catch (err) {
      return [];
    }
  }

  function writeSaved(list) {
    try {
      localStorage.setItem(STORAGE_SAVED, JSON.stringify(list));
      return true;
    } catch (err) {
      setStatus("This browser blocked saving.");
      return false;
    }
  }

  function miniBar(query) {
    const outfit = O.decodeOutfit(query);
    const bar = document.createElement("span");
    bar.className = "outfit-mini";
    if (outfit) {
      outfit.pieces.forEach((p) => {
        const seg = document.createElement("span");
        seg.style.flexBasis = p.share + "%";
        seg.style.background = p.hex;
        bar.append(seg);
      });
    }
    return bar;
  }

  function loadQuery(query, name) {
    const outfit = O.decodeOutfit(query);
    if (!outfit) return;
    outfit.skin = outfit.skin || state.skin;
    state = outfit;
    selected = 0;
    ideaVariant = 0;
    commit();
    setStatus("Loaded " + name + ".");
  }

  function outfitChip(item, onRemove) {
    const wrap = document.createElement("li");
    wrap.className = "outfit-chip";
    const load = document.createElement("button");
    load.type = "button";
    load.className = "outfit-chip__load";
    load.append(miniBar(item.query), document.createTextNode(item.name));
    load.addEventListener("click", () => loadQuery(item.query, item.name));
    wrap.append(load);
    if (onRemove) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "outfit-chip__remove";
      remove.setAttribute("aria-label", "Delete " + item.name);
      remove.innerHTML = "&times;";
      remove.addEventListener("click", onRemove);
      wrap.append(remove);
    }
    return wrap;
  }

  function renderSaved() {
    const list = readSaved();
    savedEl.replaceChildren(
      ...list.map((item, i) =>
        outfitChip(item, () => {
          const next = readSaved();
          next.splice(i, 1);
          writeSaved(next);
          renderSaved();
        })
      )
    );
    savedEl.hidden = !list.length;
  }

  examplesEl.replaceChildren(...EXAMPLES.map((item) => outfitChip(item)));

  saveButton.addEventListener("click", () => {
    const name = saveName.value.trim() || state.pieces.map((p) => colorName(p.hex) + " " + nameOf(p).toLowerCase()).join(", ");
    const list = readSaved().filter((item) => item.name !== name);
    list.unshift({ name, query: O.encodeOutfit(state) });
    if (writeSaved(list)) {
      saveName.value = "";
      setStatus("Saved " + name + ".");
      renderSaved();
    }
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus("Link copied.");
    } catch (err) {
      setStatus("Copy failed; the link is in the address bar.");
    }
  });

  // ----- Render -----

  function renderPanel() {
    const piece = state.pieces[selected];
    const hsv = O.hexToHsv(piece.hex);
    selectedLabel.innerHTML = `<span class="outfit-selected__dot" style="background:${piece.hex}"></span>${nameOf(piece)}: ${colorName(piece.hex)}`;
    valueInput.value = String(Math.round(hsv.v * 100));
    valueOut.textContent = valueInput.value;
    colorInput.value = piece.hex;
    if (document.activeElement !== hexInput) hexInput.value = piece.hex;
  }

  function render() {
    selected = Math.min(selected, state.pieces.length - 1);
    renderPanel();
    drawWheel();
    renderSuggestions();
    renderIdeas();
    renderBar();
    renderPieces();
    renderFigure();
    renderNotes();
  }

  window.addEventListener("hashchange", () => {
    const outfit = O.decodeOutfit(location.hash);
    if (outfit && O.encodeOutfit(outfit) !== O.encodeOutfit(state)) {
      outfit.skin = outfit.skin || state.skin;
      state = outfit;
      render();
    }
  });
  window.addEventListener("resize", () => {
    wheelCacheKey = null;
    drawWheel();
  });

  renderSaved();
  commit();
})();
