#!/usr/bin/env node
// Makes a short vertical GeoClue promo video (1080×1920 MP4) for TikTok and Instagram Reels
// from today's real puzzle. It shows the first clues as a teaser, never the answer.
//
//   node tools/promo/make-video.mjs                 today's puzzle (US Eastern date)
//   node tools/promo/make-video.mjs --date 2026-10-20
//   node tools/promo/make-video.mjs --puzzle 8
//
// Other options: --clues 1-4 (how many clues to show, default 3), --theme light|dark,
// --tz <IANA time zone> (default America/New_York), --no-yesterday, --out <file.mp4>.
// Writes the video, a cover image and a suggested caption to tools/promo/out/.
// Runs without any questions; exits with a non-zero code and a message if anything fails.

import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FPS = 30;

function fail(msg) {
  console.error(`\nmake-video: ${msg}`);
  process.exit(1);
}

// ---------- options ----------
function parseArgs(argv) {
  const o = { clues: 3, theme: "light", tz: "America/New_York", yesterday: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { const v = argv[++i]; if (v == null) fail(`${a} needs a value`); return v; };
    if (a === "--date") o.date = val();
    else if (a === "--puzzle") o.puzzle = Number(val());
    else if (a === "--clues") o.clues = Number(val());
    else if (a === "--theme") o.theme = val();
    else if (a === "--tz") o.tz = val();
    else if (a === "--out") o.out = path.resolve(val());
    else if (a === "--no-yesterday") o.yesterday = false;
    else if (a === "-h" || a === "--help") { console.log(readHelp()); process.exit(0); }
    else fail(`unknown option ${a} (try --help)`);
  }
  if (o.date && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) fail(`--date must look like 2026-10-20, got ${o.date}`);
  if (o.puzzle != null && !(Number.isInteger(o.puzzle) && o.puzzle >= 1)) fail("--puzzle must be a whole number from 1");
  if (!(Number.isInteger(o.clues) && o.clues >= 1 && o.clues <= 4)) fail("--clues must be 1, 2, 3 or 4");
  if (!["light", "dark"].includes(o.theme)) fail("--theme must be light or dark");
  try { new Intl.DateTimeFormat("en", { timeZone: o.tz }); } catch { fail(`unknown time zone ${o.tz}`); }
  return o;
}

function readHelp() {
  const lines = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1);
  return lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).map((l) => l.slice(3)).join("\n");
}

