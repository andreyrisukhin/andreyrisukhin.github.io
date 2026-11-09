// Evaluate on any built music page at desktop and mobile sizes.
(() => {
  let checks = 0;
  const assert = (ok, label) => {
    if (!ok) throw new Error(label);
    checks++;
  };
  const nav = document.querySelector(".music-section-nav");
  const links = [...nav.querySelectorAll("a")];
  assert(links.map((link) => link.textContent.trim()).join(",") === "Music,Chords,Practice,Sheets,References", "Consistent navigation labels");
  assert(nav.querySelectorAll("[aria-current]").length === 1, "One current navigation item");
  assert(document.querySelectorAll("h1").length === 1, "One page title");
  for (const link of links) {
    const rect = link.getBoundingClientRect();
    assert(rect.left >= 0 && rect.right <= innerWidth, "Navigation stays inside the viewport");
    assert(rect.height >= 44, "Navigation has touch-sized targets");
    link.focus();
    assert(document.activeElement === link, "Navigation supports keyboard focus");
  }
  if (location.pathname.endsWith("/music/")) {
    const sections = [...document.querySelectorAll(".music-hub-section")];
    assert(
      sections.map((section) => section.querySelector("h2").textContent).join(",") === "Chords,Practice,Sheets,References",
      "Hub matches navigation"
    );
    const destinations = sections.flatMap((section) => [...section.querySelectorAll("a")].map((link) => link.pathname));
    assert(new Set(destinations).size === destinations.length, "Each destination appears once");
    assert(destinations.includes("/music/sheet/into-the-unknown/"), "Into the Unknown appears in sheet navigation");
    for (const link of links.slice(1)) {
      assert(document.querySelector(new URL(link.href).hash), "Section link resolves");
    }
    assert(document.documentElement.scrollWidth <= innerWidth, "Hub has no horizontal overflow");
  }
  links[0].blur();
  return { checks, width: innerWidth, path: location.pathname, result: "passed" };
})();
