// Gameplay stats sent to GoatCounter (free, no cookies, no personal data).
// Does nothing until CONFIG.GOATCOUNTER_CODE is filled in, and GoatCounter
// itself ignores visits from localhost, so testing on your computer isn't counted.
import { CONFIG } from "./config.js";

let ready = null;

function load() {
  if (!CONFIG.GOATCOUNTER_CODE) return null;
  if (!ready) {
    ready = new Promise((resolve) => {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://gc.zgo.at/count.js";
      s.dataset.goatcounter = `https://${CONFIG.GOATCOUNTER_CODE}.goatcounter.com/count`;
      s.onload = () => resolve(window.goatcounter);
      s.onerror = () => resolve(null); // blocked by an ad blocker, or offline: just skip
      document.head.appendChild(s);
    });
  }
  return ready;
}

// Counts the page visit. Call once when the page opens.
export const start = () => { load(); };

function send(name) {
  const p = load();
  if (!p) return;
  p.then((gc) => { try { gc && gc.count({ path: name, title: name, event: true }); } catch (e) { /* never break the game */ } });
}

// The first guess of a puzzle: this player started today's game.
export const started = (number) => send(`Puzzle ${number}: started`);

// The puzzle is over: solved on guess 1 to 5, or lost.
export const finished = (number, game) =>
  send(game.won ? `Puzzle ${number}: solved in ${game.guesses.length}` : `Puzzle ${number}: lost`);
