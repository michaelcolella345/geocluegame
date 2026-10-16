# Promo video generator

Makes a short vertical video (1080×1920, about 17 seconds) for TikTok and Instagram Reels from the
day's real GeoClue puzzle: the logo, puzzle number and difficulty, the first three clues one at a
time, then "Think you know it?" and geocluegame.com. It never shows today's answer.

## The one command

Run this from the top folder of the repo:

```
node tools/promo/make-video.mjs
```

It picks today's puzzle (by the US Eastern date) and writes three files to `tools/promo/out/`:

- `geoclue-<number>-<date>.mp4`, the video
- `geoclue-<number>-<date>-cover.png`, a still for the cover/thumbnail
- `geoclue-<number>-<date>-caption.txt`, a suggested caption with hashtags

It asks no questions. If something is wrong (for example there is no puzzle for that day yet) it
prints why and stops with an error code, so a scheduled run shows as failed.

## Options

| Option | What it does |
| --- | --- |
| `--date 2026-10-20` | Make the video for that day instead of today |
| `--puzzle 8` | Make the video for puzzle #8 |
| `--clues 2` | Show 1 to 4 clues (default 3; the last clue is never shown) |
| `--theme dark` | Use the site's dark colors |
| `--no-yesterday` | Leave out "Yesterday's country was …" at the end |
| `--tz America/Los_Angeles` | Which time zone decides "today" |
| `--out path/to/file.mp4` | Save somewhere else |

## What it needs

Node, headless Chromium through Playwright, and ffmpeg. Claude's cloud machines already have all
three. On another computer, the script installs Playwright and ffmpeg into `tools/promo` by itself
the first time.

The video has a silent sound track; pick a sound in TikTok or Instagram when posting.

Nothing in `tools/` is published to the website (see `.assetsignore`), and the videos in
`tools/promo/out/` are not saved to GitHub.
