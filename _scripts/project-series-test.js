#!/usr/bin/env node
// Run after a production build; --preview checks an --unpublished build in _site/series-preview.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const preview = process.argv.includes("--preview");
const site = path.resolve(__dirname, preview ? "../_site/series-preview" : "../_site");
const overview = "/projects/lego/";
const first = "/blog/2026/lego-logbook-first-reconstruction-pipeline/";
const second = "/blog/2026/lego-logbook-studio-to-blender/";
const third = "/blog/2026/lego-recognizer-white-background/";
const read = (url) => fs.readFileSync(path.join(site, url, "index.html"), "utf8");
const project = read(overview);
const firstPost = read(first);
const logbook = project.match(/<section\b[^>]*id="logbook"[\s\S]*?<\/section>/)?.[0];
assert.ok(logbook, "Project has a logbook");
assert.ok(project.indexOf("project-examples.svg") < project.indexOf('id="logbook"'), "Project introduction and examples come first");
assert.ok(project.indexOf('id="logbook"') < project.indexOf("Let Kids Play"), "Logbook precedes the longer motivation");
assert.match(logbook, new RegExp(`href="${first}"`), "Start reading links to the first experiment");
assert.match(logbook, /March 28–29, 2026/, "Logbook shows experiment dates");
assert.match(logbook, /invalid LDraw assemblies/, "Logbook includes the entry summary");
const navigation = (html) => html.match(/<nav\b[^>]*class="project-series-navigation"[\s\S]*?<\/nav>/)?.[0];
const trail = firstPost.match(/<nav\b[^>]*class="project-series-trail"[\s\S]*?<\/nav>/)?.[0];
assert.ok(trail && firstPost.indexOf(trail) < firstPost.indexOf("<h1"), "Project breadcrumb appears above the post title");
assert.match(trail, /Entry 1/, "First experiment is Entry 1");
assert.match(navigation(firstPost), /href="\/projects\/lego\/" rel="prev"/, "Project overview precedes the first post");
assert.match(navigation(firstPost), /href="\/projects\/lego\/#logbook"/, "All entries returns to the logbook");
assert.match(firstPost, /post-reading--paper/, "Existing post design is preserved");
assert.ok(!read("/blog/2026/time-at-perceptron-ai/").includes('class="project-series-navigation"'), "Unrelated posts do not get LEGO navigation");
const secondPost = read(second);
assert.ok(logbook.includes(`href="${second}"`), "Published rendering entry appears in the logbook");
assert.ok(logbook.indexOf(first) < logbook.indexOf(second), "Published entries use experiment chronology");
assert.match(logbook, /March 31, 2026/, "Logbook shows the rendering experiment date");
assert.ok(navigation(firstPost).includes(`href="${second}" rel="next"`), "First entry links to the rendering entry");
assert.ok(navigation(secondPost).includes(`href="${first}" rel="prev"`), "Rendering entry links back to the first entry");
assert.match(secondPost, /aria-current="page">Entry 2/, "Rendering experiment is Entry 2");
for (const figure of ["boxes-and-studs.png", "color-comparison.png", "reflection-comparison.png"]) {
  assert.ok(secondPost.includes(`assets/img/posts/2026-lego-rendering/${figure}`), `Rendering post includes ${figure}`);
  assert.ok(fs.existsSync(path.join(site, "assets/img/posts/2026-lego-rendering", figure)), `${figure} is deployed`);
}
assert.ok(secondPost.includes("New Blender/Cycles renders"), "Geometry comparison identifies new Blender renders");
assert.ok(secondPost.includes("not the original Studio mesh or archived March 31 inputs"), "Geometry comparison keeps its provenance caveat");
assert.ok(secondPost.includes("New renders reproducing the color encoding error."), "Color comparison identifies a reproduced failure");
for (const schematic of ["boxes-and-studs.svg", "color-and-reflection.svg"]) {
  assert.ok(!secondPost.includes(schematic), `Rendering post does not reuse ${schematic}`);
}
const renderRecord = JSON.parse(fs.readFileSync(path.join(site, "assets/img/posts/2026-lego-rendering/blender/provenance.json"), "utf8"));
assert.equal(renderRecord.renderer, "Cycles", "Figure provenance identifies the actual renderer");
assert.equal(renderRecord.device, "CPU", "Figure provenance records CPU rendering");
for (const name of Object.keys(renderRecord.raw_images)) {
  const rawPath = path.join(site, "assets/img/posts/2026-lego-rendering/blender", name);
  const crypto = require("node:crypto");
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(rawPath)).digest("hex"),
    renderRecord.raw_images[name],
    `${name} matches its render record`
  );
}
if (preview) {
  assert.ok(logbook.indexOf(second) < logbook.indexOf(third), "March 31 precedes April 14 despite its later publication date");
  assert.match(logbook, /Draft/, "Preview identifies the unpublished entry");
  assert.ok(navigation(secondPost).includes(`href="${third}" rel="next"`), "Rendering entry links to the April experiment");
  const thirdPost = read(third);
  assert.ok(navigation(thirdPost).includes(`href="${second}" rel="prev"`), "April experiment links back to the rendering entry");
  assert.ok(!navigation(thirdPost).includes('rel="next"'), "Last entry has no empty Next link");
  assert.match(thirdPost, /aria-current="page">Entry 3/, "Third experiment is Entry 3");
} else {
  assert.ok(!fs.existsSync(path.join(site, "series-preview")), "Draft preview build is absent from the deployment output");
  assert.ok(!logbook.includes("Draft"), "Production logbook contains only published entries");
  assert.ok(!navigation(secondPost).includes('rel="next"'), "Last published entry has no empty Next link");
  assert.ok(!secondPost.includes(third), "April draft is absent from the rendering entry navigation");
  assert.ok(!project.includes(third), "April draft is absent from the production logbook");
  assert.ok(!firstPost.includes(third), "April draft is absent from production post navigation");
  assert.ok(!fs.existsSync(path.join(site, third, "index.html")), "April draft post is not published");
}
console.log(`Project series: ${preview ? "draft preview" : "production"} reading order and navigation passed.`);
