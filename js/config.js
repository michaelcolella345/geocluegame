// GeoClue settings. These are the only values you should need to change.

export const CONFIG = {
  // The date of puzzle #1 (YYYY-MM-DD). Puzzle number = days since this date + 1.
  LAUNCH_DATE: "2026-10-13",

  // Shown on the last line of the Share text.
  SITE_URL: "geocluegame.com",

  MAX_GUESSES: 5,

  // Distance bands in miles: under HOT is hot, under WARM is warm, under MILD is mild, otherwise cold.
  BANDS: { HOT: 500, WARM: 1500, MILD: 3500 },

  // Your GoatCounter code (the "xxx" in xxx.goatcounter.com) for gameplay stats:
  // how many people start each puzzle, solve it on each guess, or lose.
  // Leave it as "" to turn stats off.
  GOATCOUNTER_CODE: "geocluegame",

  // The 2026 refresh: new look and smoother animations on every page (css/refresh.css).
  // Set to false to go back to the previous look and animations.
  NEW_LOOK: true,

  // "Past games" in the ☰ menu: a calendar of earlier days to replay. Replays never change
  // streaks, stats or "How everyone did". Set to false to hide it.
  ARCHIVE: true,

  // The live map under the clues. Set to false to hide it and play without a map.
  LIVE_MAP: true,

  // "How everyone did today" on the results screen. Set to false to hide it.
  EVERYONE_STATS: true,

  // A soft green flash across the screen when you find the country. Set to false to turn it off.
  WIN_FLASH: true,

  // Hindsight, the "which came first?" game (hindsight.html). Set to false to hide it everywhere.
  HINDSIGHT: true,

  // A "Play Hindsight" button next to Share on GeoClue's results. Set to false to hide it.
  HINDSIGHT_BUTTON: true,

  // The date of Hindsight #1 (YYYY-MM-DD). Its matchups live in data/hindsight.json.
  HINDSIGHT_LAUNCH_DATE: "2026-10-15",

  // "Players who got this right" after each Hindsight matchup. Set to false to hide it.
  HINDSIGHT_STATS: true,
};
