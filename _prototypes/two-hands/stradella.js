/* Stradella data and geometry, separate from right-hand MIDI geometry. */
window.PrototypeStradella = (function () {
  "use strict";
  const M = window.Music;
  const mod = window.WorkbenchModel.mod;
  const roots = [0, 7, 2, 9];
  // Player-facing orientation: counterbass is nearest the hand, at the right.
  const columns = [
    { id: "d7", label: "Diminished seventh", short: "Dim. 7th" },
    { id: "7", label: "Seventh", short: "7th" },
    { id: "m", label: "Minor", short: "Minor" },
    { id: "M", label: "Major", short: "Major" },
    { id: "bass", label: "Bass", short: "Bass" },
    { id: "counter", label: "Counterbass", short: "Counter bass" },
  ];

  function layout() {
    return columns.flatMap((column, c) =>
      roots.map((root, r) => {
        const bass = column.id === "bass" || column.id === "counter";
        const pc = mod(root + (column.id === "counter" ? 4 : 0));
        const label =
          column.id === "counter" ? window.Tonal.Note.transpose(M.asciiNoteName(root), "3M").replace(/#/g, "♯").replace(/b/g, "♭") : M.noteName(pc);
        const notes = bass ? [pc] : window.StradellaData.BUTTONS[column.id].map((interval) => mod(root + interval));
        return {
          id: column.id + "-" + root,
          kind: column.id,
          row: r,
          column: c,
          root: pc,
          notes,
          label,
          name: label + " " + column.label.toLowerCase(),
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
    const bass = cells.find((cell) => cell.kind === "bass" && cell.root === recipe.bass);
    const parts = recipe.parts.map((part) =>
      cells.find(
        (cell) =>
          cell.kind !== "bass" &&
          cell.kind !== "counter" &&
          cell.notes.length === part.notes.length &&
          cell.notes.every((note) => part.notes.includes(note))
      )
    );
    if (!bass || parts.some((part) => !part)) return [];
    return [bass.id, ...parts.map((part) => part.id)];
  }

  function mount(container, model) {
    const chosen = selected(model);
    const cells = layout();
    container.innerHTML = columns
      .map(
        (column, c) =>
          '<div class="stradella-column" style="--column:' +
          c +
          '"><span class="column-label" aria-hidden="true">' +
          M.esc(column.short) +
          '</span><div class="column-buttons" role="group" aria-label="' +
          M.esc(column.label) +
          '">' +
          cells
            .filter((cell) => cell.column === c)
            .map(
              (cell) =>
                '<button type="button" class="hand-key' +
                (chosen.includes(cell.id) ? " is-selected" : "") +
                (chosen.includes(cell.id) && cell.kind === "bass" && cell.root === model.root ? " is-root" : "") +
                '" data-left-id="' +
                cell.id +
                '" aria-label="Hear ' +
                M.esc(cell.name) +
                '"' +
                (chosen.includes(cell.id)
                  ? ' aria-description="' +
                    (cell.kind === "bass" && cell.root === model.root ? "Chord root. " : "") +
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
  return { roots, columns, layout, selected, mount, bind };
})();
