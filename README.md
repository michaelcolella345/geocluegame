# GeoClue

A free daily geography trivia game. Each day there's one mystery country and five clues, ordered from hardest to easiest. Every wrong guess unlocks the next clue and tells you how far off you were and which direction to head.

It's a plain static website (HTML, CSS and JavaScript, with no build step, no backend and no accounts), so it can be hosted free on Cloudflare Pages.

## Run it on your computer

The game loads its data files with JavaScript, so it has to be served by a small local web server. Opening `index.html` directly won't work.

1. Open a terminal in this folder.
2. Run `python3 -m http.server 8000` (Python comes with macOS and most Linux systems). If you have Node.js installed, `npx serve` works too.
3. Go to <http://localhost:8000> in your browser.

To test a specific day, add `?date=2026-11-05` to the address. This only works on `localhost`.

## Folder layout

```
index.html            the game page
css/style.css         all styles
js/config.js          launch date, site URL, distance bands  ← settings live here
js/*.js               game code
data/countries.json   every guessable country: name, code, center lat/lon, aliases
data/puzzles.json     one puzzle per date
assets/               favicon, social preview image, fonts
tools/validate.js     checks the data files for mistakes
```

## Settings

`js/config.js` holds the values you're most likely to change:

- `LAUNCH_DATE`: the date of puzzle #1. The puzzle number is the number of days since this date, plus 1.
- `SITE_URL`: the address shown at the bottom of the Share text.

## Adding puzzles

Puzzles live in `data/puzzles.json`, one entry per date (`YYYY-MM-DD`). Each new day starts at the player's local midnight. If a date has no puzzle, players see a "back tomorrow" message.

```json
"2026-11-01": {
  "answer": "Portugal",
  "difficulty": "hard",
  "clues": [
    { "text": "Hardest clue first…", "source": "https://…" },
    { "text": "…", "source": "https://…" },
    { "text": "…", "source": "https://…" },
    { "text": "…", "source": "https://…" },
    { "text": "Easiest clue last (may name the capital).", "source": "https://…" }
  ],
  "didYouKnow": { "text": "A bonus fact shown after the game.", "source": "https://…" }
}
```

Rules:

- `answer` must match a `name` in `data/countries.json` exactly. Aliases don't count here.
- There must be exactly 5 clues, each with a source link, and clues 1–4 must not name the country.
- `difficulty`: `easy` for Monday to Wednesday, `hard` for Thursday to Sunday.
- Don't repeat a country within 60 days.

After editing, run the checker from this folder:

```
node tools/validate.js
```

It lists errors (✗) you must fix and warnings (!) worth a look, such as a gap in dates or the wrong difficulty for the weekday. You'll need [Node.js](https://nodejs.org) installed for this one command. The site itself doesn't need it.

Remember that `puzzles.json` is public. Anyone who opens the file can see future answers. That's normal for a game with no server.

## Country data

`data/countries.json` lists all 193 UN member states plus Taiwan, Kosovo, Palestine and Vatican City (197 in total). Vatican City can be guessed, but it's marked `"neverAnswer": true` so it won't be used as a puzzle answer.

The center points come from Google's public [canonical countries dataset](https://developers.google.com/public-data/docs/canonical/countries_csv). They were cross-checked against polygon centroids computed from [Natural Earth](https://www.naturalearthdata.com/) boundaries. Sudan and South Sudan use Natural Earth centroids because Google's Sudan point is from before the 2011 split.

For countries with far-off territories (the US, France, Norway and Malaysia, for example), the point sits in the main part of the country rather than the mathematical centroid, which tends to land in the sea or pulls toward Alaska or Svalbard.

To accept another spelling for a guess, add it to that country's `aliases` list. Matching ignores capitals, accents, punctuation, a leading "The", and treats "St" as "Saint".

## Deploying

Coming in stage 5: step-by-step instructions for GitHub, Cloudflare Pages and a custom domain.

## Ideas for later

- **Archive page** (`/archive`) to play past puzzles. Not built yet. The prototype's "Play another" practice mode was left out so that it can be folded into the archive instead.
