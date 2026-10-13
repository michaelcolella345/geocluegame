#!/usr/bin/env node
// Checks data/countries.json and data/puzzles.json for mistakes.
// Run from the project folder:  node tools/validate.js
// Errors (✗) must be fixed before publishing. Warnings (!) are worth a look.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const REPEAT_WINDOW_DAYS = 60;

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Same normalization the game uses for matching guesses.
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, " ")
    .replace(/^the /, "").replace(/\bst\b/g, "saint").trim();

// ---------- countries.json ----------
let countries;
try { countries = read("data/countries.json"); }
catch (e) { console.error("✗ data/countries.json is not valid JSON: " + e.message); process.exit(1); }

const byName = new Map();
const seen = new Map(); // normalized name/alias -> country
for (const c of countries) {
  const where = `countries.json "${c.name}"`;
  if (!c.name || typeof c.name !== "string") { err(`A country is missing its name`); continue; }
  if (byName.has(c.name)) err(`${where} appears twice`);
  byName.set(c.name, c);
  if (!/^[A-Z]{2}$/.test(c.code || "")) err(`${where} needs a 2-letter code`);
  if (typeof c.lat !== "number" || c.lat < -90 || c.lat > 90) err(`${where} has a bad lat`);
  if (typeof c.lon !== "number" || c.lon < -180 || c.lon > 180) err(`${where} has a bad lon`);
  if (!Array.isArray(c.aliases)) err(`${where} needs an "aliases" list (can be empty)`);
  for (const a of [c.name, ...(c.aliases || [])]) {
    const k = norm(a);
    if (seen.has(k) && seen.get(k) !== c.name) err(`Alias "${a}" matches both ${seen.get(k)} and ${c.name}`);
    seen.set(k, c.name);
  }
}
if (countries.length < 196) warn(`Only ${countries.length} countries (expected 196+)`);

// ---------- puzzles.json ----------
let puzzles;
try { puzzles = read("data/puzzles.json"); }
catch (e) { console.error("✗ data/puzzles.json is not valid JSON: " + e.message); process.exit(1); }

const isUrl = (u) => typeof u === "string" && /^https?:\/\/\S+\.\S+/.test(u);
const dates = Object.keys(puzzles).sort();
const lastUsed = new Map(); // answer -> date string
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;

dates.forEach((d, i) => {
  const p = puzzles[d];
  const where = `puzzles.json ${d}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(dayNum(d))) { err(`${where}: key must be a date like 2026-11-01`); return; }
  if (i > 0 && dayNum(d) - dayNum(dates[i - 1]) > 1) warn(`Gap: no puzzle between ${dates[i - 1]} and ${d}`);

  const c = byName.get(p.answer);
  if (!c) err(`${where}: answer "${p.answer}" is not a name in countries.json`);
  else if (c.neverAnswer) err(`${where}: ${p.answer} is marked neverAnswer`);

  if (!Array.isArray(p.clues) || p.clues.length !== 5) err(`${where}: needs exactly 5 clues`);
  else p.clues.forEach((cl, j) => {
    if (!cl || typeof cl.text !== "string" || cl.text.trim().length < 10) err(`${where}: clue ${j + 1} text is missing or too short`);
    if (!isUrl(cl && cl.source)) err(`${where}: clue ${j + 1} needs a source URL`);
    if (j < 4 && cl && cl.text && norm(cl.text).includes(norm(p.answer))) err(`${where}: clue ${j + 1} gives away the answer`);
  });
  if (!p.didYouKnow || typeof p.didYouKnow.text !== "string") err(`${where}: needs didYouKnow.text`);
  else if (!isUrl(p.didYouKnow.source)) err(`${where}: didYouKnow needs a source URL`);

  // Mon–Wed easy, Thu–Sun hard.
  const wd = new Date(dayNum(d) * 864e5).getUTCDay(); // 0 = Sunday
  const expected = wd >= 1 && wd <= 3 ? "easy" : "hard";
  if (p.difficulty && p.difficulty !== expected) warn(`${where}: marked ${p.difficulty}, but ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][wd]} should be ${expected}`);

  if (lastUsed.has(p.answer)) {
    const gap = dayNum(d) - dayNum(lastUsed.get(p.answer));
    if (gap < REPEAT_WINDOW_DAYS) err(`${where}: ${p.answer} was already used on ${lastUsed.get(p.answer)} (${gap} days ago; need ${REPEAT_WINDOW_DAYS}+)`);
  }
  lastUsed.set(p.answer, d);
});

// ---------- report ----------
for (const w of warnings) console.log("! " + w);
for (const e of errors) console.log("✗ " + e);
console.log(`\n${countries.length} countries, ${dates.length} puzzles` +
  (dates.length ? ` (${dates[0]} to ${dates[dates.length - 1]})` : "") +
  `. ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
