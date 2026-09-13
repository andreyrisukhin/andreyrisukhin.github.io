(function () {
  "use strict";
  const Model = window.WorkbenchModel;
  const M = window.Music;
  const Inspector = window.PrototypeChordInspector;
  const Left = window.PrototypeStradella;
  const Player = window.WorkbenchPlayer;
  const $ = (id) => document.getElementById(id);
  const model = Model.fromName("Am7");
  const voices = Model.voices(model);
  const cells = Left.layout();
  const chosen = Left.selected(model);
  let hover = null,
    focus = null,
    pinned = null,
    playing = false,
    generation = 0;

  Inspector.render(model);
  Left.mount($("left-keyboard"), model);

  function describe(cell) {
    if (!cell) return "Point to a left-hand button to see its notes.";
    const outside = cell.notes.filter((pc) => !model.notes.includes(pc));
    const spell = (pc) => (pc === cell.root ? cell.label : M.noteName(pc));
    return (
      cell.name +
      ": " +
      cell.notes.map(spell).join(" · ") +
      ". " +
      (outside.length ? outside.map(spell).join(", ") + " outside Am7." : "All of these tones belong to Am7.")
    );
  }

  function link() {
    const cell = hover || focus || pinned;
    const notes = cell ? cell.notes : [];
    document.querySelectorAll(".hand-key").forEach((button) => button.classList.toggle("is-linked", button.dataset.leftId === cell?.id));
    document
      .querySelectorAll("#keyboard [data-pc], #staff [data-pc]")
      .forEach((note) => note.classList.toggle("is-linked", notes.includes(+note.dataset.pc)));
    document.querySelectorAll(".tone").forEach((tone, i) => tone.classList.toggle("is-linked", notes.includes(voices[i].pc)));
    $("button-detail").textContent = describe(cell);
    return cell;
  }

  function leftCell(target) {
    const button = target.closest("[data-left-id]");
    return button && $("left-keyboard").contains(button) ? cells.find((cell) => cell.id === button.dataset.leftId) : null;
  }
  function clearLink() {
    hover = focus = pinned = null;
    $("button-status").textContent = describe(link());
  }
  $("left-keyboard").addEventListener("pointerover", (event) => {
    hover = leftCell(event.target);
    link();
  });
  $("left-keyboard").addEventListener("pointerleave", () => {
    hover = null;
    link();
  });
  $("left-keyboard").addEventListener("focusin", (event) => {
    hover = null;
    focus = leftCell(event.target);
    $("button-status").textContent = describe(link());
  });
  $("left-keyboard").addEventListener("focusout", (event) => {
    focus = event.relatedTarget ? leftCell(event.relatedTarget) : null;
    link();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    Player.stop();
    clearLink();
  });

  Player.onStop(() => {
    generation++;
    playing = false;
    document.querySelectorAll(".is-sounding").forEach((el) => el.classList.remove("is-sounding"));
    $("play-label").textContent = "Hear both hands";
    $("play").removeAttribute("aria-label");
  });

  async function play(midis, leftIds, rightMidis, pitchClasses) {
    $("audio-status").hidden = true;
    const result = Player.play([midis], {
      onStep: () => {
        document.querySelectorAll(".hand-key").forEach((button) => button.classList.toggle("is-sounding", leftIds.includes(button.dataset.leftId)));
        document
          .querySelectorAll("#keyboard [data-midi]")
          .forEach((note) => note.classList.toggle("is-sounding", rightMidis.includes(+note.dataset.midi)));
        document
          .querySelectorAll("#staff [data-pc]")
          .forEach((note) => note.classList.toggle("is-sounding", pitchClasses.includes(+note.dataset.pc)));
      },
      onError: (message) => {
        $("audio-status").textContent = message;
        $("audio-status").hidden = false;
      },
    });
    const ticket = ++generation;
    playing = true;
    $("play-label").textContent = "Stop";
    $("play").setAttribute("aria-label", "Stop playback");
    if (!(await result) && ticket === generation) Player.stop();
  }

  Left.bind($("left-keyboard"), {
    onActivate: (cell) => {
      pinned = cell;
      hover = null;
      focus = cell;
      $("button-status").textContent = describe(link());
      // Left-hand audio uses demonstration registers. Right-hand outlines are
      // a pitch-class link, not a claim that those high notes are sounding.
      play(cell.midis, [cell.id], [], cell.notes);
    },
  });
  Inspector.bind((midi) => {
    clearLink();
    play([midi], [], [midi], [midi % 12]);
  });
  $("play").addEventListener("click", () => {
    if (playing) {
      Player.stop();
      return;
    }
    clearLink();
    const leftMidis = chosen.flatMap((id) => cells.find((cell) => cell.id === id).midis);
    const rightMidis = voices.map((voice) => voice.midi);
    play([...leftMidis, ...rightMidis], chosen, rightMidis, model.notes);
  });
  $("theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    $("theme").setAttribute("aria-pressed", String(dark));
  });
})();
