// Development-only font comparison for blog posts. Add ?font=<name> to a post
// URL to set the title, headings, captions, and body in another face.
(function () {
  const FONTS = {
    charter: { stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
    roboto: { stack: '"Roboto", sans-serif', google: "Roboto:ital,wght@0,400;0,700;1,400" },
    nunito: { stack: '"Nunito", sans-serif', google: "Nunito:ital,wght@0,400;0,700;1,400" },
    "nunito-sans": { stack: '"Nunito Sans", sans-serif', google: "Nunito+Sans:ital,wght@0,400;0,700;1,400" },
    figtree: { stack: '"Figtree", sans-serif', google: "Figtree:ital,wght@0,400;0,700;1,400" },
    atkinson: {
      stack: '"Atkinson Hyperlegible", sans-serif',
      google: "Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400",
    },
    lora: { stack: '"Lora", serif', google: "Lora:ital,wght@0,400;0,700;1,400" },
    literata: { stack: '"Literata", serif', google: "Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400" },
    newsreader: { stack: '"Newsreader", serif', google: "Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400" },
  };

  const name = new URLSearchParams(window.location.search).get("font");
  const font = name && FONTS[name];
  if (!font) {
    return;
  }

  if (font.google) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(link);
  }

  document.documentElement.style.setProperty("--post-font", font.stack);
  document.title = `[${name}] ${document.title}`;
})();
