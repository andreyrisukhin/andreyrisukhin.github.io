/* Stradella data and geometry, separate from right-hand MIDI geometry. */
window.PrototypeStradella = (function () {
  "use strict";
  const M = window.Music;
  const mod = window.WorkbenchModel.mod;
  const columns = [0, 7, 2, 9];
  const rows = [
    { id: "counter", label: "Counterbass" },
    { id: "bass", label: "Bass" },
    { id: "M", label: "Major" },
    { id: "m", label: "Minor" },
    { id: "7", label: "Seventh" },
    { id: "d7", label: "Diminished" },
  ];

  function layout() {
    return rows.flatMap((row, r) =>
      columns.map((root, c) => {
        const bass = r < 2;
        const pc = mod(root + (row.id === "counter" ? 4 : 0));
        const label =
          row.id === "counter" ? window.Tonal.Note.transpose(M.asciiNoteName(root), "3M").replace(/#/g, "♯").replace(/b/g, "♭") : M.noteName(pc);
        const notes = bass ? [pc] : window.StradellaData.BUTTONS[row.id].map((interval) => mod(root + interval));
        return {
          id: row.id + "-" + root,
          row: r,
          column: c,
          root: pc,
          notes,
          label,
          name: label + " " + row.label.toLowerCase(),
          // Demonstration registers only; real reed/register combinations vary.
          midis: bass ? [36 + pc] : notes.map((note) => 48 + note).sort((a, b) => a - b),
        };
      })
    );
  }

  function selected(model) {
    const recipe = window.WorkbenchModel.recipes(model).find((item) => item.exact);
    if (!recipe) return [];
    const cells = layout();
    const bass = cells.find((cell) => cell.row === 1 && cell.root === recipe.bass);
    const parts = recipe.parts.map((part) =>
      cells.find((cell) => cell.row >= 2 && cell.notes.length === part.notes.length && cell.notes.every((note) => part.notes.includes(note)))
    );
    if (!bass || parts.some((part) => !part)) return [];
    return [bass.id, ...parts.map((part) => part.id)];
  }

  function mount(container, model) {
    const chosen = selected(model);
    const cells = layout();
    container.innerHTML = rows
      .map(
        (row, r) =>
          '<div class="stradella-row" style="--row:' +
          r +
          '"><span class="row-label">' +
          M.esc(row.label) +
          '</span><div class="row-buttons" role="group" aria-label="' +
          M.esc(row.label) +
          '">' +
          cells
            .filter((cell) => cell.row === r)
            .map(
              (cell) =>
                '<button type="button" class="hand-key' +
                (chosen.includes(cell.id) ? " is-selected" : "") +
                (chosen.includes(cell.id) && cell.row === 1 && cell.root === model.root ? " is-root" : "") +
                '" data-left-id="' +
                cell.id +
                '" aria-label="Hear ' +
                M.esc(cell.name) +
                '"' +
                (chosen.includes(cell.id)
                  ? ' aria-description="' +
                    (cell.row === 1 && cell.root === model.root ? "Chord root. " : "") +
                    'Part of the displayed left-hand recipe"'
                  : "") +
                "><span>" +
                M.esc(cell.label) +
                "</span></button>"
            )
            .join("") +
          "</div></div>"
      )
      .join("");
  }

  function bind(container, handlers) {
    const cells = layout();
    function cellFor(target) {
      const button = target.closest("[data-left-id]");
      return button && container.contains(button) ? cells.find((cell) => cell.id === button.dataset.leftId) : null;
    }
    container.addEventListener("click", (event) => {
      const cell = cellFor(event.target);
      if (cell) handlers.onActivate(cell);
    });
    container.addEventListener("keydown", (event) => {
      const cell = cellFor(event.target);
      if (!cell) return;
      const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
      if (!delta) return;
      event.preventDefault();
      const next = cells.find((candidate) => candidate.row === cell.row + delta[0] && candidate.column === cell.column + delta[1]);
      if (next) container.querySelector('[data-left-id="' + next.id + '"]').focus();
    });
  }
  return { columns, rows, layout, selected, mount, bind };
})();
