#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const args = process.argv.slice(2);
const slug = args[0];

if (!slug) {
  console.error("Usage: node bin/render-sheet-audio.mjs <slug> [--instrument-name Strings] [--instrument-sound strings.group] [--midi-program 49]");
  process.exit(1);
}

function option(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const instrumentName = option("--instrument-name", "Strings");
const instrumentSound = option("--instrument-sound", "strings.group");
const midiProgram = Number(option("--midi-program", "49"));
const bitrate = option("--bitrate", "192");
const repoRoot = process.cwd();
const scoreDir = join(repoRoot, "assets", "music", "sheet-music", slug);
const sourceMusicXml = join(scoreDir, `${slug}.musicxml`);
const outputAudio = join(scoreDir, `${slug}-strings.mp3`);
const outputTiming = join(scoreDir, `${slug}-timing.json`);
const tempDir = mkdtempSync(join(tmpdir(), `${slug}-audio-`));
const tempMusicXml = join(tempDir, `${slug}-render.musicxml`);

let xml = readFileSync(sourceMusicXml, "utf8");
xml = xml.replace(/\n\s*<harmony\b[\s\S]*?<\/harmony>/g, "");
xml = xml.replace(/<part-name>[\s\S]*?<\/part-name>/, `<part-name>${instrumentName}</part-name>`);
xml = xml.replace(/<instrument-name>[\s\S]*?<\/instrument-name>/, `<instrument-name>${instrumentName}</instrument-name>`);
xml = xml.replace(/<instrument-sound>[\s\S]*?<\/instrument-sound>/, `<instrument-sound>${instrumentSound}</instrument-sound>`);
xml = xml.replace(/<midi-program>[\s\S]*?<\/midi-program>/, `<midi-program>${midiProgram}</midi-program>`);
writeFileSync(tempMusicXml, xml);

execFileSync("mscore", ["-F", "--sound-profile", "MuseScore Basic", "-b", bitrate, "-o", outputAudio, tempMusicXml], { stdio: "inherit" });

const timing = buildTiming(readFileSync(sourceMusicXml, "utf8"), outputAudio);
writeFileSync(outputTiming, JSON.stringify(timing, null, 2) + "\n");
console.log(`Rendered ${basename(outputAudio)} and ${basename(outputTiming)}`);

function buildTiming(sourceXml, audioPath) {
  const measures = [...sourceXml.matchAll(/<measure\b[^>]*number="([^"]+)"[\s\S]*?<\/measure>/g)];
  const tempos = new Map([[1, 120]]);
  for (const match of measures) {
    const measure = Number(match[1]);
    const tempoMatch = match[0].match(/<sound\b[^>]*tempo="([^"]+)"/);
    if (Number.isFinite(measure) && tempoMatch) tempos.set(measure, Number(tempoMatch[1]));
  }

  const count = measures.length;
  const starts = [];
  let t = 0;
  for (let i = 1; i <= count; i += 1) {
    starts.push(t);
    const bpm = tempoForMeasure(tempos, i);
    t += (4 * 60) / bpm;
  }

  const audioDurationSec = audioDuration(audioPath);
  return {
    version: Date.now(),
    score: slug,
    render: `${instrumentName.toLowerCase()}-no-harmony`,
    audio: basename(audioPath),
    audioDurationSec,
    scoreEndSec: round(t),
    tailSec: round(audioDurationSec - t),
    measureCount: count,
    tempoSegments: [...tempos.entries()].map(([fromMeasure, bpm]) => ({ fromMeasure, bpm })),
    measures: starts.map((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : t;
      return {
        measure: i + 1,
        startSec: round(start),
        endSec: round(end),
        durationSec: round(end - start),
      };
    }),
    notes: "Rendered from temporary MusicXML with harmony/chord-symbol playback removed. Keep the committed MusicXML unchanged for score display.",
  };
}

function tempoForMeasure(tempos, measure) {
  let current = 120;
  for (const [fromMeasure, bpm] of [...tempos.entries()].sort((a, b) => a[0] - b[0])) {
    if (fromMeasure > measure) break;
    current = bpm;
  }
  return current;
}

function audioDuration(audioPath) {
  const output = execFileSync("afinfo", [audioPath], { encoding: "utf8" });
  const match = output.match(/estimated duration:\s*([0-9.]+)\s*sec/);
  if (!match) return null;
  return round(Number(match[1]));
}

function round(n) {
  return Math.round(n * 1000000) / 1000000;
}
