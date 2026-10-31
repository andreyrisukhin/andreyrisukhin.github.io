#!/usr/bin/env node
// Run after a production build; --preview checks an --unpublished build in _site/series-preview.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const preview = process.argv.includes("--preview");
const site = path.resolve(__dirname, preview ? "../_site/series-preview" : "../_site");
const overview = "/projects/lego/";
const first = "/blog/2026/lego-logbook-first-reconstruction-pipeline/";
const second = "/blog/2026/lego-recognizer-white-background/";
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
if (preview) {
  assert.ok(logbook.indexOf(first) < logbook.indexOf(second), "Preview uses experiment chronology");
  assert.match(logbook, /Draft/, "Preview identifies the unpublished entry");
  assert.ok(navigation(firstPost).includes(`href="${second}" rel="next"`), "Preview first entry links forward");
  const secondPost = read(second);
  assert.ok(navigation(secondPost).includes(`href="${first}" rel="prev"`), "Preview second entry links back");
  assert.ok(!navigation(secondPost).includes('rel="next"'), "Last entry has no empty Next link");
  assert.match(secondPost, /aria-current="page">Entry 2/, "Second experiment is Entry 2");
} else {
  assert.ok(!fs.existsSync(path.join(site, "series-preview")), "Draft preview build is absent from the deployment output");
  assert.ok(!project.includes(second), "Draft is absent from the production logbook");
  assert.ok(!firstPost.includes(second), "Draft is absent from production post navigation");
  assert.ok(!navigation(firstPost).includes('rel="next"'), "Single published post has no empty Next link");
  assert.ok(!fs.existsSync(path.join(site, second, "index.html")), "Draft post is not published");
}
console.log(`Project series: ${preview ? "draft preview" : "production"} reading order and navigation passed.`);
