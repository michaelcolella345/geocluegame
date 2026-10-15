// Only used if the site is also published as a Cloudflare Pages project (geocluegame.pages.dev).
// Pages can't run worker/index.js, so this passes "How everyone did" requests on to the Worker,
// which keeps the one shared tally. The Worker itself never serves this folder (see .assetsignore).
const WORKER = "https://geocluegame.michaelcolella345.workers.dev";

export async function onRequest({ request }) {
  const url = new URL(request.url);
  return fetch(new Request(WORKER + url.pathname + url.search, request));
}
