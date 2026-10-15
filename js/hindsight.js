// Hindsight: six matchups a day, tap the event that happened first.
// Matchups live in data/hindsight.json, one set of six per date.
import { CONFIG } from "./config.js";
import * as store from "./storage.js";
import * as track from "./track.js";
import "./nav.js";
import { localDateKey, daysBetween, msUntilMidnight } from "./game.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ROUNDS = 6;
const SENT_KEY = "geoclue:v1:hindsight:sent"; // puzzle number of the last result sent from this browser

let sets, day, picks = [], crowd = null;

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
function gapText(r) {
  const n = r.second.year - r.first.year;
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
  crowd = null;

  if (number < 1) { showNotice("Hindsight starts soon", `The first matchups arrive on ${prettyDate(CONFIG.HINDSIGHT_LAUNCH_DATE)}.`, `<a class="button" href="./">Play today's GeoClue</a>`); return; }
  if (!day.rounds || day.rounds.length !== ROUNDS) { showNotice("Back tomorrow!", "There are no matchups for today. New ones arrive at midnight.", `<a class="button" href="./">Play today's GeoClue</a>`); return; }

  $("notice").hidden = true;
  $("game").hidden = false;
  const saved = store.loadHindsightProgress();
  picks = saved && saved.date === key && Array.isArray(saved.picks) ? saved.picks.slice(0, ROUNDS) : [];
  loadCrowd(picks.length === ROUNDS);
  picks.length === ROUNDS ? showResult(false) : showRound();
}

// ---------- One matchup ----------
function drawProgress(current) {
  $("progress").innerHTML = Array.from({ length: ROUNDS }, (_, k) =>
    `<i class="${k < picks.length ? (picks[k] ? "ok" : "no") : k === current ? "now" : ""}"></i>`).join("");
}

function showRound() {
  const i = picks.length;
  const r = day.rounds[i];
  const pair = firstOnTop(day.key, i) ? [r.first, r.second] : [r.second, r.first];
  drawProgress(i);
  $("result").hidden = true;
  $("round").hidden = false;
  $("round").innerHTML = `
    <div class="hs-round">
      <div class="hs-q"><h2>Which came first?</h2><span>${i + 1} of ${ROUNDS}</span></div>
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

  for (const b of document.querySelectorAll(".pick")) {
    b.disabled = true;
    b.classList.add("shown");
    b.querySelector(".yr").hidden = false;
    if (b.dataset.first === "true") { b.classList.add("first"); b.insertAdjacentHTML("beforeend", `<span class="tag">Came first</span>`); }
    else if (b === btn) { b.classList.add("wrong"); b.insertAdjacentHTML("beforeend", `<span class="tag">Your pick</span>`); }
  }
  drawProgress(-1);
  const last = picks.length === ROUNDS;
  $("reveal").innerHTML = `
    <div class="card hs-reveal">
      <p class="hs-verdict ${right ? "ok" : "no"}" tabindex="-1">${right ? "Correct!" : "Not quite."} ${capital(gapText(r))}.</p>
      <div class="hs-tl" aria-hidden="true">
        <div class="axis"></div><div class="span"></div><span class="gap">${gapText(r)}</span>
        <div class="dot a"></div><div class="dot b"></div>
        <span class="lab a">${esc(yearText(r.first))}</span><span class="lab b">${esc(yearText(r.second))}</span>
      </div>
      <p class="hs-fact">${esc(r.fact)} <a href="${esc(r.source)}" target="_blank" rel="noopener">Source</a></p>
      <div class="hs-crowd" id="crowd-now"${crowdPct(i) == null ? " hidden" : ""}>${crowdHTML(i)}</div>
      <div class="btns"><button type="button" id="next">${last ? "See my score" : "Next matchup"}</button></div>
    </div>`;
  $("next").focus({ preventScroll: true });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("reveal").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
}
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function next() {
  if (picks.length === ROUNDS) { showResult(true); return; }
  showRound();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("progress").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
}

// ---------- Players who got it right ----------
// Read today's numbers when the page opens. The finished game is sent once, anonymously
// (just the six right/wrong answers), to worker/index.js. Nothing shows until 5 players finish.
async function loadCrowd(finished) {
  if (!CONFIG.HINDSIGHT_STATS || day.number < 1) return;
  const number = day.number;
  let lastSent = 0;
  try { lastSent = Number(localStorage.getItem(SENT_KEY)); } catch { /* not saved */ }
  const send = finished && lastSent !== number;
  try {
    const r = await fetch(`api/hindsight?puzzle=${number}`, send
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ picks }) }
      : { cache: "no-store" });
    if (!r.ok || day.number !== number) return;
    if (send) { try { localStorage.setItem(SENT_KEY, String(number)); } catch { /* not saved */ } }
    crowd = await r.json();
  } catch { return; }
  // Fill in anything already on screen.
  const now = $("crowd-now");
  if (now && picks.length) { now.innerHTML = crowdHTML(picks.length - 1); now.hidden = crowdPct(picks.length - 1) == null; }
  if (!$("result").hidden) $("recap").outerHTML = recapHTML();
}
const crowdPct = (i) => (crowd && crowd.enough && Array.isArray(crowd.percent) ? crowd.percent[i] : null);
function crowdHTML(i) {
  const p = crowdPct(i);
  if (p == null) return "";
  return `<div class="row2"><span>Players who got this right</span><span>${p}%</span></div>
    <div class="bar"><i style="width:${p}%"></i></div>`;
}

// ---------- Finished ----------
function finish() {
  const right = picks.filter(Boolean).length;
  store.saveHindsightStats(recordResult(store.loadHindsightStats(), day.number, right));
  track.hindsightFinished(day.number, right);
  loadCrowd(true);
}

export function recordResult(stats, number, right) {
  if (stats.lastPlayed != null && number <= stats.lastPlayed) return stats;
  const s = { ...stats, dist: { ...store.emptyHindsightStats().dist, ...stats.dist } };
  s.currentStreak = s.lastPlayed === number - 1 ? s.currentStreak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
  s.played += 1;
  s.totalRight += right;
  s.dist[right] += 1;
  s.lastPlayed = number;
  return s;
}
// Days played in a row. A skipped day breaks it even before the next game is played.
const displayStreak = (s, today) => (s.lastPlayed != null && s.lastPlayed >= today - 1 ? s.currentStreak : 0);

function shareText() {
  const right = picks.filter(Boolean).length;
  const streak = displayStreak(store.loadHindsightStats(), day.number);
  const fire = streak >= 2 ? ` 🔥${streak}` : "";
  return `Hindsight #${day.number} ${right}/${ROUNDS}${fire}\n${picks.map((p) => (p ? "🟩" : "🟥")).join("")}\n${CONFIG.SITE_URL}/hindsight`;
}

