#!/usr/bin/env python3
# Builds data/hindsight.json from the event list in events.py.
# Run from the project folder:  python3 tools/hindsight/make_matchups.py 2026-10-16 2026-12-11
# Days in data/hindsight.json before the start date are kept unchanged.
# Each day gets six matchups from six different eras, in random order. The two events in a
# matchup are close in time (how close depends on the era) and never from the same story
# (the "group" in events.py). Events are spread out so the same one doesn't come back soon.
# The same dates always give the same matchups. To add days, add events and widen the dates.
import json, random, datetime, sys, itertools, collections
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from events import E
from facts import FACTS
missing = [e["event"] for e in E if e["event"] not in FACTS]
if missing: sys.exit("No bonus fact in facts.py for: " + "; ".join(missing))
W = "https://en.wikipedia.org/wiki/"
def bucket(y):
    return 0 if y < 500 else 1 if y < 1500 else 2 if y < 1800 else 3 if y < 1900 else 4 if y < 1946 else 5 if y < 1990 else 6
MAXGAP = [200, 90, 50, 25, 15, 15, 12]
# The smallest gap allowed, by the century of the earlier event (Michael's rule, 2026-10-15):
# 2000s 2 years, 1900s 5, 1800s 8, 1700s 12, then about 4 more per century going back.
def mingap(y):
    if y >= 2000: return 2
    if y >= 1900: return 5
    if y >= 1800: return 8
    if y >= 1700: return 12
    if y >= 1600: return 16
    if y >= 1500: return 20
    if y >= 1400: return 24
    if y >= 500: return 30
    if y >= 1: return 40
    return 50
for i, e in enumerate(E): e["id"] = i; e["b"] = bucket(e["year"])
# Candidate pairs: same bucket, different years, different groups, close enough.
cands = collections.defaultdict(list)
for a, b in itertools.combinations(E, 2):
    if a["b"] != b["b"] or a["year"] == b["year"]: continue
    if a["group"] and a["group"] == b["group"]: continue
    if a["slug"] == b["slug"]: continue
    if abs(a["year"] - b["year"]) > MAXGAP[a["b"]]: continue
    if abs(a["year"] - b["year"]) < mingap(min(a["year"], b["year"])): continue
    if (a["label"] or b["label"]) and abs(a["year"] - b["year"]) < 10: continue  # approximate dates need room
    cands[a["b"]].append((a, b))
rng = random.Random(20261015)
start = datetime.date.fromisoformat(sys.argv[1] if len(sys.argv) > 1 else "2026-10-15")
end = datetime.date.fromisoformat(sys.argv[2] if len(sys.argv) > 2 else "2026-12-11")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "hindsight.json")
days = (end - start).days + 1
uses = collections.Counter(); last = {}; used_pairs = set(); out = {}
for d in range(days):
    bks = rng.sample(range(7), 6)
    rounds = []; today = set()
    for bk in bks:
        # Mix it up: some matchups are close calls, some are a bit easier.
        target = rng.choice([0.05, 0.2, 0.4])
        def score(p):
            a, b = p
            s = uses[a["id"]] * 4 + uses[b["id"]] * 4
            for x in p:
                if x["id"] in last: s += max(0, 12 - (d - last[x["id"]]))
            gap = abs(a["year"] - b["year"])
            lo = mingap(min(a["year"], b["year"]))
            s += abs((gap - lo) / max(1, MAXGAP[bk] - lo) - target) * 6
            return s + rng.random() * 3
        pool = [p for p in cands[bk] if (p[0]["id"], p[1]["id"]) not in used_pairs
                and p[0]["id"] not in today and p[1]["id"] not in today
                and p[0]["slug"] not in {E[i]["slug"] for i in today} and p[1]["slug"] not in {E[i]["slug"] for i in today}]
        a, b = min(pool, key=score)
        used_pairs.add((a["id"], b["id"]))
        for x in (a, b): uses[x["id"]] += 1; last[x["id"]] = d; today.add(x["id"])
        first, second = (a, b) if a["year"] < b["year"] else (b, a)
        def j(x):
            o = {"event": x["event"], "where": x["where"], "year": x["year"], "fact": FACTS[x["event"]], "source": W + x["slug"]}
            if x["label"]: o["label"] = x["label"]
            return o
        rounds.append({"first": j(first), "second": j(second)})
    out[(start + datetime.timedelta(days=d)).isoformat()] = {"rounds": rounds}
# Days before the start date that are already in the file are kept as they are (people may have played them).
try: old = json.load(open(OUT))
except FileNotFoundError: old = {}
out = {**{k: v for k, v in old.items() if k < start.isoformat()}, **out}
json.dump(dict(sorted(out.items())), open(OUT, "w"), ensure_ascii=False, indent=1)
print(days, "days; events used:", len(uses), "of", len(E), "; max uses", max(uses.values()))
