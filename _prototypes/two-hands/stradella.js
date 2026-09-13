/* Stradella data and geometry, separate from right-hand MIDI geometry. */
window.PrototypeStradella = (function () {
  "use strict";
  const M = window.Music;
  const mod = window.WorkbenchModel.mod;
  const roots = [9, 2, 7, 0];
  // Player-facing orientation: counterbass is nearest the hand, at the right.
  const columns = [
    { id: "d7", label: "Diminished seventh", short: "Dim. 7th" },
    { id: "7", label: "Seventh", short: "7th" },
    { id: "m", label: "Minor", short: "Minor" },
    { id: "M", label: "Major", short: "Major" },
    { id: "bass", label: "Bass", short: "Bass" },
    { id: "counter", label: "Counterbass", short: "Counter bass" },
  ];

  function layout(visibleRoots = roots) {
    return columns.flatMap((column, c) =>
      visibleRoots.map((root, r) => {
        const bass = column.id === "bass" || column.id === "counter";
        const pc = mod(root + (column.id === "counter" ? 4 : 0));
        const label =
          column.id === "counter" ? window.Tonal.Note.transpose(M.asciiNoteName(root), "3M").replace(/#/g, "♯").replace(/b/g, "♭") : M.noteName(pc);
        const notes = bass ? [pc] : window.StradellaData.BUTTONS[column.id].map((interval) => mod(root + interval));
        const chord = bass ? null : window.Tonal.Chord.get(M.asciiNoteName(root) + { M: "M", m: "m", 7: "7", d7: "dim7" }[column.id]);
        const spellings = notes.map((note) => (bass ? M.toAscii(label) : chord.notes.find((name) => window.Tonal.Note.chroma(name) === note)));
        const intervals = notes.map((note) =>
          bass ? "1" : M.formatInterval(chord.intervals[chord.notes.findIndex((name) => window.Tonal.Note.chroma(name) === note)])
        );
        return {
          id: column.id + "-" + root,
          kind: column.id,
          row: r,
          column: c,
          root: pc,
          notes,
          spellings,
          intervals,
          label,
          name: label + " " + column.label.toLowerCase(),
          // Demonstration registers only; real reed/register combinations vary.
          midis: bass ? [36 + pc] : notes.map((note) => 48 + note).sort((a, b) => a - b),
        };
      })
    );
  }

  function selected(model, visibleRoots = roots, choice = {}) {
    return window.PrototypeVoicings.resolve(model, visibleRoots, choice)?.leftIds || [];
  }

  function mount(container, model, visibleRoots = roots, choice = {}) {
    const chosen = selected(model, visibleRoots, choice);
    const cells = layout(visibleRoots);
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
                (chosen.includes(cell.id) && ["bass", "counter"].includes(cell.kind) && cell.root === model.root ? " is-root" : "") +
                '" data-left-id="' +
                cell.id +
                '" aria-label="Hear ' +
                M.esc(cell.name) +
                '"' +
                (chosen.includes(cell.id)
                  ? ' aria-description="' +
                    (["bass", "counter"].includes(cell.kind) && cell.root === model.root ? "Chord root. " : "") +
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

  function bind(container, handlers, visibleRoots = roots) {
    const cells = layout(visibleRoots);
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
