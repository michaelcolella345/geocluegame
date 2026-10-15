// Header controls shared by every page: the ☰ menu, the light/dark toggle and the game switch.
import * as store from "./storage.js";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);

// ---------- Menu ----------
function setupMenu() {
  const btn = $("menu-btn");
  const menu = $("menu");
  if (!btn || !menu) return;

  const isOpen = () => btn.getAttribute("aria-expanded") === "true";
  const open = () => {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Close menu");
    menu.querySelector("a")?.focus();
  };
  const close = (refocus) => {
    if (!isOpen()) return;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
    if (refocus) btn.focus();
  };

  btn.addEventListener("click", () => (isOpen() ? close(false) : open()));
  // Tapping anywhere outside the menu closes it.
  document.addEventListener("click", (e) => {
    if (isOpen() && !menu.contains(e.target) && !btn.contains(e.target)) close(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) close(true); });
  menu.addEventListener("focusout", (e) => {
    if (isOpen() && e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== btn) close(false);
  });
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) close(false); });
}

// ---------- Light / dark ----------
// Follows the device setting until the player picks one with the toggle.
function currentTheme() {
  return document.documentElement.dataset.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function updateThemeButton() {
  $("theme-btn").setAttribute("aria-label", currentTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode");
}
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store.saveTheme(next);
  updateThemeButton();
}
function setupTheme() {
  if (!$("theme-btn")) return;
  $("theme-btn").addEventListener("click", toggleTheme);
  updateThemeButton();
}

// ---------- Game switch ----------
// The GeoClue / Hindsight switch and Hindsight's menu links disappear if Hindsight is switched off.
function setupGames() {
  if (CONFIG.HINDSIGHT !== false) return;
  for (const el of document.querySelectorAll("[data-hindsight]")) el.remove();
}

setupMenu();
setupTheme();
setupGames();
