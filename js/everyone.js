// "How everyone did today" on the results screen. Each finished game is sent once, anonymously
// (just the puzzle number and the score), to worker/index.js, which answers with the share of
// players for each score. No player count is shown. If anything fails, the section stays hidden.

const KEY = "geoclue:v1:sentResult"; // puzzle number of the last result sent from this browser
const SCORES = ["1", "2", "3", "4", "5", "X"];

const lastSent = () => { try { return Number(localStorage.getItem(KEY)); } catch { return 0; } };
const markSent = (n) => { try { localStorage.setItem(KEY, String(n)); } catch { /* not saved */ } };

// Sends this game's score the first time, otherwise just reads. Resolves to the summary or null.
export async function fetchEveryone(puzzle, score) {
  const url = `api/results?puzzle=${puzzle}`;
  const send = lastSent() !== puzzle;
  try {
    const r = await fetch(url, send
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ score: String(score) }) }
      : { cache: "no-store" });
    if (!r.ok) return null;
    if (send) markSent(puzzle);
    return await r.json();
  } catch {
    return null;
  }
}

// The section's HTML. data: the summary from the server. mine: "1"–"5" or "X".
export function everyoneHTML(data, mine) {
  if (!data) return "";
  const head = `<h3>How everyone did today</h3>`;
  if (!data.enough) return `${head}<p class="everyone-wait">Not enough players have finished yet. Check back later to see how you compare.</p>`;
  const p = data.percent;
  const solved = 100 - p.X;
  const max = Math.max(1, ...SCORES.map((s) => p[s]));
  const better = SCORES.slice(SCORES.indexOf(mine) + 1).reduce((n, s) => n + p[s], 0);
  const common = ["1", "2", "3", "4", "5"].reduce((a, s) => (p[s] > p[a] ? s : a), "1");
  const line = mine === "X"
    ? `You weren't alone: ${p.X}% of players missed it too.`
    : `You did better than <b>${better}%</b> of players.` + (p[common] ? ` ${common} ${common === "1" ? "guess" : "guesses"} was the most common winning score.` : "");
  return `${head}
    <p class="everyone-big"><b>${solved}%</b> solved it</p>
    <ol class="everyone-bars" aria-label="Share of players by number of guesses">${SCORES.map((s, i) => `
      <li class="${s === mine ? "you" : ""}${s === "X" ? " x" : ""}" style="--i:${i}">
        <span>${s}</span>
        <span class="track" style="--w:${(100 * p[s]) / max}%"><span class="fill"></span>${s === mine ? `<span class="you-label${p[s] / max > 0.65 ? " inside" : ""}">${p[s] / max > 0.65 ? "you" : "← you"}</span>` : ""}</span>
        <span class="pct">${p[s]}%</span>
      </li>`).join("")}
    </ol>
    <p class="everyone-line">${line}</p>`;
}
