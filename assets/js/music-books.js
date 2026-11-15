document.querySelectorAll(".score-library").forEach((library) => {
  const caption = library.querySelector("[data-book-caption]");
  const defaultCaption = caption.textContent;
  library.querySelectorAll(".score-book").forEach((book) => {
    const show = () => (caption.textContent = book.dataset.bookDetail);
    const reset = () => {
      const activeBook = library.querySelector(".score-book:is(:hover, :focus)");
      caption.textContent = activeBook ? activeBook.dataset.bookDetail : defaultCaption;
    };
    book.addEventListener("mouseenter", show);
    book.addEventListener("focus", show);
    book.addEventListener("mouseleave", reset);
    book.addEventListener("blur", reset);
  });
});
