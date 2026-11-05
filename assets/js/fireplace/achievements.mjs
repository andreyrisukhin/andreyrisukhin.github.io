// Secret achievements. Each stays hidden until found; found ones are remembered
// in the browser when storage is available.
export const ACHIEVEMENTS = Object.freeze([
  { id: "kindled", title: "Kindled", text: "Lit the hearth with a match." },
  { id: "borrowed", title: "Borrowed flame", text: "Lit something from the candle." },
  { id: "torch", title: "Torchbearer", text: "Carried fire around the room." },
  { id: "books", title: "Fahrenheit 451", text: "The books caught fire." },
  { id: "floor", title: "This is fine", text: "The floor caught fire." },
  { id: "hiss", title: "Hiss", text: "Put out a flame with water." },
  { id: "bonfire", title: "Bonfire", text: "Had a dozen things burning at once." },
  { id: "fling", title: "Hot potato", text: "Threw something that was on fire." },
  { id: "timber", title: "Timber", text: "Burned a log until it broke in two." },
  { id: "ashes", title: "Ashes", text: "Let a fire burn all the way out on its own." },
  { id: "tea", title: "Tea time", text: "Boiled the mug of water over the fire." },
]);

export const STORAGE_KEY = "fireplace-achievements";
const TORCH_SECONDS = 4;
const BONFIRE = 12;

export function createAchievements(storage) {
  const found = new Set();
  try {
    for (const id of JSON.parse(storage?.getItem(STORAGE_KEY) || "[]")) if (ACHIEVEMENTS.some((entry) => entry.id === id)) found.add(id);
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  const fresh = [];
  let carried = 0;
  let lit = false;
  let watered = false;
  function unlock(id) {
    if (found.has(id)) return;
    found.add(id);
    fresh.push(ACHIEVEMENTS.find((entry) => entry.id === id));
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify([...found]));
    } catch {
      // Still found for this visit.
    }
  }
  return {
    found: () => ACHIEVEMENTS.filter((entry) => found.has(entry.id)),
    // Water was poured on this fire, so it did not burn out on its own.
    watered() {
      watered = true;
    },
    // events: from the fire since the last call; stats: the fire now; dt: seconds since the last call.
    // Returns what was newly found.
    observe(events, stats, dt) {
      for (const event of events) {
        if (event.type === "ignite") {
          if (event.source === "match" && event.inHearth) unlock("kindled");
          if (event.source === "candle") unlock("borrowed");
          if (event.kind === "book") unlock("books");
          // A newly started fire gets a fresh chance to burn out unaided.
          if (event.source !== "spread" && !lit) watered = false;
        } else if (event.type === "floor") unlock("floor");
        else if (event.type === "douse") unlock("hiss");
        else if (event.type === "fling") unlock("fling");
        else if (event.type === "split") unlock("timber");
        else if (event.type === "boil") unlock("tea");
      }
      carried = stats.heldBurning ? carried + dt : 0;
      if (carried >= TORCH_SECONDS) unlock("torch");
      if (stats.burning >= BONFIRE) unlock("bonfire");
      const burning = stats.burning + stats.floor > 0;
      if (burning) lit = true;
      else if (lit && stats.embers < 0.05 && !stats.coals) {
        if (!watered) unlock("ashes");
        lit = false;
        watered = false;
      }
      return fresh.splice(0);
    },
  };
}
