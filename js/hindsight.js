// Hindsight: six matchups a day, tap the event that happened first.
// Matchups live in data/hindsight.json, one set of six per date.
// Scoring: 1 point per correct pick, 2 once you have 2 in a row, so a perfect day is 10.
import { CONFIG } from "./config.js";
import * as store from "./storage.js";
import * as track from "./track.js";
import "./nav.js";
import { localDateKey, daysBetween, msUntilMidnight } from "./game.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ROUNDS = 6;
const MAX_POINTS = 10;
const SENT_KEY = "geoclue:v1:hindsight:sent"; // puzzle number of the last result sent from this browser

let sets, day, picks = [], field = null;

// ---------- Which day is it? ----------
// On localhost you can test any date with ?date=YYYY-MM-DD.
function todayKey() {
  const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  const forced = new URLSearchParams(location.search).get("date");
  if (local && /^\d{4}-\d{2}-\d{2}$/.test(forced || "")) return forced;
  return localDateKey();
}
const prettyDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const puzzleNumber = (key) => daysBetween(CONFIG.HINDSIGHT_LAUNCH_DATE, key) + 1;

// ---------- Years and gaps ----------
const yearText = (e) => e.label || (e.year < 0 ? `${-e.year} BC` : e.year < 1000 ? `AD ${e.year}` : String(e.year));
// There's no year 0: 1 BC is followed by AD 1.
const yearsBetween = (a, b) => b - a - (a < 0 && b > 0 ? 1 : 0);
function gapText(r) {
  const n = yearsBetween(r.first.year, r.second.year);
  const about = r.first.label || r.second.label ? "about " : "";
  return `${about}${n.toLocaleString("en-US")} year${n === 1 ? "" : "s"} apart`;
}
// Which event goes on top: mixed up per matchup, but the same for everyone on a given day.
function firstOnTop(dateKey, i) {
  let h = 7;
  for (const ch of `${dateKey}#${i}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0;
}

// ---------- Setup ----------
async function init() {
  track.start();
  if (CONFIG.HINDSIGHT === false) {
    showNotice("Hindsight is taking a break", "Check back soon. In the meantime, today's GeoClue is waiting.", `<a class="button" href="./">Play today's GeoClue</a>`);
    return;
  }
  try {
    const r = await fetch("data/hindsight.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(`data/hindsight.json: ${r.status}`);
    sets = await r.json();
  } catch (e) {
    console.error(e);
    showNotice("Couldn't load today's matchups", "Check your connection and refresh the page.");
    return;
  }
  bindEvents();
  loadDay();
  if (!store.hasSeenHindsightHelp()) openDialog("help");
  setInterval(tick, 1000);
}

function showNotice(title, text, extra = "") {
  $("game").hidden = true;
  $("notice").innerHTML = `<h2>${title}</h2><p>${text}</p>${extra ? `<p>${extra}</p>` : ""}`;
  $("notice").hidden = false;
}

function loadDay() {
  const key = todayKey();
  const number = puzzleNumber(key);
  const set = sets[key];
  day = { key, number, rounds: set && set.rounds };
  $("meta").innerHTML = number >= 1 ? `Hindsight #${number}<br>${prettyDate(key)}` : prettyDate(key);
  field = null;

  if (number < 1) { showNotice("Hindsight starts soon", `The first matchups arrive on ${prettyDate(CONFIG.HINDSIGHT_LAUNCH_DATE)}.`, `<a class="button" href="./">Play today's GeoClue</a>`); return; }
  if (!day.rounds || day.rounds.length !== ROUNDS) { showNotice("Back tomorrow!", "There are no matchups for today. New ones arrive at midnight.", `<a class="button" href="./">Play today's GeoClue</a>`); return; }

  $("notice").hidden = true;
  $("game").hidden = false;
  const saved = store.loadHindsightProgress();
  picks = saved && saved.date === key && Array.isArray(saved.picks) ? saved.picks.slice(0, ROUNDS) : [];
  if (picks.length === ROUNDS) loadField();
  picks.length === ROUNDS ? showResult(false) : showRound();
}

// ---------- Animations ----------
// A green wash across the screen when right, a red pulse at the edges when wrong, and embers
// floating up while a streak is going. All of it is skipped for players who turn off motion.
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function flash(kind) {
  const f = $("flash");
  f.className = "hs-flash";
  void f.offsetWidth; // restart the animation
  f.className = `hs-flash ${kind}`;
}
function embers(n) {
  if (reduceMotion()) return;
  const box = $("embers");
  for (let k = 0; k < n; k++) {
    const e = document.createElement("i");
    e.style.left = `${Math.random() * 100}%`;
    e.style.setProperty("--dx", `${Math.random() * 80 - 40}px`);
    e.style.animationDelay = `${Math.random() * 0.5}s`;
    box.appendChild(e);
    setTimeout(() => e.remove(), 2300);
  }
}

// ---------- Points ----------
// Points earned by each pick: 0 if wrong, 1 if right, 2 if it's the third (or later) right in a row.
function pointsList(list = picks) {
  let run = 0;
  return list.map((ok) => { run = ok ? run + 1 : 0; return ok ? (run >= 3 ? 2 : 1) : 0; });
}
const totalPoints = (list = picks) => pointsList(list).reduce((a, b) => a + b, 0);
// Right picks in a row going into the next matchup.
function currentRun() {
  let run = 0;
  for (const ok of picks) run = ok ? run + 1 : 0;
  return run;
}

// ---------- One matchup ----------
function drawProgress(current) {
  const earned = pointsList();
  $("progress").innerHTML = Array.from({ length: ROUNDS }, (_, k) =>
    `<i class="${k < picks.length ? (earned[k] === 2 ? "fire" : picks[k] ? "ok" : "no") : k === current ? "now" : ""}"></i>`).join("");
}

function showRound() {
  const i = picks.length;
  const hot = currentRun() >= 2;
  document.body.classList.toggle("hot", hot);
  if (hot && currentRun() === 2) embers(18);
  const r = day.rounds[i];
  const pair = firstOnTop(day.key, i) ? [r.first, r.second] : [r.second, r.first];
  drawProgress(i);
  $("result").hidden = true;
  $("round").hidden = false;
  $("round").innerHTML = `
    <div class="hs-round">
      <div class="hs-q"><h2>Which came first?</h2><span>${i + 1} of ${ROUNDS} · ${totalPoints()} pts</span></div>
      ${currentRun() >= 2 ? `<p class="hs-heat"><span class="flame" aria-hidden="true">🔥</span>${currentRun() === 2 ? "Heating up! This one is worth 2" : `On fire! ${currentRun()} in a row`}</p>` : ""}
      ${pair.map((e, k) => `
        <button type="button" class="pick" data-first="${e === r.first}">
          <span class="ev">${esc(e.event)}</span><span class="where">${esc(e.where)}</span><span class="yr" hidden>${esc(yearText(e))}</span>
        </button>${k === 0 ? `<span class="hs-or" aria-hidden="true">OR</span>` : ""}`).join("")}
      <div id="reveal"></div>
    </div>`;
}

function answer(btn) {
  const i = picks.length;
  if (i >= ROUNDS || btn.disabled) return;
  const r = day.rounds[i];
  const right = btn.dataset.first === "true";
  picks = [...picks, right];
  store.saveHindsightProgress({ date: day.key, picks });
  if (picks.length === 1) track.hindsightStarted(day.number);
  if (picks.length === ROUNDS) finish();
  const earned = pointsList()[i];

  for (const b of document.querySelectorAll(".pick")) {
    b.disabled = true;
    b.classList.add("shown");
    b.querySelector(".yr").hidden = false;
    if (b.dataset.first === "true") { b.classList.add("first"); b.insertAdjacentHTML("beforeend", `<span class="tag">Came first</span>`); if (right) b.classList.add("pop"); }
    else if (b === btn) { b.classList.add("wrong", "shake"); b.insertAdjacentHTML("beforeend", `<span class="tag">Your pick</span>`); }
  }
  flash(right ? "ok" : "no");
  if (!right) document.body.classList.remove("hot");
  if (earned === 2) embers(8);
  drawProgress(-1);
  const last = picks.length === ROUNDS;
  $("reveal").innerHTML = `
    <div class="card hs-reveal">
      <p class="hs-verdict ${right ? "ok" : "no"}" tabindex="-1">${right ? "Correct!" : "Not quite."}
        ${right ? `<span class="hs-plus${earned === 2 ? " x2" : ""}">+${earned} ${earned === 2 ? "🔥" : "pt"}</span>` : ""}</p>
      <div class="hs-tl" aria-hidden="true">
        <div class="axis"></div><div class="span"></div><span class="gap">${gapText(r)}</span>
        <div class="dot a"></div><div class="dot b"></div>
        <span class="lab a">${esc(yearText(r.first))}</span><span class="lab b">${esc(yearText(r.second))}</span>
      </div>
      <div class="hs-facts">
        <h3>Bonus facts</h3>
        ${[r.first, r.second].map((e) => `<p><b>${esc(yearText(e))}</b> ${e.fact ? esc(e.fact) : esc(e.event)}
          <a href="${esc(e.source)}" target="_blank" rel="noopener">More</a></p>`).join("")}
      </div>
      <div class="btns"><button type="button" id="next">${last ? "See my score" : "Next matchup"}</button></div>
    </div>`;
  $("next").focus({ preventScroll: true });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("reveal").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
}

function next() {
  if (picks.length === ROUNDS) { showResult(true); return; }
  showRound();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("progress").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
}

// ---------- How you did against everyone ----------
// The finished game's points are sent once, anonymously, to worker/index.js, which answers with
// the share of players for each score. Nothing shows until 5 players have finished.
async function loadField() {
  if (!CONFIG.HINDSIGHT_STATS || day.number < 1) return;
  const number = day.number;
  const points = totalPoints();
  let lastSent = 0;
  try { lastSent = Number(localStorage.getItem(SENT_KEY)); } catch { /* not saved */ }
  const send = lastSent !== number;
  try {
    const r = await fetch(`api/hindsight?puzzle=${number}`, send
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ points }) }
      : { cache: "no-store" });
    if (!r.ok || day.number !== number) return;
    if (send) { try { localStorage.setItem(SENT_KEY, String(number)); } catch { /* not saved */ } }
    field = await r.json();
  } catch { return; }
  const el = $("field");
  if (el) { el.innerHTML = fieldHTML(); el.hidden = !el.innerHTML; }
}
function fieldHTML() {
  if (!field) return "";
  if (!field.enough) return `<p class="everyone-wait">Not enough players have finished yet. Check back later to see how you compare.</p>`;
  const mine = totalPoints();
  let below = 0;
  for (let p = 0; p < mine; p++) below += field.percent[p] || 0;
  return `<p class="everyone-big"><b>${Math.min(100, below)}%</b> You did better than ${Math.min(100, below)}% of players today.</p>`;
}

