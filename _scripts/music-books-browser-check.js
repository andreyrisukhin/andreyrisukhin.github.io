// Evaluate on /music/ and /music/sheet/ at desktop and mobile widths.
(async () => {
  let checks = 0;
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
    checks++;
  };
  const library = document.querySelector(".score-library");
  const books = [...library.querySelectorAll(".score-book:not(.score-book--blank)")];
  const blankBook = library.querySelector(".score-book--blank");
  assert(books.length === 6, "All six books appear");
  assert(
    [...library.querySelectorAll(".score-stack:not(.score-stack--blank)")].map((stack) => stack.getAttribute("aria-label")).join(",") ===
      "Games,Pop,Autumn,Studies",
    "Scores are grouped into four stacks"
  );
  assert(new Set(books.map((book) => book.pathname)).size === 6, "Every book appears once");
  assert(
    books.some((book) => book.pathname === "/music/sheet/hidden-truth/"),
    "Hidden Truth has one book for all four variants"
  );
  assert(blankBook && blankBook.pathname === "/music/sheet/open/", "Blank book opens the local file reader");
  assert(blankBook.getAttribute("aria-label") === "Open your own MusicXML", "Blank book has an accessible name");
  assert(!blankBook.textContent.trim() && !blankBook.querySelector("svg"), "Blank book has no title or motif on its spine");
  assert(blankBook.closest(".score-stack").querySelectorAll(".score-book").length === 1, "Blank book has its own shelf");
  assert(library.querySelectorAll('a[href$="/music/sheet/open/"]').length === 1, "File reader appears only once");
  const checkBook = (book) => {
    const title = book.querySelector(".score-book__title");
    const rect = book.getBoundingClientRect();
    assert(title.textContent.trim().length > 0, "Every book has a title");
    const luminance = (rgb) => {
      const channels = rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          value /= 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const foreground = luminance(getComputedStyle(title).color);
    const background = luminance(getComputedStyle(book).backgroundColor);
    assert((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5, "Title has readable contrast");
    assert(rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth, "Book stays in viewport with a touch-sized target");
    assert(title.scrollWidth <= title.clientWidth && title.scrollHeight <= book.clientHeight, "Title fits the spine");
    assert(document.getElementById(book.getAttribute("aria-describedby")), "Book has an accessible description");
  };
  assert(!library.querySelector("[data-book-style], [data-book-sizing], .score-library__notes"), "No design-study controls ship");
  assert(getComputedStyle(books[0].querySelector(".score-book__caps")).clipPath !== "none", "Covers are stepped pixel boards");
  books.forEach(checkBook);
  const blankRect = blankBook.getBoundingClientRect();
  assert(blankRect.height >= 44 && blankRect.left >= 0 && blankRect.right <= innerWidth, "Blank book stays visible and touch-sized");
  const heights = books.map((book) => book.getBoundingClientRect().height);
  assert(heights[2] / heights[0] > 2.2, "Long score is more than twice as thick as short score");
  assert(heights[0] < heights[1] && heights[1] < heights[2], "Thickness follows score length");
  assert(document.documentElement.scrollWidth <= innerWidth, "No horizontal overflow");
  for (const book of [...books, blankBook]) {
    book.focus();
    assert(library.querySelector("[data-book-caption]").textContent === book.dataset.bookDetail, "Focus reveals source and score length");
    book.blur();
  }
  for (const url of [...books, blankBook].map((book) => book.href)) {
    assert((await fetch(url)).ok, "Score and file-reader links resolve");
  }
  return { checks, width: innerWidth, result: "passed" };
})();
