// Use only in an isolated browser. Set window.musicConsolidationStage before
// evaluating: setup (writes synthetic fixtures), default, library, study, setlist, chart, or tools.
(() => {
  const stage = window.musicConsolidationStage || "tools";
  let checks = 0;
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
    checks++;
  };
  const $ = (id) => document.getElementById(id);
  if (stage === "setup") {
    const chord = WorkbenchModel.entry(WorkbenchModel.fromNotes([4, 0, 7]));
    const study = [{ name: "<Study>", chords: [chord], mode: "progression", bpm: 123, key: 9, keyMode: "minor", loop: true, gap: 1 }];
    const songs = [
      {
        id: "compat-song",
        name: "<Set list>",
        savedAt: "2026-01-01T00:00:00Z",
        syncedAt: "2026-01-02T00:00:00Z",
        syncSha: "preserve-me",
        snapshot: {
          tool: "stradella",
          catalogKey: 9,
          selected: [
            { id: "maj", key: 0, bass: 4, beats: 3, label: "Verse" },
            { id: "m7", key: 9, beats: 3 },
          ],
          bpm: 137,
          meter: 3,
          voice: "guitar",
          gridView: true,
          hasDim7: false,
          show: { recipe: false, notes: true },
        },
      },
    ];
    localStorage.setItem("musicWorkbenchSetlist", JSON.stringify(study));
    localStorage.setItem("stradella-songs", JSON.stringify(songs));
    localStorage.setItem(
      "consolidationTestFixtures",
      JSON.stringify({
        study: localStorage.getItem("musicWorkbenchSetlist"),
        songs: localStorage.getItem("stradella-songs"),
      })
    );
    return { stage, result: "seeded synthetic data" };
  }
  if (stage === "default") {
    assert(!$("workspace-study").hidden && $("workspace-setlist").hidden, "Progression opens without a mode choice");
    assert($("hear-progression").checkVisibility() && $("composer-bpm").checkVisibility(), "Primary playback and tempo remain visible");
    assert($("sequence").checkVisibility() && $("staff").checkVisibility(), "Editable progression and selected notes remain visible");
    assert($("left-keyboard").checkVisibility() && $("keyboard").checkVisibility(), "Both bayan diagrams remain visible");
    for (const id of [
      "workspace-study-button",
      "workspace-setlist-button",
      "key-tonic",
      "composer-loop",
      "voicing",
      "tab-key",
      "function-listening",
    ]) {
      assert(!$(id).checkVisibility(), "Specialist control is disclosed: " + id);
    }
    const primary = [...document.querySelectorAll("#workbench-composer button")].filter(
      (button) => button.checkVisibility() && !button.closest("#sequence, #keyboard, #left-keyboard")
    );
    assert(primary.length === 2, "Only Play and Stop are exposed outside the progression and instrument");
    assert(!$("song-charts"), "Chart chooser lives only in Song library");
    assert(!WorkbenchPlayer.isPlaying(), "Default does not autoplay");
    assert(document.documentElement.scrollWidth <= innerWidth, "Default has no horizontal overflow");
    return { stage, checks, width: innerWidth, result: "passed" };
  }
  const fixtures = JSON.parse(localStorage.getItem("consolidationTestFixtures"));
  if (stage === "library") {
    assert(document.querySelectorAll("#songs-list .songs-card").length === 2, "Library shows both save types");
    assert($("songs-list").textContent.includes("<Study>") && $("songs-list").textContent.includes("<Set list>"), "Labels render as text");
    assert(!$("songs-list").querySelector("study, set"), "Saved labels cannot create elements");
    const hrefs = [...document.querySelectorAll("#songs-list a")].map((link) => link.getAttribute("href"));
    assert(
      hrefs.some((href) => href.includes("?practice=0")),
      "Study opens in Workbench"
    );
    assert(
      hrefs.some((href) => href.includes("song=compat-song")),
      "Set list opens in Workbench"
    );
    assert($("song-charts").querySelectorAll(".song-chart").length === 2, "Charts render in Song library");
    assert(!$("songs-library-status").textContent, "Both original stores are readable");
  } else if (stage === "study") {
    assert(!$("workspace-study").hidden && $("workspace-setlist").hidden, "Study opens the correct workspace");
    const draft = JSON.parse(localStorage.getItem("musicWorkbenchDraft"));
    assert(draft.documents.progression.items[0].notes.join(",") === "4,0,7", "Named study keeps exact bass and pitch order");
    assert($("composer-bpm").value === "123" && $("composer-loop").checked, "Named study keeps tempo and loop");
    assert($("key-tonic").value === "A" && $("key-mode").value === "minor", "Named study keeps minor analysis");
    assert(!new URL(location.href).searchParams.has("practice"), "Library load is consumed once");
  } else if (stage === "setlist") {
    assert($("workspace-study").hidden && !$("workspace-setlist").hidden, "Set list opens the correct workspace");
    const expected = JSON.parse(fixtures.songs)[0].snapshot;
    const actual = StradellaTool.getSnapshot();
    assert(JSON.stringify(actual.selected) === JSON.stringify(expected.selected), "Legacy song retains recipes, bass, beats, and labels");
    assert(actual.bpm === 137 && actual.meter === 3 && actual.voice === "guitar", "Legacy song retains tempo, meter, and voice");
    assert(!$("stradella-dim7-check").checked && $("stradella-voice").value === "guitar", "Saved controls match their state");
    assert(actual.gridView && $("stradella-view-toggle").textContent === "Family view", "Saved catalog view is restored");
    assert($("stradella-setlist").classList.contains("is-waltz"), "Three-beat chart layout survives loading");
    assert(!new URL(location.href).searchParams.has("song"), "Named song load is consumed once");
    const scratch = localStorage.getItem("stradella-setlist");
    const draft = localStorage.getItem("musicWorkbenchDraft");
    $("workspace-study-button").click();
    assert(!$("workspace-study").hidden && $("workspace-setlist").hidden, "Switch to Study");
    $("workspace-setlist-button").click();
    assert($("workspace-study").hidden && !$("workspace-setlist").hidden, "Switch back to Set list");
    assert(
      localStorage.getItem("stradella-setlist") === scratch && localStorage.getItem("musicWorkbenchDraft") === draft,
      "Switching does not rewrite either document"
    );
  } else if (stage === "chart") {
    assert(!$("workspace-setlist").hidden && $("workspace-study").hidden, "Library chart opens compatible timed editor");
    const loaded = StradellaTool.getSnapshot();
    const expected = SongCharts.snapshotFor(SongChartData, "rises-the-moon", "ending", "0");
    assert(JSON.stringify(loaded.selected) === JSON.stringify(expected.selected), "Chart keeps exact notes, bass, beats, and section labels");
    assert(loaded.meter === 3 && loaded.bpm === 137, "Chart keeps 3/4 meter and tempo");
    assert(!new URL(location.href).searchParams.has("chart"), "Chart import is consumed once");
    $("chart-undo").click();
    assert(JSON.stringify(StradellaTool.getSnapshot()) === sessionStorage.getItem("chartPrevious"), "Undo restores the entire timed draft");
  } else if (stage === "tools") {
    $("workspace-setlist-button").click();
    const before = StradellaTool.getSnapshot().selected.length;
    $("chord-search-input").value = "A-7/G";
    $("chord-search-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const added = StradellaTool.getSnapshot().selected;
    assert(added.length === before + 1 && added.at(-1).bass === 7, "Typed slash chord enters the shared set list");
    $("recognizer-text-input").value = "E G C";
    $("recognizer-text-input").dispatchEvent(new Event("input", { bubbles: true }));
    assert($("recognizer-result").textContent.includes("C"), "Embedded recognition names selected notes");
    assert($("stradella-catalog").querySelectorAll("[data-id]").length > 20, "Embedded recipe catalog renders");
    assert(!$("song-charts"), "Charts no longer crowd Workbench");
    sessionStorage.setItem("chartPrevious", JSON.stringify(StradellaTool.getSnapshot()));
    assert($("stradella-share-text").value.includes("/music/workbench/?workspace=setlist#load="), "New set-list links target Workbench");
  } else {
    throw new Error("Unknown test stage: " + stage);
  }
  assert(localStorage.getItem("musicWorkbenchSetlist") === fixtures.study, "Saved studies remain byte-for-byte intact");
  assert(localStorage.getItem("stradella-songs") === fixtures.songs, "Saved songs and sync metadata remain byte-for-byte intact");
  if ($("stradella-play")) assert($("stradella-play").textContent.includes("Play"), "Set list does not autoplay");
  if (window.WorkbenchPlayer) assert(!WorkbenchPlayer.isPlaying(), "Study does not autoplay");
  assert(document.documentElement.scrollWidth <= innerWidth, "No document overflow");
  return { stage, checks, width: innerWidth, result: "passed" };
})();