// ---------- Finished ----------
function finish() {
  const points = totalPoints();
  store.saveHindsightStats(recordResult(store.loadHindsightStats(), day.number, points));
  track.hindsightFinished(day.number, points);
  loadField();
}

export function recordResult(stats, number, points) {
  if (stats.lastPlayed != null && number <= stats.lastPlayed) return stats;
  const s = { ...stats, dist: { ...store.emptyHindsightStats().dist, ...stats.dist } };
  s.currentStreak = s.lastPlayed === number - 1 ? s.currentStreak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
  s.played += 1;
  s.totalPoints += points;
  s.dist[points] = (s.dist[points] || 0) + 1;
  s.lastPlayed = number;
  return s;
}
// Days played in a row. A skipped day breaks it even before the next game is played.
const displayStreak = (s, today) => (s.lastPlayed != null && s.lastPlayed >= today - 1 ? s.currentStreak : 0);

// e.g. "⏳ Hindsight #5 · 8/10", then 🟩 right, 🔥 right on a streak (2 points), 🟥 wrong.
const shareText = () => [`⏳ Hindsight #${day.number} · ${totalPoints()}/${MAX_POINTS}`, emojiRow(), `${CONFIG.SITE_URL}/hindsight`].join("\n");
const emojiRow = () => pointsList().map((p, k) => (p === 2 ? "🔥" : picks[k] ? "🟩" : "🟥")).join("");

