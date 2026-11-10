// Everything GeoClue remembers lives in the browser's localStorage.
// Reads and writes never throw: private browsing or blocked storage just means nothing is saved.

const PREFIX = "geoclue:v1:";

function get(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* not saved */ }
}

// Today's game: { date, answer, guesses: [country names], done, won }
export const loadProgress = () => get("progress", null);
export const saveProgress = (p) => set("progress", p);

export const emptyStats = () => ({
  played: 0, wins: 0, currentStreak: 0, bestStreak: 0,
  dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, fail: 0 },
  lastPlayed: null, // puzzle number of the last finished game
  lastWon: null,    // puzzle number of the last win
});
export const loadStats = () => ({ ...emptyStats(), ...get("stats", {}) });
export const saveStats = (s) => set("stats", s);

export const hasSeenHelp = () => get("seenHelp", false);
export const markHelpSeen = () => set("seenHelp", true);

// The guess map: on unless the player switched it off.
export const loadMapOn = () => get("mapOn", true) !== false;
export const saveMapOn = (on) => set("mapOn", on);

export const loadTheme = () => get("theme", null); // "light" | "dark" | null (follow device)
export const saveTheme = (t) => set("theme", t);

// Hindsight (hindsight.html) keeps its own progress, stats and help flag. The theme is shared.
// Today's game: { date, picks: [true/false per matchup answered] }
export const loadHindsightProgress = () => get("hindsight:progress", null);
export const saveHindsightProgress = (p) => set("hindsight:progress", p);
export const emptyHindsightStats = () => ({
  played: 0, totalPoints: 0, currentStreak: 0, bestStreak: 0,
  dist: {}, // points (0 to 10) -> number of games
  lastPlayed: null, // puzzle number of the last finished game
});
export const loadHindsightStats = () => ({ ...emptyHindsightStats(), ...get("hindsight:stats", {}) });
export const saveHindsightStats = (s) => set("hindsight:stats", s);
export const hasSeenHindsightHelp = () => get("hindsight:seenHelp", false);
export const markHindsightHelpSeen = () => set("hindsight:seenHelp", true);

// Past games (js/archive.js): every game this browser has played, by date, so the calendar can
// show which days are done and old puzzles can be replayed. Replays are saved here only, never
// in the progress or stats above.
// GeoClue: { "YYYY-MM-DD": { guesses: [country names], done, won } }
// Hindsight: { "YYYY-MM-DD": { picks: [true/false per matchup] } }
export const loadHistory = () => get("history", {}) || {};
export function saveHistoryDay(dateKey, g) {
  set("history", { ...loadHistory(), [dateKey]: { guesses: g.guesses, done: g.done, won: g.won } });
}
export const loadHindsightHistory = () => get("hindsight:history", {}) || {};
export function saveHindsightHistoryDay(dateKey, picks) {
  set("hindsight:history", { ...loadHindsightHistory(), [dateKey]: { picks } });
}
// Games finished before the calendar existed: the last saved game of each kind still counts.
export function backfillHistory() {
  const g = loadProgress();
  if (g && g.done && g.date && !loadHistory()[g.date]) saveHistoryDay(g.date, g);
  const h = loadHindsightProgress();
  if (h && h.date && Array.isArray(h.picks) && h.picks.length === 6 && !loadHindsightHistory()[h.date]) saveHindsightHistoryDay(h.date, h.picks);
}
