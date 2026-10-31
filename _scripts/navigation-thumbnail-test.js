#!/usr/bin/env node
// Run after the production Jekyll build.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const site = path.resolve(__dirname, "../_site");
const destinations = ["/publications/", "/teaching/", "/chess/", "/color/", "/kata/", "/projects/lego/"];

for (const route of ["", "projects/lego/"]) {
  const html = fs.readFileSync(path.join(site, route, "index.html"), "utf8");
  const navbar = html.match(/<nav\b[^>]*id="navbar"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(navbar, `${route || "/"} has navigation`);
  const items = [...navbar.matchAll(/<a\b[^>]*class="dropdown-item[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
  assert.equal(items.length, destinations.length, "All six dropdown destinations remain present");
  for (const destination of destinations) {
    const item = items.find((item) => item.includes(`href="${destination}"`));
    assert.ok(item, `Menu links to ${destination}`);
    const images = [...item.matchAll(/<img\b[^>]*>/g)];
    assert.equal(images.length, 1, `${destination} has exactly one thumbnail`);
    const image = images[0][0];
    assert.match(image, /alt=""/, "Thumbnails are decorative, not duplicate link names");
    assert.match(image, /width="32"/);
    assert.match(image, /height="32"/);
    assert.match(item, /<span class="dropdown-item__label">[^<]+<\/span>/, "Text labels remain visible");
    const source = image.match(/src="([^"]+)"/)?.[1];
    assert.ok(source?.startsWith("/assets/img/navigation/"), "Thumbnail uses a local asset");
    assert.ok(fs.existsSync(path.join(site, source)), `${source} exists in the built site`);
  }
  if (route === "projects/lego/") {
    const lego = items.find((item) => item.includes('href="/projects/lego/"'));
    assert.match(lego, /class="[^"]*\bactive\b/, "LEGO keeps its active menu state");
  }
}
console.log("Navigation thumbnails: all six links, decorative images, dimensions, asset paths, labels, and active state passed.");
