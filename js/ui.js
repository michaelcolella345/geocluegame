// Page wiring: renders the game, handles input, dialogs, sharing and the countdown.
import { CONFIG } from "./config.js";
import { loadData, makeMatcher } from "./data.js";
import { compassWord, BAND_EMOJI, BAND_LABEL } from "./geo.js";
import * as store from "./storage.js";
import * as track from "./track.js";
import "./nav.js";
import {
  localDateKey, puzzleFor, startGame, applyGuess, scoreGuess, cluesShown,
  recordResult, displayStreak, shareText, msUntilMidnight,
} from "./game.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtMiles = (m) => `${Math.round(m).toLocaleString("en-US")} mi`;

let matcher, puzzles, day, game;

// ---------- Which day is it? ----------
// On localhost you can test any date with ?date=YYYY-MM-DD.
function todayKey() {
  const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const forced = new URLSearchParams(location.search).get("date");
  if (local && /^\d{4}-\d{2}-\d{2}$/.test(forced || "")) return forced;
  return localDateKey();
}

function prettyDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------- Setup ----------
async function init() {
  track.start();
  try {
    const data = await loadData();
    matcher = makeMatcher(data.countries);
    puzzles = data.puzzles;
  } catch (e) {
    console.error(e);
    showNotice("Couldn't load today's puzzle", "Check your connection and refresh the page.");
    return;
  }
  bindEvents();
  loadDay();
  if (!store.hasSeenHelp()) openDialog("help");
  setInterval(tick, 1000);
}

function loadDay() {
  const key = todayKey();
  day = puzzleFor(key, puzzles);
  $("meta").innerHTML = day.number >= 1
    ? `GeoClue #${day.number}<br>${prettyDate(key)}`
    : prettyDate(key);

  if (day.status !== "ok") {
    game = null;
    $("game").hidden = true;
    if (day.status === "before-launch") {
      showNotice("GeoClue starts soon", `The first puzzle arrives on ${prettyDate(CONFIG.LAUNCH_DATE)}.`, day.number === 0);
    } else {
      showNotice("Back tomorrow!", "There's no puzzle for today. A new one arrives at midnight.", true);
    }
    return;
  }
  $("notice").hidden = true;
  $("game").hidden = false;
  showDifficulty(day.puzzle.difficulty);
  game = startGame(day, store.loadProgress());
  store.saveProgress(game);
  render();
}

// "Today's difficulty" tag above the clues: three dots, filled up to the level.
const LEVELS = ["easy", "medium", "hard"];
function showDifficulty(level) {
  const el = $("difficulty");
  const n = LEVELS.indexOf(level) + 1;
  el.hidden = !n;
  if (!n) return;
  const name = level[0].toUpperCase() + level.slice(1);
  el.dataset.level = level;
  el.innerHTML = `<span class="dots" aria-hidden="true">${LEVELS.map((_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("")}</span>` +
    `<span>Today's difficulty: <b>${name}</b></span>`;
}

function showNotice(title, text, countdown = false) {
  const n = $("notice");
  n.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p>` +
    (countdown ? `<p class="countdown-wrap">Next puzzle in <span class="countdown" data-countdown>${countdownText()}</span></p>` : "");
  n.hidden = false;
}

// ---------- Rendering ----------
const scored = () => game.guesses.map((n) => scoreGuess(n, game.answer, matcher.byName));

function arrowSVG(deg) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${deg.toFixed(0)}deg)"><path d="M12 2 L18 20 L12 16 L6 20 Z" fill="currentColor"/></svg>`;
}

// Motion timings (ms). All zero when the player prefers reduced motion.
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const T = () => reduceMotion()
  ? { firstReveal: 0, stagger: 0, settle: 0 }
  : { firstReveal: 450, stagger: 220, settle: 550 };

