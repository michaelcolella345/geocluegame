# GeoClue build plan

Starting point: `geoclue-prototype.html` ("Clue Trail"). Its gameplay, distance/compass math, color bands and visual style (sea-chart palette, Bricolage Grotesque + IBM Plex fonts) carry over. Everything is renamed to GeoClue.

## Choices I'm making (tell me if you want any changed)

| Question | My default | Why |
|---|---|---|
| Build tool | **None.** Plain HTML/CSS/JS, no Vite, no npm. | Cloudflare Pages can serve the folder as-is, with no build command to configure or break. Running locally is one command. |
| Launch date | **2026-11-01** = GeoClue #1 | Matches your example key. It's one value in `js/config.js`. |
| Site URL in share text | `geocluegame.com` | Michael's domain. One value in `js/config.js`. |
| Vatican City | **Kept** as a guessable country (197 total) | It's in the prototype and players will try it. It won't be used as an answer unless you want it. |
| Prototype's "Play another" practice mode | **Removed** | Not in your spec, and it overlaps with the future archive. Noted in the README. |
| Fonts | **Self-hosted** (no Google Fonts call) | Faster first load and no third-party requests. |
| Share emoji | 🟥 hot · 🟧 warm · 🟨 mild · 🟦 cold · 🟩 correct | Same as prototype; matches your example row. |
| Answers are visible in `puzzles.json` | **Accepted** | Unavoidable with no backend. Only someone digging in dev tools would see them. |

## Folder layout

```
geoclue/
├── index.html            the game (one page)
├── css/style.css
├── js/
│   ├── config.js         LAUNCH_DATE, SITE_URL, MAX_GUESSES
│   ├── geo.js            distance (miles), bearing, color band
│   ├── data.js           loads countries + puzzles, alias matching
│   ├── storage.js        localStorage: today's progress, stats
│   ├── game.js           daily puzzle, guesses, win/lose
│   └── ui.js             rendering, autocomplete, modals, share, countdown
├── data/
│   ├── countries.json    197 countries: name, lat, lon, aliases
│   └── puzzles.json      "2026-11-01": { answer, clues[5], sources[5], didYouKnow }
├── assets/               favicon, og-image.png (1200×630), fonts
├── tools/validate.js     checks the data (see below)
├── _headers              Cloudflare caching rules
├── 404.html
├── README.md
└── FACT-CHECK.md         (stage 4)
```

## Stage 1: structure + data files
- Create the folder layout above and a local git repo.
- `countries.json`: all 193 UN members + Taiwan, Kosovo, Palestine (+ Vatican). Center coordinates re-checked against a published centroid dataset, not just copied from the prototype. Aliases such as USA, US, America, UK, Britain, Ivory Coast / Côte d'Ivoire, Czech Republic, DRC, Burma, Holland, Türkiye, Swaziland, East Timor.
- `puzzles.json`: the 11 prototype puzzles converted to the new format with sources, as placeholders until stage 4.
- `tools/validate.js`: checks every answer exists in countries.json, every puzzle has exactly 5 clues + 5 sources + a fact, no country repeats within 60 days, no gaps in dates. You'd run it before adding puzzles.

## Stage 2: game logic
- Today's puzzle = the entry for the player's **local** date; puzzle number = days since launch + 1. Resets at local midnight (and if the tab is left open past midnight).
- No entry for today → friendly "Back tomorrow" screen with countdown.
- Guess matching: case/accent-insensitive names + aliases; autocomplete with arrow keys/Enter; duplicate and unknown guesses rejected without using a turn.
- Each wrong guess: next clue unlocks, plus distance in miles, compass arrow, color band. 5 guesses max.
- localStorage: today's progress (refresh-safe), stats (played, wins, current streak, best streak, guess distribution 1–5 + losses). Fixes a prototype bug where a skipped day didn't break the streak correctly.
- Share text: `GeoClue #12 3/5`, emoji row, `geocluegame.com`. Copies to clipboard; uses the phone's share sheet when available.

## Stage 3: UI polish
- Results screen: answer, "Did you know?" fact, emoji row, stats, guess-distribution bar chart, Share button, countdown to next puzzle.
- "How to play" modal: opens automatically on first visit, then from a **?** icon.
- Light/dark mode following the device setting, plus a toggle.
- Mobile-first layout; keyboard accessible (focus outlines, modals trap focus, Esc closes, screen-reader labels on arrows and colors); respects reduced-motion.
- Favicon, Open Graph + Twitter card tags, a 1200×630 preview image.
- Cloudflare Web Analytics snippet, commented out, with a note saying exactly where to paste your token.
- Target: whole page under ~100 KB before fonts, no external requests except analytics.

## Stage 4: 60 puzzles + fact-check
- 60 puzzles, 2026-11-01 → 2026-12-30, each country used once.
- Mix of continents. **Hard puzzles on Fridays only** (changed by Michael 2026-10-13); easy and medium anywhere else.
- Includes Michael's 30 puzzles (uploads/geoclue-puzzles-michael.json); I write the other 30. His file has one reference per puzzle, so I'll add a source for each clue, and his "verify" notes go into FACT-CHECK.md.
- Clues ordered hardest → easiest, specific and interesting (no bare population/area stats). Clue 5 may name the capital. Each clue gets a source URL (Britannica, CIA World Factbook, UNESCO, national/official sites, etc.).
- Separate fact-check pass on every clue → `FACT-CHECK.md` listing anything I'm not fully confident in, with the reason, for you to verify.

## Stage 5: deployment
- README: run locally, add puzzles, deploy; note that an `/archive` page is planned for later.
- Step-by-step guide written for a non-developer: create a GitHub repo and push, connect it to Cloudflare Pages (no build command), add your custom domain, turn on Web Analytics. I'll ask before creating any GitHub repo or pushing anything.

I'll stop and check in with you after each stage.
