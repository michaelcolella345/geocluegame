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

export const loadTheme = () => get("theme", null); // "light" | "dark" | null (follow device)
export const saveTheme = (t) => set("theme", t);

// Hindsight (hindsight.html) keeps its own progress, stats and help flag. The theme is shared.
// Today's game: { date, picks: [true/false per matchup answered] }
export const loadHindsightProgress = () => get("hindsight:progress", null);
export const saveHindsightProgress = (p) => set("hindsight:progress", p);
export const emptyHindsightStats = () => ({
  played: 0, totalRight: 0, currentStreak: 0, bestStreak: 0,
  dist: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  lastPlayed: null, // puzzle number of the last finished game
});
export const loadHindsightStats = () => ({ ...emptyHindsightStats(), ...get("hindsight:stats", {}) });
export const saveHindsightStats = (s) => set("hindsight:stats", s);
export const hasSeenHindsightHelp = () => get("hindsight:seenHelp", false);
export const markHindsightHelpSeen = () => set("hindsight:seenHelp", true);