function showResult(focus) {
  const points = totalPoints();
  document.body.classList.remove("hot");
  if (focus && points >= 7) { flash("ok"); embers(24); }
  const title = points === MAX_POINTS ? "Perfect hindsight!" : points >= 7 ? "Nicely done" : points >= 4 ? "Good effort" : "A tough day";
  drawProgress(-1);
  $("round").hidden = true;
  $("round").innerHTML = "";
  $("result").innerHTML = `
    <h2 tabindex="-1">${title} <span class="hs-score">${points}/${MAX_POINTS}</span></h2>
    <div class="emoji-row" aria-label="Your result">${emojiRow()}</div>
    <section class="everyone" id="field"${fieldHTML() ? "" : " hidden"}>${fieldHTML()}</section>
    ${recapHTML()}
    ${statsHTML()}
    <div class="btns"><button type="button" id="share-btn">Share</button></div>
    <p class="copied" id="copied" aria-live="polite"></p>
    <p>New matchups in <span class="countdown" data-countdown>${countdownText()}</span></p>`;
  $("result").hidden = false;
  if (focus) $("result").querySelector("h2").focus({ preventScroll: true });
}

function recapHTML() {
  const earned = pointsList();
  return `<ol class="hs-recap">${day.rounds.map((r, k) => `<li><span>${earned[k] === 2 ? "🔥" : picks[k] ? "🟩" : "🟥"}</span><span>
      <span class="line"><small>${esc(yearText(r.first))}</small> ${esc(r.first.event)}</span>
      <span class="line"><small>${esc(yearText(r.second))}</small> ${esc(r.second.event)}</span>
      <span class="pct">${earned[k] ? `+${earned[k]} ${earned[k] === 1 ? "point" : "points"}` : "No points"}</span></span></li>`).join("")}</ol>`;
}

