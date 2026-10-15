// GeoClue's only server code. It keeps an anonymous tally of results for each puzzle so the
// results screen can show how everyone did. Every other request is a static file, served by
// Cloudflare exactly as before. Each puzzle's tally lives in its own Durable Object.
import { DurableObject } from "cloudflare:workers";
import { CONFIG } from "../js/config.js";

const SCORES = ["1", "2", "3", "4", "5", "X"];
const MIN_PLAYERS = 5; // below this, percentages would say more about one person than about everyone

export class PuzzleTally extends DurableObject {
  async add(score) {
    const t = (await this.ctx.storage.get("tally")) || {};
    t[score] = (t[score] || 0) + 1;
    await this.ctx.storage.put("tally", t);
    return t;
  }
  async read() {
    return (await this.ctx.storage.get("tally")) || {};
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});

// Today's puzzle number in UTC. Players are in every timezone, so a puzzle is accepted from
// one day before to one day after it.
const utcPuzzleNumber = (launch = CONFIG.LAUNCH_DATE) => {
  const [y, m, d] = launch.split("-").map(Number);
  return Math.floor((Date.now() - Date.UTC(y, m - 1, d)) / 864e5) + 1;
};

// Shares as whole percentages, and only once enough people have finished.
function summary(t) {
  const total = SCORES.reduce((n, s) => n + (t[s] || 0), 0);
  if (total < MIN_PLAYERS) return { enough: false };
  return { enough: true, percent: Object.fromEntries(SCORES.map((s) => [s, Math.round((100 * (t[s] || 0)) / total)])) };
}

// Hindsight: the share of players for each score (0 to 10 points), once enough have finished.
const POINTS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
function pointsSummary(t) {
  const total = POINTS.reduce((n, s) => n + (t[s] || 0), 0);
  if (total < MIN_PLAYERS) return { enough: false };
  return { enough: true, percent: Object.fromEntries(POINTS.map((s) => [s, Math.round((100 * (t[s] || 0)) / total)])) };
}

async function hindsight(request, env, url) {
  const puzzle = Number(url.searchParams.get("puzzle"));
  if (!Number.isInteger(puzzle) || Math.abs(puzzle - utcPuzzleNumber(CONFIG.HINDSIGHT_LAUNCH_DATE)) > 1) return json({ error: "Unknown puzzle" }, 400);
  const tally = env.TALLY.get(env.TALLY.idFromName(`hindsight-${puzzle}`));

  if (request.method === "GET") return json(pointsSummary(await tally.read()));
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const points = String(body.points);
    if (!POINTS.includes(points)) return json({ error: "Unknown points" }, 400);
    return json(pointsSummary(await tally.add(points)));
  }
  return json({ error: "Method not allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/hindsight") return hindsight(request, env, url);
    if (url.pathname !== "/api/results") return env.ASSETS.fetch(request);

    const puzzle = Number(url.searchParams.get("puzzle"));
    if (!Number.isInteger(puzzle) || Math.abs(puzzle - utcPuzzleNumber()) > 1) return json({ error: "Unknown puzzle" }, 400);
    const tally = env.TALLY.get(env.TALLY.idFromName(String(puzzle)));

    if (request.method === "GET") return json(summary(await tally.read()));
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const score = String(body.score);
      if (!SCORES.includes(score)) return json({ error: "Unknown score" }, 400);
      return json(summary(await tally.add(score)));
    }
    return json({ error: "Method not allowed" }, 405);
  },
};
