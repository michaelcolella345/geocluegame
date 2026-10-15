# GeoClue

A free daily geography trivia game. Each day there's one mystery country and five clues, ordered from hardest to easiest. Every wrong guess unlocks the next clue and tells you how far off you were and which direction to head.

It's a plain static website (HTML, CSS and JavaScript, with no build step and no accounts), plus one small Cloudflare Worker that tallies "How everyone did", all hosted free on Cloudflare.

## Run it on your computer

The game loads its data files with JavaScript, so it has to be served by a small local web server. Opening `index.html` directly won't work.

1. Open a terminal in this folder.
2. Run `python3 -m http.server 8000` (Python comes with macOS and most Linux systems). If you have Node.js installed, `npx serve` works too.
3. Go to <http://localhost:8000> in your browser.

To test a specific day, add `?date=2026-11-05` to the address. This only works on `localhost`.

## Folder layout

```
index.html            the game page
games.html            the More games page (linked from the ☰ menu)
hindsight.html        Hindsight, the "which came first?" game
css/style.css         all styles
js/config.js          launch date, site URL, distance bands  ← settings live here
js/*.js               game code
data/countries.json   every guessable country: name, code, center lat/lon, aliases
data/puzzles.json     one puzzle per date
data/hindsight.json   one set of six Hindsight matchups per date
data/map-shapes.json  country outlines for shading guesses on the live map
assets/               favicon, social preview image, fonts, map/terrain.jpg
tools/validate.js     checks the data files for mistakes
tools/map/            scripts that made the map image and outlines
worker/index.js       the small server that tallies "How everyone did"
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
- `difficulty`: `easy`, `medium` or `hard`. Hard puzzles go on Fridays only, and every Friday should be hard.
- Don't repeat a country within 60 days.

After editing, run the checker from this folder:

```
node tools/validate.js
```

It lists errors (✗) you must fix and warnings (!) worth a look, such as a gap in dates or a hard puzzle on a day other than Friday. You'll need [Node.js](https://nodejs.org) installed for this one command. The site itself doesn't need it.

Remember that `puzzles.json` is public. Anyone who opens the file can see future answers. That's normal for a game with no server.

## Look and sharing

- **Light/dark mode** follows the device setting until the player taps the sun/moon button. That choice is remembered.
- **Link previews:** `assets/og-image.png` is the picture shown when someone shares the link. Its source is `tools/og/og-image.html`. The full address `https://geocluegame.com` appears three times in `index.html` (`canonical`, `og:url`, `og:image`). Change those if the domain ever changes.
- **Icons:** `favicon.ico`, `assets/favicon.svg`, `assets/apple-touch-icon.png` and `assets/icon-192/512.png` (used when someone adds the game to their phone's home screen).
- **Fonts** (Bricolage Grotesque, IBM Plex Sans and IBM Plex Mono) are stored in `assets/fonts` under the SIL Open Font License, so the site makes no requests to Google.
- **Analytics:** there's a commented-out Cloudflare Web Analytics snippet near the top of `index.html`, with instructions for where to paste your token. On Cloudflare Pages you can skip the token and switch analytics on in the project settings instead (covered in the deploy steps).
- **Caching:** `_headers` tells Cloudflare to cache fonts for a year and always re-check the page, code and puzzles, so new puzzles show up right away.

## Country data

`data/countries.json` lists all 193 UN member states plus Taiwan, Kosovo, Palestine and Vatican City (197 in total). Vatican City can be guessed, but it's marked `"neverAnswer": true` so it won't be used as a puzzle answer.

The center points come from Google's public [canonical countries dataset](https://developers.google.com/public-data/docs/canonical/countries_csv). They were cross-checked against polygon centroids computed from [Natural Earth](https://www.naturalearthdata.com/) boundaries. Sudan and South Sudan use Natural Earth centroids because Google's Sudan point is from before the 2011 split.

For countries with far-off territories (the US, France, Norway and Malaysia, for example), the point sits in the main part of the country rather than the mathematical centroid, which tends to land in the sea or pulls toward Alaska or Svalbard.

To accept another spelling for a guess, add it to that country's `aliases` list. Matching ignores capitals, accents, punctuation, a leading "The", and treats "St" as "Saint".

## Live map

Under the clues is a map that shades each guessed country in its hot/warm/mild/cold color and drops a numbered pin on it. The answer turns green once the game is over. Players can drag it (it wraps around sideways like a globe) and pinch, scroll or tap + and − to zoom. The code is `js/map.js`. If the map files fail to load, the game still works without the map.

The background `assets/map/terrain.jpg` is a cartoon-style terrain picture with no country borders, so it doesn't give away country shapes. Only guessed countries get an outline. `data/map-shapes.json` holds those outlines (Natural Earth, public domain). Both are made by the scripts in `tools/map/`, and you only need to rerun them if `data/countries.json` gets a new country or the map style changes. Tuvalu is too small to have an outline, so it only gets a pin.

## How everyone did

After a game, the results screen shows what share of players solved today's puzzle and how many guesses they took. It never shows how many people played, and it stays hidden until at least 5 players have finished. Each browser sends its score once (just the puzzle number and 1–5 or X, nothing about the player) to `worker/index.js`, a small Cloudflare Worker that keeps one tally per puzzle in a Durable Object. Cloudflare creates that storage on deploy, so there's nothing to set up. Every other address is served as a plain file, as before. Set `EVERYONE_STATS: false` in `js/config.js` to hide the section. If the server can't be reached, the section simply doesn't appear.

`.assetsignore` keeps the server code from being published as part of the site.

If the site is also published as a Cloudflare Pages project (the `pages.dev` address), Pages can't run that Worker, so `functions/api/results.js` passes those requests on to the Worker's own address. Both addresses then share one tally.

## Hindsight

`hindsight.html` is a second daily game: six matchups of two events from history, and the player taps the one that happened first. After each pick it shows both years on a small timeline and a bonus fact about each event, with a link to read more. Each right pick is worth 1 point, and once a player has 2 in a row every right pick after that is worth 2, so a perfect day is 10. At the end it says "You did better than X% of players today". It uses GeoClue's layout and fonts with its own "Museum plum" colors (`css/hindsight.css`), keeps its own stats and day streak, and shares like this:

```
⏳ Hindsight #5 · 8/10
🟩🟩🔥🟥🟩🟩
geocluegame.com/hindsight
```

🟩 is a right pick, 🔥 a right pick on a streak (2 points) and 🟥 a miss. Right picks get a green flash, misses a shake, and a streak shows a "Heating up!" badge with a warm glow and embers. Players who turn off motion in their phone settings don't see the animations.

A GeoClue / Hindsight switch sits above the header on both games, and Hindsight is listed on the More games page.

Settings in `js/config.js`:

- `HINDSIGHT`: set to `false` to hide the game, its switch and its menu links.
- `HINDSIGHT_LAUNCH_DATE`: the date of Hindsight #1.
- `HINDSIGHT_STATS`: set to `false` to hide "You did better than X%". Like "How everyone did", it stays hidden until 5 players finish and never shows a player count. Each browser sends its points once to `/api/hindsight` in `worker/index.js`.

### Adding Hindsight matchups

Matchups live in `data/hindsight.json`, one entry per date with exactly six rounds. It's made by a script from a list of dated events:

1. Add events to `tools/hindsight/events.py`, and a bonus fact for each one to `tools/hindsight/facts.py` (the script stops if one is missing). Each has a year (negative for BC), the event, where it happened, its Wikipedia page, and optionally a `group` (events in the same group, like the start and end of one war, are never paired) and a `label` for approximate dates such as `"c. 1078"`.
2. Run `python3 tools/hindsight/make_matchups.py 2026-12-12 2027-02-28` with the first and last date you want. It rewrites those dates in `data/hindsight.json`, keeps every earlier day exactly as it was (people may have played them), and always gives the same result for the same events and dates. Only add events whose year is firmly established, not approximate or traditional.
3. Run `node tools/validate.js` to check the file.

Each day takes one matchup from six different eras (ancient, medieval, 1500–1799, 1800s, 1900–1945, 1946–1989, 1990 on) in random order, so a day jumps around the centuries. Some matchups are close calls and some are a bit easier. The two events are close in time but never a coin flip: from 2 to 7 years apart in recent decades, up to about 150 years in ancient times (the limits are `MINGAP` and `MAXGAP` in the script). Approximate dates are always at least 10 years from their partner.

To change one matchup by hand, edit `data/hindsight.json` directly: `first` must be the earlier event, and the game decides which one is shown on top. Rerunning the script would undo hand edits, so do those last.

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for step-by-step instructions: putting the files on GitHub, publishing free on Cloudflare Pages, connecting geocluegame.com, and turning on Web Analytics. It also covers everyday tasks like adding puzzles and rolling back a bad change.

In short: Cloudflare Pages, connected to the GitHub repo, framework preset **None**, build command **empty**, output directory **/**. Every commit to `main` goes live automatically.

## Ideas for later

- **Archive page** (`/archive`) to play past puzzles. Not built yet. The prototype's "Play another" practice mode was left out so that it can be folded into the archive instead.
