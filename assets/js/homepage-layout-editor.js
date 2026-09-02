(function () {
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocalhost) {
    return;
  }

  const bayanRemovalStorageKey = "homepage-bayan-buttons-to-remove-v1";

  const sortBayanButtonIds = (a, b) => {
    const aMatch = a.match(/^r(\d+)c(\d+)$/);
    const bMatch = b.match(/^r(\d+)c(\d+)$/);
    if (!aMatch || !bMatch) {
      return a.localeCompare(b);
    }
    return Number(aMatch[1]) - Number(bMatch[1]) || Number(aMatch[2]) - Number(bMatch[2]);
  };

  const readBayanButtonsToRemove = () => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(bayanRemovalStorageKey)) || []);
    } catch (_error) {
      return new Set();
    }
  };

  let bayanButtonsToRemove = readBayanButtonsToRemove();

  const saveBayanButtonsToRemove = () => {
    window.localStorage.setItem(bayanRemovalStorageKey, JSON.stringify([...bayanButtonsToRemove].sort(sortBayanButtonIds)));
  };

  window.homepageBayanButtonsToRemove = () => [...bayanButtonsToRemove].sort(sortBayanButtonIds);

  const initBayanRemovalMarker = async () => {
    const image = document.querySelector('.homepage-intro__sketch img[src*="home-bayan-b-system.svg"]');
    if (!image) {
      return;
    }

    const response = await window.fetch(image.src);
    if (!response.ok) {
      return;
    }

    const wrapper = image.closest(".homepage-intro__sketch");
    if (!wrapper) {
      return;
    }

    const svgText = await response.text();
    const documentSvg = new window.DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
    documentSvg.classList.add("homepage-bayan-removal-marker");
    wrapper.replaceChildren(documentSvg);

    Array.from(documentSvg.querySelectorAll("circle")).forEach((circle) => {
      const row = circle.dataset.bayanRow;
      const col = circle.dataset.bayanCol;
      if (!row || !col) {
        return;
      }

      const id = `r${row}c${col}`;
      circle.dataset.bayanButtonId = id;
      circle.classList.add("homepage-bayan-button");

      const renderRemovalState = () => {
        circle.classList.toggle("is-marked-for-removal", bayanButtonsToRemove.has(id));
      };

      circle.addEventListener("click", () => {
        if (bayanButtonsToRemove.has(id)) {
          bayanButtonsToRemove.delete(id);
        } else {
          bayanButtonsToRemove.add(id);
        }
        saveBayanButtonsToRemove();
        renderRemovalState();
      });

      renderRemovalState();
    });
  };

  initBayanRemovalMarker();
})();
