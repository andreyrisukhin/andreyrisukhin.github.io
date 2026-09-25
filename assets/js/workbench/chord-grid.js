/* Inline chord tiles. Empty cells are layout space, never implied rests. */
window.ChordGrid = {
  mount(root, options) {
    "use strict";
    const esc = window.Music.esc;
    const pretty = (text) => text.replace(/#/g, "♯").replace(/b/g, "♭");
    let chords = [],
      selected = 0,
      rows = 2,
      draft = null,
      dragging = null;
    const cellFor = (cell) => chords.findIndex((chord) => chord.gridCell === cell);
    const tile = (cell) => root.querySelector('[data-grid-cell="' + cell + '"]');
    const primary = (cell) => tile(cell)?.querySelector(".sequence-card, .grid-empty");
    const columns = () => getComputedStyle(root).gridTemplateColumns.split(" ").length;
    function error(message = "") {
      options.error.textContent = message;
      options.error.hidden = !message;
      const input = root.querySelector("input");
      if (input) input.setAttribute("aria-invalid", String(!!message));
    }
    function render(next = chords, index = selected) {
      const input = root.querySelector("input");
      const focused = root.contains(document.activeElement);
      const active = document.activeElement.closest("[data-grid-cell]")?.dataset.gridCell;
      const editFocused = document.activeElement === input;
      const selection = input ? [input.selectionStart, input.selectionEnd] : null;
      if (input && draft) draft.value = input.value;
      chords = next;
      selected = index;
      const last = Math.max(-1, ...chords.map((chord) => chord.gridCell), draft?.cell ?? -1);
      rows = Math.min(64, Math.max(rows, Math.floor(last / 4) + 2));
      root.innerHTML = Array.from({ length: rows * 4 }, (_, cell) => {
        const index = cellFor(cell);
        const chord = chords[index];
        const label = chord ? options.describe(chord, index) : "";
        let content;
        if (draft?.cell === cell) {
          content =
            '<form class="grid-draft"><label class="sr-only" for="grid-chord-input">' +
            (chord ? "Edit chord" : "New chord") +
            " in cell " +
            (cell + 1) +
            "</label>" +
            '<input id="grid-chord-input" name="chord" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80"' +
            ' aria-describedby="grid-help grid-error" aria-invalid="' +
            String(!!options.error.textContent) +
            '" value="' +
            esc(draft.value) +
            '" placeholder="e.g. Dm7">' +
            '<span class="grid-beats">4 beats</span><div class="grid-draft-actions"><button type="submit">' +
            (chord ? "Save" : "Add") +
            '</button><button type="button" data-grid-cancel>Cancel</button></div></form>';
        } else if (chord) {
          content =
            '<button type="button" draggable="true" class="sequence-card" data-step="' +
            index +
            '"' +
            (index === selected ? ' aria-current="step"' : "") +
            ' aria-label="' +
            esc("Step " + (index + 1) + ": " + chord.name + ", " + label + ", 4 beats") +
            '">' +
            '<span class="name">' +
            esc(pretty(chord.name)) +
            '</span><span class="degree">' +
            esc(label) +
            '</span><span class="grid-beats">4 beats</span></button>' +
            '<button type="button" class="grid-edit" data-grid-edit="' +
            cell +
            '" aria-label="Edit ' +
            esc(chord.name) +
            '">Edit</button>';
        } else {
          content =
            '<button type="button" class="grid-empty" data-grid-open="' +
            cell +
            '" aria-label="Type a chord in cell ' +
            (cell + 1) +
            '"><span aria-hidden="true">+</span><span>Type chord</span></button>';
        }
        return '<div class="chord-grid-cell" data-grid-cell="' + cell + '">' + content + "</div>";
      }).join("");
      options.more.disabled = rows >= 64;
      if (editFocused && draft) {
        const nextInput = root.querySelector("input");
        nextInput.focus({ preventScroll: true });
        if (selection) nextInput.setSelectionRange(...selection);
      } else if (focused && active !== undefined) primary(Number(active))?.focus({ preventScroll: true });
    }
    function cancel(focus = true) {
      if (!draft) return false;
      const cell = draft.cell;
      draft = null;
      error();
      render();
      if (focus) primary(cell)?.focus({ preventScroll: true });
      return true;
    }
    function open(cell, initial) {
      if (draft && draft.cell !== cell && !commit(false)) return;
      options.onStart(cell);
      const chord = chords[cellFor(cell)];
      draft = { cell, value: initial ?? chord?.name ?? "" };
      error();
      render();
      const input = root.querySelector("input");
      input.focus({ preventScroll: true });
      if (initial === undefined) input.select();
      else input.setSelectionRange(input.value.length, input.value.length);
      tile(cell).scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    function commit(advance) {
      if (!draft) return true;
      const value = root.querySelector("input")?.value.trim() || "";
      if (!value) {
        cancel();
        return true;
      }
      const chord = window.WorkbenchModel.fromName(value);
      if (!chord) {
        error("Use one chord name, such as Dm7, G7 or C/E.");
        return false;
      }
      const current = { ...draft, value };
      draft = null;
      if (!options.onCommit(current.cell, chord)) {
        draft = current;
        render();
        error("The progression is full. Remove a chord before adding another.");
        root.querySelector("input")?.focus();
        return false;
      }
      error();
      if (advance) {
        let cell = current.cell + 1;
        while (cell < 256 && cellFor(cell) >= 0) cell++;
        if (cell < 256) open(cell);
        else primary(current.cell)?.focus();
      } else primary(current.cell)?.focus({ preventScroll: true });
      return true;
    }
    root.addEventListener("submit", (event) => {
      event.preventDefault();
      commit(true);
    });
    root.addEventListener("input", () => {
      if (draft) {
        draft.value = root.querySelector("input").value;
        error();
      }
    });
    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-grid-cancel]")) {
        event.stopPropagation();
        cancel();
        return;
      }
      const button = event.target.closest("[data-grid-open], [data-grid-edit]");
      if (button) {
        event.stopPropagation();
        open(Number(button.dataset.gridOpen ?? button.dataset.gridEdit));
      }
    });
    root.addEventListener("dblclick", (event) => {
      const cell = event.target.closest(".sequence-card")?.closest("[data-grid-cell]");
      if (cell) {
        event.preventDefault();
        open(Number(cell.dataset.gridCell));
      }
    });
    root.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.target.matches("input")) {
        event.stopPropagation();
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.target.value && cellFor(draft.cell) < 0) {
          event.preventDefault();
          cancel();
          options.onHistory(event.shiftKey ? "redo" : "undo");
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
        if (event.key === "Tab" && !event.shiftKey && event.target.value.trim()) {
          event.preventDefault();
          commit(true);
        }
        return;
      }
      if (event.target.closest(".grid-draft")) return;
      const cell = Number(event.target.closest("[data-grid-cell]")?.dataset.gridCell);
      if (!Number.isInteger(cell)) return;
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns(), ArrowUp: -columns() }[event.key];
      if (delta) {
        event.preventDefault();
        const next = cell + delta;
        if (next < 0 || next >= 256) return;
        if (event.shiftKey && cellFor(cell) >= 0) {
          if (!commit(false)) return;
          options.onMove(cellFor(cell), next);
          primary(next)?.focus({ preventScroll: true });
        } else {
          if (next >= rows * 4) {
            rows++;
            render();
          }
          primary(next)?.focus();
        }
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (cellFor(cell) < 0 || !commit(false)) return;
        event.preventDefault();
        options.onRemove(cellFor(cell));
        primary(cell)?.focus({ preventScroll: true });
      } else if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        open(cell);
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[A-Ga-g]$/.test(event.key)) {
        event.preventDefault();
        open(cell, event.key);
      }
    });
    root.addEventListener("dragstart", (event) => {
      const button = event.target.closest(".sequence-card");
      if (!button || draft) {
        event.preventDefault();
        return;
      }
      dragging = Number(button.dataset.step);
      options.onStart(chords[dragging].gridCell);
      event.dataTransfer.setData("text/plain", String(dragging));
      event.dataTransfer.effectAllowed = "move";
    });
    root.addEventListener("dragover", (event) => {
      if (dragging === null) return;
      event.preventDefault();
      root.querySelector(".is-drop-target")?.classList.remove("is-drop-target");
      event.target.closest("[data-grid-cell]")?.classList.add("is-drop-target");
      event.dataTransfer.dropEffect = "move";
    });
    root.addEventListener("drop", (event) => {
      const target = event.target.closest("[data-grid-cell]");
      if (dragging === null || !target) return;
      event.preventDefault();
      const cell = Number(target.dataset.gridCell);
      options.onMove(dragging, cell);
      primary(cell)?.focus({ preventScroll: true });
      dragging = null;
      root.querySelector(".is-drop-target")?.classList.remove("is-drop-target");
    });
    root.addEventListener("dragend", () => {
      dragging = null;
      root.querySelector(".is-drop-target")?.classList.remove("is-drop-target");
    });
    options.more.addEventListener("click", () => {
      if (rows >= 64) return;
      if (!commit(false)) return;
      rows++;
      render();
      open((rows - 1) * 4);
    });
    return {
      render,
      commit: () => commit(false),
      cancel,
      open,
      get editing() {
        return !!draft;
      },
      get dirty() {
        return !!draft && (root.querySelector("input")?.value.trim() || "") !== (chords[cellFor(draft.cell)]?.name || "");
      },
    };
  },
};
