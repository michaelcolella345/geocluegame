// Loads the data files and matches typed guesses to countries.

export async function loadData() {
  const get = (url) => fetch(url, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  });
  const [countries, puzzles] = await Promise.all([get("data/countries.json"), get("data/puzzles.json")]);
  return { countries, puzzles };
}

// Lowercase, strip accents and punctuation, drop a leading "the", and read "st" as "saint".
// Keep in sync with tools/validate.js.
export const norm = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, " ")
    .replace(/^the /, "").replace(/\bst\b/g, "saint").trim();

export function makeMatcher(countries) {
  const byName = new Map(countries.map((c) => [c.name, c]));
  const lookup = new Map();
  for (const c of countries) for (const a of [c.name, ...c.aliases]) lookup.set(norm(a), c);
  // Searchable entries: every name and alias, pointing at its country.
  const entries = countries.flatMap((c) => [c.name, ...c.aliases].map((label) => ({ key: norm(label), label, country: c })));

  return {
    byName,
    // Exact match on a name or alias, or null.
    resolve: (input) => lookup.get(norm(input)) || null,
    // Up to `limit` suggestions for what's typed so far. Names starting with the
    // text come first, then words starting with it, then anywhere inside it.
    suggest(input, exclude = new Set(), limit = 8) {
      const q = norm(input);
      if (!q) return [];
      const best = new Map(); // country name -> {country, score, via}
      for (const e of entries) {
        if (exclude.has(e.country.name)) continue;
        const i = e.key.indexOf(q);
        if (i < 0) continue;
        const score = (i === 0 ? 0 : e.key[i - 1] === " " ? 1 : 2) + (e.label === e.country.name ? 0 : 0.5);
        const prev = best.get(e.country.name);
        if (!prev || score < prev.score) best.set(e.country.name, { country: e.country, score, via: e.label === e.country.name ? null : e.label });
      }
      return [...best.values()]
        .sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name))
        .slice(0, limit);
    },
  };
}
