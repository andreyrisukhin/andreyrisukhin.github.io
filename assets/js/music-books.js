document.querySelectorAll(".score-library").forEach((library) => {
  const caption = library.querySelector("[data-book-caption]");
  const defaultCaption = caption.textContent;
  const parameters = new URLSearchParams(location.search);
  const setChoice = (attribute, key, value) => {
    const choices = [...library.querySelectorAll(`[${attribute}]`)];
    if (!choices.some((choice) => choice.getAttribute(attribute) === value)) return;
    library.dataset[key] = value;
    choices.forEach((choice) => choice.setAttribute("aria-pressed", String(choice.getAttribute(attribute) === value)));
  };
  [
    ["data-book-style", "style", "binding"],
    ["data-book-sizing", "sizing", "size"],
  ].forEach(([attribute, key, parameter]) => {
    setChoice(attribute, key, parameters.get(parameter) || library.dataset[key]);
    library.querySelectorAll(`[${attribute}]`).forEach((button) => {
      button.addEventListener("click", () => {
        setChoice(attribute, key, button.getAttribute(attribute));
        const url = new URL(location.href);
        url.searchParams.set(parameter, library.dataset[key]);
        history.replaceState(null, "", url);
      });
    });
  });
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