function statsHTML() {
  const s = store.loadHindsightStats();
  const streak = day && day.number >= 1 ? displayStreak(s, day.number) : 0;
  // Points grouped into rows so the chart stays short.
  const groups = [["10", [10]], ["8–9", [8, 9]], ["6–7", [6, 7]], ["4–5", [4, 5]], ["0–3", [0, 1, 2, 3]]];
  const count = (g) => g.reduce((n, p) => n + (s.dist[p] || 0), 0);
  const max = Math.max(1, ...groups.map(([, g]) => count(g)));
  const mine = day && picks.length === ROUNDS && s.lastPlayed === day.number ? totalPoints() : null;
  return `<div class="stats">
      <div class="stat"><b>${s.played}</b><span>Played</span></div>
      <div class="stat"><b>${s.played ? (s.totalPoints / s.played).toFixed(1) : 0}</b><span>Average points</span></div>
      <div class="stat"><b>${streak}</b><span>Day streak</span></div>
      <div class="stat"><b>${s.bestStreak}</b><span>Best streak</span></div>
    </div>
    <h3 class="dist-h">Points</h3>
    <ol class="dist hs-dist">${groups.map(([label, g]) => {
      const v = count(g);
      return `<li${g.includes(mine) ? ` class="mine"` : ""}><span>${label}</span>
        <span class="bar" style="--w:${Math.max(8, (100 * v) / max)}%"><b>${v}</b></span></li>`;
    }).join("")}</ol>`;
}

async function share() {
  const text = shareText();
  const out = $("copied");
  // On phones, open the share sheet (Messages, WhatsApp…). Elsewhere, copy to the clipboard.
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ text }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    out.textContent = "Copied! Paste it anywhere.";
  } catch {
    out.innerHTML = `<textarea readonly rows="3" aria-label="Your result">${esc(text)}</textarea>`;
    out.querySelector("textarea").select();
  }
}

// ---------- Dialogs, countdown, events ----------
function openDialog(id) {
  if (id === "stats") $("stats-body").innerHTML = statsHTML();
  const d = $(id);
  if (!d.open) d.showModal();
}
function countdownText() {
  const s = Math.max(0, Math.floor(msUntilMidnight() / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
function tick() {
  if (day && todayKey() !== day.key) { loadDay(); return; }
  for (const el of document.querySelectorAll("[data-countdown]")) el.textContent = countdownText();
}

function bindEvents() {
  $("round").addEventListener("click", (e) => {
    const pick = e.target.closest(".pick");
    if (pick) answer(pick);
    else if (e.target.id === "next") next();
  });
  $("result").addEventListener("click", (e) => { if (e.target.id === "share-btn") share(); });
  $("help-btn").addEventListener("click", () => openDialog("help"));
  $("stats-btn").addEventListener("click", () => openDialog("stats"));
  $("help").addEventListener("close", () => store.markHindsightHelpSeen());
  for (const d of document.querySelectorAll("dialog")) {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}

init();
