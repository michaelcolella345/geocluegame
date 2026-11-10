// "Past games" in the ☰ menu: a dropdown calendar of earlier days. Each day shows its date and,
// for GeoClue, how hard it was; days this browser has finished turn green. Tapping a day replays
// it (?day=YYYY-MM-DD). Switch it off with ARCHIVE: false in js/config.js.
import { CONFIG } from "./config.js";
import * as store from "./storage.js";
import { todayKey, daysBetween } from "./game.js";

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const hindsightOn = CONFIG.HINDSIGHT !== false;
const onHindsight = document.documentElement.classList.contains("hindsight");
let game = onHindsight && hindsightOn ? "hindsight" : "geoclue";
let month = null; // { y, m } being shown
const data = {};  // game -> puzzles by date, once loaded

const GAMES = {
  geoclue: { launch: CONFIG.LAUNCH_DATE, file: "data/puzzles.json", page: "./" },
  hindsight: { launch: CONFIG.HINDSIGHT_LAUNCH_DATE, file: "data/hindsight.json", page: "hindsight.html" },
};

function setup() {
  const list = document.querySelector("#menu ul");
  if (CONFIG.ARCHIVE === false || !list) return;
  // Before the game page replaces yesterday's saved game with today's.
  store.backfillHistory();
  const li = document.createElement("li");
  li.className = "archive";
  li.innerHTML = `
    <button type="button" class="archive-btn" id="archive-btn" aria-expanded="false" aria-controls="archive-panel">
      Past games<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="archive-panel" id="archive-panel" hidden>
      ${hindsightOn ? `<div class="cal-games" role="group" aria-label="Game">
        <button type="button" data-game="geoclue">GeoClue</button><button type="button" data-game="hindsight">Hindsight</button>
      </div>` : ""}
      <div class="cal-head">
        <button type="button" class="cal-nav" data-step="-1" aria-label="Previous month">‹</button>
        <b id="cal-title" aria-live="polite"></b>
        <button type="button" class="cal-nav" data-step="1" aria-label="Next month">›</button>
      </div>
      <div class="cal-grid" id="cal-grid"></div>
      <p class="cal-key"><i aria-hidden="true"></i>Played</p>
    </div>`;
  // Just above "More games" (the last link).
  list.insertBefore(li, list.lastElementChild);

  const btn = $("archive-btn"), panel = $("archive-panel");
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    document.getElementById("menu").classList.toggle("wide", open);
    if (open) show();
  });
  panel.addEventListener("click", (e) => {
    const g = e.target.closest("[data-game]");
    if (g) { game = g.dataset.game; month = null; show(); return; }
    const s = e.target.closest("[data-step]");
    if (s) { stepMonth(Number(s.dataset.step)); draw(); }
  });
}

// Months from the game's launch up to this month.
function bounds() {
  const [ly, lm] = GAMES[game].launch.split("-").map(Number);
  const [ty, tm] = todayKey().split("-").map(Number);
  return { first: ly * 12 + lm - 1, last: ty * 12 + tm - 1 };
}
function stepMonth(step) {
  const { first, last } = bounds();
  const n = Math.min(last, Math.max(first, month.y * 12 + month.m + step));
  month = { y: Math.floor(n / 12), m: n % 12 };
}

async function show() {
  if (!month) { const [y, m] = todayKey().split("-").map(Number); month = { y, m: m - 1 }; stepMonth(0); }
  for (const b of document.querySelectorAll(".cal-games button")) b.setAttribute("aria-pressed", String(b.dataset.game === game));
  draw();
  if (data[game]) return;
  const wanted = game;
  try {
    const r = await fetch(GAMES[wanted].file);
    if (!r.ok) throw new Error(r.status);
    data[wanted] = await r.json();
  } catch { data[wanted] = {}; }
  if (game === wanted) draw();
}

function draw() {
  const { launch, page } = GAMES[game];
  const today = todayKey();
  const puzzles = data[game];
  const history = game === "geoclue" ? store.loadHistory() : store.loadHindsightHistory();
  const finished = (k) => game === "geoclue" ? !!(history[k] && history[k].done) : !!(history[k] && history[k].picks && history[k].picks.length === 6);

  const { first, last } = bounds();
  const at = month.y * 12 + month.m;
  $("cal-title").textContent = `${MONTHS[month.m]} ${month.y}`;
  const [prev, next] = document.querySelectorAll(".cal-nav");
  prev.disabled = at <= first;
  next.disabled = at >= last;

  const days = new Date(month.y, month.m + 1, 0).getDate();
  const lead = new Date(month.y, month.m, 1).getDay();
  let html = ["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span class="cal-dow" aria-hidden="true">${d}</span>`).join("");
  html += `<span></span>`.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const k = key(month.y, month.m, d);
    const isToday = k === today;
    const open = puzzles && puzzles[k] && daysBetween(launch, k) >= 0 && daysBetween(k, today) >= 0;
    if (!open) { html += `<span class="cal-day off">${d}</span>`; continue; }
    const level = game === "geoclue" ? puzzles[k].difficulty : null;
    const played = finished(k);
    const when = new Date(month.y, month.m, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const label = [isToday ? "Today" : when, LABEL[level], played ? "played" : ""].filter(Boolean).join(", ");
    html += `<a class="cal-day${played ? " played" : ""}${isToday ? " today" : ""}" href="${isToday ? page : `${page}?day=${k}`}" aria-label="${label}">
      <b>${d}</b>${level ? `<small class="${level}">${LABEL[level]}</small>` : ""}</a>`;
  }
  $("cal-grid").innerHTML = html;
}

setup();
