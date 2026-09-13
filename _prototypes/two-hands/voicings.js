/* Practical left-hand choices. Chord identity and right-hand voicing stay separate. */
window.PrototypeVoicings = (function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const M = window.Music;
  const T = window.Tonal;
  const Left = window.PrototypeStradella;
  const pretty = (name) => name.replace(/b/g, "♭").replace(/#/g, "♯");
  const spell = (model, pc) => pretty(model.detail.notes.find((name) => T.Note.chroma(name) === pc) || M.asciiNoteName(pc));
  const isBass = (cell) => cell.kind === "bass" || cell.kind === "counter";

  function bassCell(cells, pc) {
    return cells.find((cell) => cell.kind === "bass" && cell.root === pc) || cells.find((cell) => cell.kind === "counter" && cell.root === pc);
  }

  function patterns(model) {
    if (!model.detail || model.suffix == null) return [];
    const result = [];
    const conventional = { "": "M", M: "M", m: "m", 7: "7", dim7: "d7", "°7": "d7" }[model.suffix];
    if (conventional) result.push({ id: "standard", label: "Standard button", parts: [conventional + "-" + model.root], conventional: true });
    window.StradellaData.findBySuffix(window.ChordName.normalizeSuffix(model.suffix)).forEach((entry) => {
      if (!entry.recipe || entry.bug || entry.recipe.rh != null) return;
      const parts = entry.recipe.parts.map((part) => part.qual + "-" + Model.mod(model.root + part.note));
      if (result.some((option) => option.parts.join() === parts.join())) return;
      result.push({
        id: "catalog-" + entry.id,
        label: conventional ? "Fuller with root bass" : result.length ? "Catalog alternative" : "Conventional",
        parts,
      });
    });
    if (["m7", "maj7"].includes(model.suffix) && result.length) {
      const rootButton = (model.suffix === "m7" ? "m" : "M") + "-" + model.root;
      const parts = [...new Set([rootButton, ...result[0].parts])];
      if (parts.length > result[0].parts.length) result.push({ id: "stacked", label: "Stacked buttons", parts });
    }
    return result;
  }

  function basses(model, visibleRoots = Left.roots) {
    const cells = Left.layout(visibleRoots);
    return (model.detail?.notes || []).map((name, index) => {
      const pc = T.Note.chroma(name);
      const position = ["Root position", "First inversion", "Second inversion", "Third inversion"][index] || "Chord-tone bass";
      return { pc, label: pretty(name) + " · " + position, available: !!bassCell(cells, pc) };
    });
  }

  function build(model, cells, pattern, bass) {
    const bottom = bassCell(cells, bass);
    const parts = pattern.parts.map((id) => cells.find((cell) => cell.id === id && !isBass(cell)));
    if (!bottom || parts.some((part) => !part)) return null;
    const notes = [...new Set([bass, ...parts.flatMap((part) => part.notes)])];
    const extra = notes.filter((pc) => !model.notes.includes(pc));
    if (extra.length) return null;
    const missing = model.notes.filter((pc) => !notes.includes(pc));
    const diminished = ["dim7", "°7"].includes(model.suffix);
    const fifth = Model.mod(model.root + (diminished ? 6 : 7));
    const omittedFifth = pattern.conventional && (model.suffix === "7" || diminished) && missing.length === 1 && missing[0] === fifth;
    const detail = ["Left-hand tones: " + notes.map((pc) => spell(model, pc)).join(" · ") + "."];
    if (omittedFifth) detail.push(spell(model, fifth) + (diminished ? " (diminished fifth)" : " (fifth)") + " omitted, standard Stradella voicing.");
    else if (missing.length) detail.push(missing.map((pc) => spell(model, pc)).join(", ") + " supplied by the right hand.");
    else detail.push("All chord tones present.");
    return {
      choice: { voicing: pattern.id, bass },
      leftIds: [bottom.id, ...parts.map((part) => part.id)],
      // Shared reeds do not sound twice when two chord buttons contain the same note.
      midis: [...new Set([bottom, ...parts].flatMap((cell) => cell.midis))],
      notes,
      missing,
      omittedFifth: !!omittedFifth,
      recipe: [bottom, ...parts].map((cell) => cell.name).join(" + "),
      detail: detail.join(" "),
    };
  }

  function options(model, visibleRoots = Left.roots, bass = model.notes[0]) {
    const cells = Left.layout(visibleRoots);
    const validBass = basses(model, visibleRoots).some((item) => item.pc === bass && item.available);
    return patterns(model).map((pattern) => ({
      ...pattern,
      available: validBass && !!build(model, cells, pattern, bass),
    }));
  }

  function resolve(model, visibleRoots = Left.roots, choice = {}) {
    const bass = choice.bass ?? model.notes[0];
    const choices = options(model, visibleRoots, bass);
    const pattern = choice.voicing ? choices.find((item) => item.id === choice.voicing && item.available) : choices.find((item) => item.available);
    return pattern ? build(model, Left.layout(visibleRoots), pattern, bass) : null;
  }

  return { patterns, basses, options, resolve };
})();
