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
  GOATCOUNTER_CODE: "",
};