// `anim` describes what just happened: { newClue, newRow, finishing }.
function render(anim = {}) {
  const p = day.puzzle;
  const shown = cluesShown(game);
  const rows = scored();
  // Clues the player actually saw while guessing. On a win the rest are "bonus" clues.
  const seen = game.won ? game.guesses.length : shown;
  const t = T();

  $("clues").innerHTML = p.clues.map((c, i) => {
    if (i >= shown) return `<li class="clue locked"><span class="n" aria-hidden="true">${i + 1}</span><p>Unlocks after guess ${i}</p></li>`;
    const bonus = i >= seen;
    const cls = ["clue", i === anim.newClue ? "new" : "", bonus ? "bonus" : "", anim.finishing && bonus ? "reveal" : ""].filter(Boolean).join(" ");
    const delay = anim.finishing && bonus ? ` style="--d:${t.firstReveal + (i - seen) * t.stagger}ms"` : "";
    return `<li class="${cls}"${delay}><span class="n" aria-hidden="true">${i + 1}</span><p><span class="sr-only">Clue ${i + 1}: </span>${esc(c.text)}${bonus ? ' <span class="tag">Bonus clue</span>' : ""}</p></li>`;
  }).join("");

  $("slots").innerHTML = Array.from({ length: CONFIG.MAX_GUESSES }, (_, i) =>
    `<div class="slot${anim.newRow && i === rows.length - 1 ? " pop" : ""}"${rows[i] ? ` style="background:var(--${rows[i].band})"` : ""}></div>`).join("");

  $("log").innerHTML = rows.slice().reverse().map((g, i) => {
    const label = g.correct ? `${g.name}: correct!` : `${g.name}: ${fmtMiles(g.miles)} away, ${BAND_LABEL[g.band].toLowerCase()}, head ${compassWord(g.bearing)}`;
    const fx = anim.newRow && i === 0 ? (g.correct ? " enter win" : anim.finishing ? " enter miss" : " enter") : "";
    return `<li class="row${fx}" style="--c:var(--${g.band})" aria-label="${esc(label)}">
      <span class="name">${esc(g.name)}</span>
      <span class="dist">${g.correct ? "Found it" : fmtMiles(g.miles)}</span>
      <span class="arrow" style="color:var(--${g.band})" title="${g.correct ? "" : "Head " + compassWord(g.bearing)}">${g.correct ? "✓" : arrowSVG(g.bearing)}</span>
    </li>`;
  }).join("");

  const play = $("play");
  play.classList.remove("leaving");
  $("guess").disabled = $("go").disabled = false;
  play.hidden = game.done;
  if (!game.done) { $("result").hidden = true; return; }
  $("result").innerHTML = resultHTML(rows);
  if (!anim.finishing) { $("result").hidden = false; return; }

  // Keep the guess bar in place (faded, disabled) during the transition so the page doesn't jump.
  play.hidden = false;
  play.classList.add("leaving");
  $("guess").disabled = $("go").disabled = true;

  // Finishing: let the last guess land and the bonus clues open, then bring in the results.
  const bonusCount = shown - seen;
  const wait = bonusCount ? t.firstReveal + (bonusCount - 1) * t.stagger + t.settle : t.settle;
  $("result").hidden = true;
  setTimeout(() => {
    const r = $("result");
    play.hidden = true;
    play.classList.remove("leaving");
    r.hidden = false;
    r.classList.remove("enter"); void r.offsetWidth; r.classList.add("enter");
    r.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
    r.querySelector("h2").focus({ preventScroll: true });
  }, wait);
}

function resultHTML(rows) {
  const p = day.puzzle;
  const n = game.guesses.length;
  const title = game.won ? (n === 1 ? "First clue. Incredible!" : `Found it in ${n}!`) : `The answer was ${esc(game.answer)}`;
  const sub = game.won ? `It was <b>${esc(game.answer)}</b>.` : "Five clues down. Tomorrow's a new trail.";
  return `<h2 tabindex="-1">${title}</h2>
    <p>${sub}</p>
    <div class="emoji-row" aria-label="Your result">${rows.map((g) => BAND_EMOJI[g.band]).join("")}</div>
    <div class="dyk"><h3>Did you know?</h3><p>${esc(p.didYouKnow.text)}</p>
      <a href="${esc(p.didYouKnow.source)}" target="_blank" rel="noopener">Source</a></div>
    ${statsHTML()}
    <div class="btns"><button type="button" id="share-btn">Share</button></div>
    <p class="copied" id="copied" aria-live="polite"></p>
    <p class="countdown-wrap">Next puzzle in <span class="countdown" data-countdown>${countdownText()}</span></p>`;
}

function statsHTML() {
  const s = store.loadStats();
  const streak = displayStreak(s, day && day.number >= 1 ? day.number : 0);
  const keys = [1, 2, 3, 4, 5, "fail"];
  const max = Math.max(1, ...keys.map((k) => s.dist[k] || 0));
  const mine = game && game.done && day && s.lastPlayed === day.number ? (game.won ? game.guesses.length : "fail") : null;
  return `<div class="stats">
      <div class="stat"><b>${s.played}</b><span>Played</span></div>
      <div class="stat"><b>${s.played ? Math.round((100 * s.wins) / s.played) : 0}</b><span>Win %</span></div>
      <div class="stat"><b>${streak}</b><span>Current streak</span></div>
      <div class="stat"><b>${s.bestStreak}</b><span>Best streak</span></div>
    </div>
    <h3 class="dist-h">Guess distribution</h3>
    <ol class="dist">${keys.map((k) => {
      const v = s.dist[k] || 0;
      return `<li${String(k) === String(mine) ? ` class="mine${k === "fail" ? " fail" : ""}"` : ""}><span>${k === "fail" ? "X" : k}</span>
        <span class="bar" style="--w:${Math.max(8, (100 * v) / max)}%"><b>${v}</b></span></li>`;
    }).join("")}</ol>`;
}