function showResult(focus) {
  const right = picks.filter(Boolean).length;
  const title = right === 6 ? "Perfect hindsight!" : right >= 4 ? "Nicely done" : right >= 2 ? "Good effort" : "A tough day";
  drawProgress(-1);
  $("round").hidden = true;
  $("round").innerHTML = "";
  $("result").innerHTML = `
    <h2 tabindex="-1">${title} <span class="hs-score">${right}/${ROUNDS}</span></h2>
    <div class="emoji-row" aria-label="Your result">${picks.map((p) => (p ? "🟩" : "🟥")).join("")}</div>
    ${recapHTML()}
    ${statsHTML()}
    <div class="btns"><button type="button" id="share-btn">Share</button></div>
    <p class="copied" id="copied" aria-live="polite"></p>
    <p>New matchups in <span class="countdown" data-countdown>${countdownText()}</span></p>`;
  $("result").hidden = false;
  if (focus) $("result").querySelector("h2").focus({ preventScroll: true });
}

function recapHTML() {
  return `<ol class="hs-recap" id="recap">${day.rounds.map((r, k) => {
    const p = crowdPct(k);
    return `<li><span>${picks[k] ? "🟩" : "🟥"}</span><span>
      <span class="line"><small>${esc(yearText(r.first))}</small> ${esc(r.first.event)}</span>
      <span class="line"><small>${esc(yearText(r.second))}</small> ${esc(r.second.event)}</span>
      ${p == null ? "" : `<span class="pct">${p}% of players got this right</span>`}</span></li>`;
  }).join("")}</ol>`;
}

function statsHTML() {
  const s = store.loadHindsightStats();
  const streak = day && day.number >= 1 ? displayStreak(s, day.number) : 0;
  const keys = [6, 5, 4, 3, 2, 1, 0];
  const max = Math.max(1, ...keys.map((k) => s.dist[k] || 0));
  const mine = day && picks.length === ROUNDS && s.lastPlayed === day.number ? picks.filter(Boolean).length : null;
  return `<div class="stats">
      <div class="stat"><b>${s.played}</b><span>Played</span></div>
      <div class="stat"><b>${s.played ? (s.totalRight / s.played).toFixed(1) : 0}</b><span>Average score</span></div>
      <div class="stat"><b>${streak}</b><span>Day streak</span></div>
      <div class="stat"><b>${s.bestStreak}</b><span>Best streak</span></div>
    </div>
    <h3 class="dist-h">Score distribution</h3>
    <ol class="dist">${keys.map((k) => {
      const v = s.dist[k] || 0;
      return `<li${k === mine ? ` class="mine"` : ""}><span>${k}</span>
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
