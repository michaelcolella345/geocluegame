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
    if (j < 4 && cl && cl.text && new RegExp(`\\b${norm(p.answer)}\\b`).test(norm(cl.text))) err(`${where}: clue ${j + 1} gives away the answer`);
  });
  if (!p.didYouKnow || typeof p.didYouKnow.text !== "string") err(`${where}: needs didYouKnow.text`);
  else if (!isUrl(p.didYouKnow.source)) err(`${where}: didYouKnow needs a source URL`);

  // Hard puzzles go on Fridays, and only on Fridays. Easy and medium can go any other day.
  const wd = new Date(dayNum(d) * 864e5).getUTCDay(); // 0 = Sunday, 5 = Friday
  if (!["easy", "medium", "hard"].includes(p.difficulty)) err(`${where}: difficulty must be "easy", "medium" or "hard"`);
  else if (wd === 5 && p.difficulty !== "hard") warn(`${where}: is a Friday, so it should be a hard puzzle (it's ${p.difficulty})`);
  else if (wd !== 5 && p.difficulty === "hard") warn(`${where}: is hard, but hard puzzles go on Fridays only`);

  if (lastUsed.has(p.answer)) {
    const gap = dayNum(d) - dayNum(lastUsed.get(p.answer));
    if (gap < REPEAT_WINDOW_DAYS) err(`${where}: ${p.answer} was already used on ${lastUsed.get(p.answer)} (${gap} days ago; need ${REPEAT_WINDOW_DAYS}+)`);
  }
  lastUsed.set(p.answer, d);
});

// ---------- hindsight.json ----------
let hindsight = {};
try { hindsight = read("data/hindsight.json"); }
catch (e) { err("data/hindsight.json is not valid JSON: " + e.message); }
const hsDates = Object.keys(hindsight).sort();
hsDates.forEach((d, i) => {
  const where = `hindsight.json ${d}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(dayNum(d))) { err(`${where}: key must be a date like 2026-11-01`); return; }
  if (i > 0 && dayNum(d) - dayNum(hsDates[i - 1]) > 1) warn(`Gap: no Hindsight matchups between ${hsDates[i - 1]} and ${d}`);
  const rounds = hindsight[d] && hindsight[d].rounds;
  if (!Array.isArray(rounds) || rounds.length !== 6) { err(`${where}: needs exactly 6 rounds`); return; }
  rounds.forEach((r, j) => {
    const at = `${where} round ${j + 1}`;
    for (const side of ["first", "second"]) {
      const e = r[side];
      if (!e || typeof e.event !== "string" || e.event.length < 5) err(`${at}: ${side}.event is missing`);
      else if (typeof e.where !== "string" || !e.where) err(`${at}: ${side}.where is missing`);
      else if (!Number.isInteger(e.year) || e.year === 0) err(`${at}: ${side}.year must be a whole number (negative for BC, never 0)`);
      else if (e.fact != null && (typeof e.fact !== "string" || e.fact.length < 10)) err(`${at}: ${side}.fact is too short (or leave it out)`);
    }
    if (r.first && r.second && !(r.first.year < r.second.year)) err(`${at}: "first" must have the earlier year`);
    if (r.fact != null && (typeof r.fact !== "string" || r.fact.length < 10)) err(`${at}: fact is too short (or leave it out)`);
    for (const side of ["first", "second"]) if (r[side] && !isUrl(r[side].source)) err(`${at}: ${side} needs a source URL`);
  });
});

// ---------- report ----------
for (const w of warnings) console.log("! " + w);
for (const e of errors) console.log("✗ " + e);
console.log(`\n${countries.length} countries, ${dates.length} puzzles` +
  (dates.length ? ` (${dates[0]} to ${dates[dates.length - 1]})` : "") +
  `, ${hsDates.length} Hindsight days` + (hsDates.length ? ` (${hsDates[0]} to ${hsDates[hsDates.length - 1]})` : "") +
  `. ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