// ---------- Guessing ----------
function submitGuess(raw) {
  if (!game || game.done) return;
  const c = matcher.resolve(raw);
  if (!c) { setMsg(raw.trim() ? "That doesn't match a country. Pick one from the list." : "Type a country first."); return; }
  const { game: next, error } = applyGuess(game, c.name);
  if (error) { setMsg(error); return; }
  setMsg("");
  game = next;
  store.saveProgress(game);
  if (game.guesses.length === 1) track.started(day.number);
  if (game.done) {
    store.saveStats(recordResult(store.loadStats(), day.number, game));
    track.finished(day.number, game);
  }
  $("guess").value = "";
  hideSugg();
  render({ newRow: true, newClue: game.done ? -1 : game.guesses.length, finishing: game.done });

  const last = scoreGuess(c.name, game.answer, matcher.byName);
  const bonus = 5 - game.guesses.length;
  $("announce").textContent = last.correct
    ? `Correct! It's ${game.answer}.` + (bonus ? ` ${bonus} bonus clue${bonus > 1 ? "s" : ""} revealed.` : "")
    : `${c.name} is ${fmtMiles(last.miles)} away. Head ${compassWord(last.bearing)}.` +
      (game.done ? ` Out of guesses. The answer was ${game.answer}.` : ` Clue ${game.guesses.length + 1} unlocked.`);
  if (!game.done) $("guess").focus();
}
const setMsg = (t) => { $("msg").textContent = t; };

// ---------- Autocomplete ----------
let sel = -1;
function hideSugg() {
  $("sugg").hidden = true;
  $("guess").setAttribute("aria-expanded", "false");
  $("guess").removeAttribute("aria-activedescendant");
  sel = -1;
}
function showSugg() {
  const list = matcher.suggest($("guess").value, new Set(game ? game.guesses : []));
  if (!list.length) { hideSugg(); return; }
  sel = -1;
  $("sugg").innerHTML = list.map((s, i) =>
    `<li role="option" id="opt-${i}" data-n="${esc(s.country.name)}" aria-selected="false">${esc(s.country.name)}${s.via ? ` <small>(${esc(s.via)})</small>` : ""}</li>`).join("");
  $("sugg").hidden = false;
  $("guess").setAttribute("aria-expanded", "true");
}
function moveSel(delta) {
  const items = [...$("sugg").children];
  if (!items.length) return;
  sel = (sel + delta + items.length) % items.length;
  items.forEach((li, i) => { li.classList.toggle("on", i === sel); li.setAttribute("aria-selected", String(i === sel)); });
  $("guess").setAttribute("aria-activedescendant", items[sel].id);
  items[sel].scrollIntoView({ block: "nearest" });
}

// ---------- Share ----------
async function share() {
  const streak = displayStreak(store.loadStats(), day.number);
  const text = shareText(day.number, game, scored(), BAND_EMOJI, streak);
  const out = $("copied");
  // On phones, open the share sheet (Messages, WhatsApp…). Elsewhere, copy to the clipboard.
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ text }); return; }
    catch (e) { if (e.name === "AbortError") return; /* otherwise fall back to copying */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    out.textContent = "Copied! Paste it anywhere.";
  } catch {
    // Clipboard blocked: show the text so it can be copied by hand.
    out.innerHTML = `<textarea readonly rows="3" aria-label="Your result">${esc(text)}</textarea>`;
    out.querySelector("textarea").select();
  }
}

// ---------- Dialogs ----------
function openDialog(id) {
  if (id === "stats") $("stats-body").innerHTML = statsHTML();
  const d = $(id);
  if (!d.open) d.showModal();
}

// ---------- Countdown + midnight rollover ----------
function countdownText() {
  const s = Math.max(0, Math.floor(msUntilMidnight() / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
function tick() {
  if (day && todayKey() !== day.dateKey) { $("msg").textContent = ""; loadDay(); return; }
  for (const el of document.querySelectorAll("[data-countdown]")) el.textContent = countdownText();
}

// ---------- Events ----------
function bindEvents() {
  const input = $("guess");
  input.addEventListener("input", () => { setMsg(""); showSugg(); });
  input.addEventListener("keydown", (e) => {
    if ($("sugg").hidden) { if (e.key === "ArrowDown") { showSugg(); e.preventDefault(); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); moveSel(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSel(-1); }
    else if (e.key === "Escape") { e.preventDefault(); hideSugg(); }
  });
  input.addEventListener("blur", () => setTimeout(hideSugg, 150));
  $("sugg").addEventListener("mousedown", (e) => {
    const li = e.target.closest("li");
    if (li) { e.preventDefault(); submitGuess(li.dataset.n); }
  });
  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const items = [...$("sugg").children];
    // Enter picks the highlighted suggestion, or the only one, otherwise uses what was typed.
    let value = input.value;
    if (!$("sugg").hidden && items[sel]) value = items[sel].dataset.n;
    else if (!$("sugg").hidden && items.length === 1) value = items[0].dataset.n;
    submitGuess(value);
  });
  $("result").addEventListener("click", (e) => { if (e.target.id === "share-btn") share(); });
  $("help-btn").addEventListener("click", () => openDialog("help"));
  $("stats-btn").addEventListener("click", () => openDialog("stats"));

  $("help").addEventListener("close", () => { store.markHelpSeen(); if (game && !game.done) input.focus(); });
  // Clicking the dimmed backdrop closes a dialog.
  for (const d of document.querySelectorAll("dialog")) {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}

init();
