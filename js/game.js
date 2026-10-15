// Daily puzzle selection, guesses, and stats. No DOM code here.
import { CONFIG } from "./config.js";
import { distanceMiles, bearing, band } from "./geo.js";
import { emptyStats } from "./storage.js";

const pad = (n) => String(n).padStart(2, "0");

// The player's local calendar date as "YYYY-MM-DD".
export const localDateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Whole days between two "YYYY-MM-DD" dates (timezone-proof: both are treated as UTC midnights).
const dayIndex = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 864e5;
export const daysBetween = (fromKey, toKey) => dayIndex(toKey) - dayIndex(fromKey);

// Puzzle #1 is the launch date.
export const puzzleNumber = (dateKey) => daysBetween(CONFIG.LAUNCH_DATE, dateKey) + 1;

// Milliseconds until the player's next local midnight.
export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

// Today's puzzle, or a reason there isn't one: "before-launch" or "missing".
export function puzzleFor(dateKey, puzzles) {
  const number = puzzleNumber(dateKey);
  if (number < 1) return { status: "before-launch", number, dateKey };
  const p = puzzles[dateKey];
  if (!p) return { status: "missing", number, dateKey };
  return { status: "ok", number, dateKey, puzzle: p };
}

// Saved progress if it belongs to today's puzzle, otherwise a fresh game.
export function startGame(day, saved) {
  if (saved && saved.date === day.dateKey && saved.answer === day.puzzle.answer && Array.isArray(saved.guesses)) return saved;
  return { date: day.dateKey, answer: day.puzzle.answer, guesses: [], done: false, won: false };
}

// Distance, direction and band for one guess. Recomputed from names so saved games stay small.
export function scoreGuess(name, answer, byName) {
  const g = byName.get(name), a = byName.get(answer);
  const correct = name === answer;
  const miles = correct ? 0 : distanceMiles(g, a);
  return { name, correct, miles, bearing: correct ? 0 : bearing(g, a), band: band(miles, correct) };
}

// How many clues the player can see.
export const cluesShown = (game) => (game.done ? 5 : Math.min(5, game.guesses.length + 1));

// Apply a guess (an exact country name). Returns { game, error }. Doesn't mutate the input.
export function applyGuess(game, name) {
  if (game.done) return { game, error: "This puzzle is finished." };
  if (game.guesses.includes(name)) return { game, error: `You already guessed ${name}.` };
  const guesses = [...game.guesses, name];
  const won = name === game.answer;
  const done = won || guesses.length >= CONFIG.MAX_GUESSES;
  return { game: { ...game, guesses, won, done }, error: null };
}

// Record a finished game in stats once. Puzzles only count in order, so an
// older puzzle (or the same one again) never changes stats or streaks.
export function recordResult(stats, number, game) {
  if (!game.done || (stats.lastPlayed != null && number <= stats.lastPlayed)) return stats;
  const s = { ...stats, dist: { ...emptyStats().dist, ...stats.dist } };
  s.played += 1;
  s.lastPlayed = number;
  if (game.won) {
    s.wins += 1;
    s.currentStreak = s.lastWon === number - 1 ? s.currentStreak + 1 : 1;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    s.lastWon = number;
    s.dist[game.guesses.length] += 1;
  } else {
    s.currentStreak = 0;
    s.dist.fail += 1;
  }
  return s;
}

// The streak to display today: a skipped day breaks it even before the next game is played.
export function displayStreak(stats, todayNumber) {
  if (stats.lastWon == null) return 0;
  return stats.lastWon >= todayNumber - 1 ? stats.currentStreak : 0;
}

// The text the Share button copies, e.g. "GeoClue #12 3/5\n🟨🟧🟩\ngeocluegame.com".
// The streak stays in the stats on screen, not in the share text.
export function shareText(number, game, scored, emoji) {
  const score = game.won ? game.guesses.length : "X";
  return `GeoClue #${number} ${score}/${CONFIG.MAX_GUESSES}\n${scored.map((g) => emoji[g.band]).join("")}\n${CONFIG.SITE_URL}`;
}
