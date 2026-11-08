// Check if the user is on a Mac and update the shortcut key for search accordingly
document.addEventListener("readystatechange", () => {
  if (document.readyState === "interactive") {
    let isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    let shortcutKeyElement = document.querySelector("#search-toggle .search-shortcut-key");
    if (shortcutKeyElement && isMac) {
      shortcutKeyElement.textContent = "\u2318";
    }
  }
});