// ---------- dates ----------
const DAY = 86400000;
const toUTC = (d) => Date.parse(d + "T00:00:00Z");
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
const todayIn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function pickPuzzle(o) {
  const puzzles = JSON.parse(await readFile(path.join(ROOT, "data/puzzles.json"), "utf8"));
  const config = await readFile(path.join(ROOT, "js/config.js"), "utf8");
  const launch = config.match(/LAUNCH_DATE:\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
  const siteUrl = config.match(/SITE_URL:\s*"([^"]+)"/)?.[1] || "geocluegame.com";
  if (!launch) fail("couldn't find LAUNCH_DATE in js/config.js");

  const date = o.puzzle ? fromUTC(toUTC(launch) + (o.puzzle - 1) * DAY) : o.date || todayIn(o.tz);
  const number = Math.round((toUTC(date) - toUTC(launch)) / DAY) + 1;
  if (number < 1) fail(`${date} is before GeoClue #1 (${launch})`);
  const p = puzzles[date];
  if (!p) fail(`there's no puzzle for ${date} (#${number}) in data/puzzles.json. Add more puzzles first.`);
  if (!Array.isArray(p.clues) || p.clues.length < 2) fail(`the puzzle for ${date} has no clues`);

  const yday = fromUTC(toUTC(date) - DAY);
  const dateLabel = new Date(toUTC(date)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" });
  return {
    date, number, siteUrl, dateLabel,
    difficulty: p.difficulty,
    clues: p.clues.slice(0, Math.min(o.clues, p.clues.length - 1)).map((c) => c.text),
    totalClues: p.clues.length,
    yesterday: o.yesterday && yday >= launch ? puzzles[yday]?.answer || null : null,
    theme: o.theme,
  };
}

// ---------- tools: Playwright (headless Chromium) and ffmpeg ----------
async function loadPlaywright() {
  const tries = [path.join(HERE, "package.json"), path.join(ROOT, "package.json")];
  try { tries.push(path.join(execFileSync("npm", ["root", "-g"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(), "_")); } catch {}
  for (const from of tries) {
    try { return createRequire(from)("playwright"); } catch {}
  }
  console.log("Playwright not found; installing it into tools/promo (one time)...");
  try {
    execFileSync("npm", ["install", "--no-save", "--no-audit", "--no-fund", "--prefix", HERE, "playwright@1.56.1"], { stdio: "inherit" });
    const pw = createRequire(path.join(HERE, "package.json"))("playwright");
    if (!process.env.PLAYWRIGHT_BROWSERS_PATH || !existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH))
      execFileSync(process.execPath, [path.join(HERE, "node_modules/playwright/cli.js"), "install", "chromium"], { stdio: "inherit" });
    return pw;
  } catch (e) {
    fail(`couldn't install Playwright: ${e.message}`);
  }
}

function findFfmpeg() {
  const ok = (bin) => { try { return /libx264/.test(execFileSync(bin, ["-hide_banner", "-encoders"], { stdio: ["ignore", "pipe", "ignore"] }).toString()); } catch { return false; } };
  if (process.env.FFMPEG && ok(process.env.FFMPEG)) return process.env.FFMPEG;
  if (ok("ffmpeg")) return "ffmpeg";
  const local = path.join(HERE, "node_modules/ffmpeg-static/ffmpeg");
  if (!existsSync(local)) {
    console.log("ffmpeg not found; installing a copy into tools/promo (one time)...");
    try { execFileSync("npm", ["install", "--no-save", "--no-audit", "--no-fund", "--prefix", HERE, "ffmpeg-static@5.2.0"], { stdio: "inherit" }); }
    catch (e) { fail(`couldn't install ffmpeg: ${e.message}`); }
  }
  if (ok(local)) return local;
  fail("no working ffmpeg with H.264 support. Install ffmpeg, or set FFMPEG=/path/to/ffmpeg.");
}

// ---------- a tiny local web server so the page can load the site's fonts, styles and map ----------
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
function serve() {
  const server = createServer(async (req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function caption(d) {
  const diff = d.difficulty ? ` (${d.difficulty}${d.difficulty === "hard" ? ", it's Friday" : ""})` : "";
  return [
    `GeoClue #${d.number}${diff}. Here are today's first clues. Can you name the country?`,
    "",
    `Play free at ${d.siteUrl}, a new mystery country every day.`,
    "",
    "#geography #dailypuzzle #geographyquiz #trivia #maps",
  ].join("\n") + "\n";
}

// ---------- main ----------
const opts = parseArgs(process.argv.slice(2));
const data = await pickPuzzle(opts);
const outDir = opts.out ? path.dirname(opts.out) : path.join(HERE, "out");
const base = opts.out ? opts.out.replace(/\.mp4$/i, "") : path.join(outDir, `geoclue-${data.number}-${data.date}`);
const outFile = base + ".mp4";
await mkdir(outDir, { recursive: true });
console.log(`GeoClue #${data.number} (${data.date}): showing ${data.clues.length} of ${data.totalClues} clues.`);

const ffmpegBin = findFfmpeg();
const { chromium } = await loadPlaywright();
const server = await serve();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(`couldn't load ${r.url()}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/promo/scene.html`, { waitUntil: "load" });
  const { seconds, coverAt } = await page.evaluate((d) => window.setup(d), data);
  if (errors.length) throw new Error(errors.join("; "));
  const frames = Math.round(seconds * FPS);

  // Frames go straight into ffmpeg. A silent sound track is added because some apps
  // handle videos without one badly; add music in TikTok or Instagram when posting.
  const ff = spawn(ffmpegBin, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-map", "0:v", "-map", "1:a", "-shortest",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    outFile,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });

  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % FPS === 0) process.stdout.write(`\r  ${Math.round((i / frames) * 100)}%`);
  }
  ff.stdin.end();
  await ffDone;
  process.stdout.write("\r  100%\n");

  // Cover image: the intro, once everything has arrived.
  await page.evaluate((t) => window.render(t), coverAt);
  await page.screenshot({ path: base + "-cover.png" });
  await writeFile(base + "-caption.txt", caption(data));
  console.log(`Done (${seconds.toFixed(1)} s):\n  ${outFile}\n  ${base}-cover.png\n  ${base}-caption.txt`);
} catch (e) {
  fail(e.message || String(e));
} finally {
  await browser?.close();
  server.close();
}
