const echartsTheme = determineComputedTheme();

/* Create echarts chart as another node and hide the code block, appending the echarts node after it
       this is done to enable retrieving the code again when changing theme between light/dark */
document.addEventListener("readystatechange", () => {
  if (document.readyState === "complete") {
    document.querySelectorAll("pre>code.language-echarts").forEach((elem) => {
      const jsonData = elem.textContent;
      const backup = elem.parentElement;
      backup.classList.add("unloaded");
      /* create echarts node */
      const chartElement = document.createElement("div");
      chartElement.classList.add("echarts");
      backup.after(chartElement);

      /* create echarts */
      const chart = echartsTheme === "dark"
        ? echarts.init(chartElement, "dark-fresh-cut")
        : echarts.init(chartElement);

      chart.setOption(JSON.parse(jsonData));
      window.addEventListener("resize", function () {
        chart.resize();
      });
    });
  }
});
