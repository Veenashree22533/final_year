#!/usr/bin/env python3
"""
ConvoShop - extra RAG tests, one section per layer of the pipeline.
Standard library only. Talks to your running backend over HTTP (POST /chat/).

  python eval_extra.py --csv ..\\Unified_KB\\all_products.csv

Start your backend first, the same way you normally do (uvicorn on port 8000).
Each section prints PASS/TOTAL, and the failures show exactly what went wrong.
"""
import argparse
import csv
import json
import random
import re
import statistics
import sys
import time
import urllib.request
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_REFUSAL = (
    r"(not (?:in|available|found|listed|part of)|couldn.?t find|could not find|can.?t find|"
    r"don.?t have|do not have|no (?:matching |such )?(?:product|result|information|data)|"
    r"unable to find|isn.?t (?:in|available|listed)|no information|outside)"
)
PRICE_RE = re.compile(r"(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)", re.I)
NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
ID_RE = re.compile(r"\b[A-Za-z]{1,5}_\d{2,6}\b")  # replaced by catalog-specific regex in main()


# ----------------------------------------------------------------- catalog ----
def num(x):
    try:
        return float(str(x).replace(",", "").strip())
    except Exception:
        return None


def load_catalog(path):
    cat = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for i, row in enumerate(csv.DictReader(f)):
            pid = row.get("product_id") or row.get("id") or f"row_{i}"
            cat[pid] = {
                "id": pid,
                "name": (row.get("name") or "").strip(),
                "brand": (row.get("brand") or "").strip(),
                "category": (row.get("category") or "").strip().lower(),
                "price": num(row.get("price_inr")),
                "ram": num(row.get("ram_gb")),
                "storage": num(row.get("storage_gb")),
                "text": " ".join(str(v) for v in row.values()).lower(),
            }
    return cat


def display_name(p):
    n, b = p["name"], p["brand"]
    return n if b and n.lower().startswith(b.lower()) else f"{b} {n}".strip()


# ------------------------------------------------------------------ client ----
class Client:
    def __init__(self, url, timeout, pause):
        self.url, self.timeout, self.pause = url, timeout, pause
        self.latencies, self.errors, self.log = [], 0, []

    def ask(self, message):
        time.sleep(self.pause)
        req = urllib.request.Request(
            self.url,
            data=json.dumps({"message": message}).encode(),
            headers={"Content-Type": "application/json"},
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                data = json.loads(r.read().decode("utf-8"))
        except Exception as e:  # timeout, connection refused, HTTP error
            self.errors += 1
            data = {"response": "", "matches": [], "error": str(e)}
            self.log.append({"q": message, "data": data})
            return data
        self.latencies.append(time.time() - t0)
        data["response"] = data.get("response") or ""
        data["matches"] = data.get("matches") or []
        # An API error string must never be mistaken for a (correct) refusal.
        if re.match(r"\s*(gemini\s*)?error", data["response"], re.I):
            self.errors += 1
            data["error"] = data["response"]
        self.log.append({"q": message, "data": data})
        return data


# ---------------------------------------------------------------- helpers ----
def canon(cat_lower, pid):
    return cat_lower.get(pid.lower(), pid)


def match_ids(data):
    return [str(m.get("id") or m.get("product_id")) for m in data["matches"]]


def text_ids(data):
    return ID_RE.findall(data["response"])


def refused(data, refusal_re):
    return bool(refusal_re.search(data["response"]))


def has_number(text, target, tol=0.01):
    if not target:
        return False
    for m in NUM_RE.finditer(text):
        v = num(m.group())
        if v is not None and abs(v - target) / target <= tol:
            return True
    return False


def has_gb(text, val):
    val = int(val)
    t = text.lower()
    if val >= 1024 and val % 1024 == 0 and re.search(rf"(?<![\d.]){val // 1024}\s*-?\s*tb", t):
        return True
    return bool(re.search(rf"(?<![\d.]){val}(?:\.0)?\s*-?\s*gb", t))


def qualifying(case, cat):
    n = 0
    for p in cat.values():
        if case.get("category") and p["category"] and case["category"] not in p["category"]:
            continue
        if case.get("brand") and case["brand"].lower() not in (p["brand"] + " " + p["name"]).lower():
            continue
        if case.get("max_price") and not (p["price"] and p["price"] <= case["max_price"]):
            continue
        if case.get("min_ram") and not (p["ram"] and p["ram"] >= case["min_ram"]):
            continue
        n += 1
    return n


def violations(case, data, cat, cat_lower):
    ids = []
    for i in match_ids(data) + text_ids(data):
        i = canon(cat_lower, i)
        if i not in ids:
            ids.append(i)
    v = []
    for pid in ids:
        p = cat.get(pid)
        if not p:
            v.append(f"unknown-id {pid}")
            continue
        if case.get("max_price"):
            if not p["price"]:
                v.append(f"unverifiable-price {pid}")
            elif p["price"] > case["max_price"]:
                v.append(f"over-budget {pid} (INR {p['price']:g} > {case['max_price']})")
        if case.get("brand") and case["brand"].lower() not in (p["brand"] + " " + p["name"]).lower():
            v.append(f"wrong-brand {pid} ({p['brand']})")
        if case.get("category") and p["category"] and not (
            case["category"] in p["category"] or p["category"] in case["category"]
        ):
            v.append(f"wrong-category {pid} ({p['category']})")
        if case.get("min_ram") and not (p["ram"] and p["ram"] >= case["min_ram"]):
            v.append(f"ram {pid} ({p['ram']}) < {case['min_ram']}")
    return ids, v


def check_constraint_case(case, data, cat, cat_lower, refusal_re):
    if data.get("error"):
        return False, f"API error: {data['error'][:120]}"
    ids, v = violations(case, data, cat, cat_lower)
    if not ids:
        q = qualifying(case, cat)
        if refused(data, refusal_re) and q == 0:
            return True, "correctly said nothing matches"
        return False, f"no results, but {q} catalog products qualify" if q else "no results"
    return (not v), ("; ".join(v[:4]) if v else f"{len(ids)} products, all within constraints")


def ground_issues(data, cat, cat_lower):
    text, issues = data["response"], []
    ments = [(m.group(0), m.start(), m.end()) for m in ID_RE.finditer(text)]
    for k, (pid, s, e) in enumerate(ments):
        p = cat.get(canon(cat_lower, pid))
        if p is None:
            issues.append(f"fabricated-id {pid}")
            continue
        end = min(e + 40, ments[k + 1][1] if k + 1 < len(ments) else e + 40)
        m = PRICE_RE.search(text, e, end)
        if m and p["price"]:
            claimed = num(m.group(1))
            if claimed is not None and abs(claimed - p["price"]) / p["price"] > 0.01:
                issues.append(f"wrong-price {pid}: said {claimed:g}, catalog {p['price']:g}")
    for mm in data["matches"]:
        pid = str(mm.get("id") or mm.get("product_id"))
        p = cat.get(canon(cat_lower, pid))
        if p is None:
            issues.append(f"match-not-in-catalog {pid}")
            continue
        mp = num(mm.get("price"))
        if mp is not None and p["price"] and abs(mp - p["price"]) / p["price"] > 0.01:
            issues.append(f"match-price-differs {pid}: {mp:g} vs {p['price']:g}")
    return issues


# ------------------------------------------------------------------- cases ----
CONSTRAINT_CASES = [
    {"q": "phone under 30000", "category": "phone", "max_price": 30000},
    {"q": "best phone under 50k for university use", "category": "phone", "max_price": 50000},
    {"q": "samsung phones under 40000", "category": "phone", "brand": "samsung", "max_price": 40000},
    {"q": "Show me phones with at least 8 GB RAM under INR 40,000.", "category": "phone", "min_ram": 8, "max_price": 40000},
    {"q": "laptop under 60000 with 16GB RAM", "category": "laptop", "min_ram": 16, "max_price": 60000},
    {"q": "smartwatch under 5000", "category": "smartwatch", "max_price": 5000},
]

ABSENT = [
    "Apple Watch Ultra 9", "iPhone 17 Pro Max 1TB", "Samsung Galaxy S26 Ultra", "PlayStation 5",
    "Canon EOS R5 DSLR camera", "Sony WH-1000XM6 headphones", "Dell XPS 17 9999", "OnePlus 13 Ultra Max",
]

PARAPHRASES = [
    {"name": "phone under 25k", "category": "phone", "max_price": 25000, "variants": [
        "best phone under 25000", "phone below 25k please", "good mobile within Rs 25,000",
        "mujhe 25 hazaar ke andar accha phone chahiye", "fone under 25k"]},
    {"name": "laptop for coding under 60k", "category": "laptop", "max_price": 60000, "variants": [
        "laptop for coding under 60000", "i need a laptop under 60k for programming",
        "cheap notebook for programming below 60 thousand", "60k ke andar coding ke liye laptop"]},
]

STABILITY_QUERIES = ["best phone under 30000 for gaming", "laptop under 60000 for coding"]
FOLLOWUP_BASES = ["best phone under 50000 for university use", "laptop under 60000 for coding"]


# ------------------------------------------------------------------- tests ----
def t_constraints(cl, cat, cat_lower, rx):
    out = []
    for c in CONSTRAINT_CASES:
        ok, detail = check_constraint_case(c, cl.ask(c["q"]), cat, cat_lower, rx)
        out.append({"ok": ok, "label": c["q"], "detail": detail})
    return out


def t_accuracy(cl, cat, rx, n, rng):
    pool = [p for p in cat.values() if p["price"] and p["name"]]
    sample = rng.sample(pool, min(n, len(pool)))
    out = []
    for i, p in enumerate(sample):
        kind = ("price", "ram", "storage")[i % 3]
        if kind == "ram" and not p["ram"]:
            kind = "price"
        if kind == "storage" and not p["storage"]:
            kind = "price"
        name = display_name(p)
        q = {
            "price": f"What is the price of the {name}?",
            "ram": f"How much RAM does the {name} have?",
            "storage": f"How much storage does the {name} have?",
        }[kind]
        d = cl.ask(q)
        if d.get("error"):
            out.append({"ok": False, "label": q, "detail": f"API error: {d['error'][:100]}", "kind": "error"})
            continue
        t = d["response"]
        found = (
            has_number(t, p["price"]) if kind == "price"
            else has_gb(t, p["ram"]) if kind == "ram" else has_gb(t, p["storage"])
        )
        expected = {"price": p["price"], "ram": p["ram"], "storage": p["storage"]}[kind]
        if found:
            out.append({"ok": True, "label": q, "detail": f"correct ({expected:g})", "kind": "ok"})
        elif refused(d, rx):
            out.append({"ok": False, "label": q, "detail": f"FALSE ABSTENTION (catalog has {expected:g}): {t[:90]}", "kind": "false-abstention"})
        else:
            out.append({"ok": False, "label": q, "detail": f"expected {expected:g}, got: {t[:90]}", "kind": "wrong"})
    return out


def t_abstention(cl, cat, rx):
    out = []
    for term in ABSENT:
        if any(term.lower() in p["text"] for p in cat.values()):
            continue  # it exists in the catalog, so it is not an abstention test
        d = cl.ask(f"What is the price and specs of the {term}?")
        if d.get("error"):
            out.append({"ok": False, "label": term, "detail": f"API error: {d['error'][:100]}"})
        elif refused(d, rx):
            out.append({"ok": True, "label": term, "detail": "refused correctly"})
        else:
            out.append({"ok": False, "label": term, "detail": f"did not refuse: {d['response'][:110]}"})
    return out


def t_paraphrase(cl, cat, cat_lower, rx):
    out, jacc = [], []
    for g in PARAPHRASES:
        sets = []
        for v in g["variants"]:
            d = cl.ask(v)
            ok, detail = check_constraint_case(g, d, cat, cat_lower, rx)
            out.append({"ok": ok, "label": f"[{g['name']}] {v}", "detail": detail})
            if ok:
                sets.append(set(match_ids(d)) or set(text_ids(d)))
        for i in range(len(sets)):
            for j in range(i + 1, len(sets)):
                u = sets[i] | sets[j]
                if u:
                    jacc.append(len(sets[i] & sets[j]) / len(u))
    return out, (statistics.mean(jacc) if jacc else None)


def top_id(d, cat_lower):
    ids = match_ids(d) or text_ids(d)
    return canon(cat_lower, ids[0]) if ids else None


def t_stability(cl, cat_lower, reps=3):
    out = []
    for q in STABILITY_QUERIES:
        tops = [top_id(cl.ask(q), cat_lower) for _ in range(reps)]
        out.append({"ok": len(set(tops)) == 1 and tops[0] is not None, "label": q, "detail": f"top picks over {reps} runs: {tops}"})
    return out


def t_followup(cl, cat, cat_lower):
    out = []
    for q in FOLLOWUP_BASES:
        d1 = cl.ask(q)
        top = top_id(d1, cat_lower)
        if not top:
            out.append({"ok": False, "label": q, "detail": "first answer had no product to follow up on"})
            continue
        p = cat.get(top)
        title = display_name(p) if p else top
        d2 = cl.ask(f"Why is the {title} a good choice compared to the other options?")
        first = (text_ids(d2) or [None])[0]
        first = canon(cat_lower, first) if first else None
        ok = (first == top) or (first is None and title.lower() in d2["response"].lower()[:200])
        out.append({"ok": ok, "label": q, "detail": f"asked about {top}; explanation led with {first}"})
    return out


def data_audit(cat):
    rows = list(cat.values())
    n = len(rows)
    no_price = sum(1 for p in rows if not p["price"])
    no_ram = sum(1 for p in rows if not p["ram"])
    by_price = Counter((p["category"], p["price"]) for p in rows if p["price"])
    repeated = [(k, c) for k, c in by_price.most_common() if c >= 4][:8]
    dup_names = [k for k, c in Counter(p["name"].lower() for p in rows).items() if c > 1][:5]
    print("\nCATALOG DATA AUDIT (information, not pass/fail)")
    print(f"  products: {n} | missing/zero price: {no_price} | missing RAM: {no_ram}")
    if repeated:
        print("  prices repeated 4+ times in one category (possible fallback/estimate values):")
        for (c, price), k in repeated:
            print(f"    {c or '?'} INR {price:g} x{k}")
    else:
        print("  no suspicious repeated prices")
    if dup_names:
        print(f"  duplicate product names (examples): {dup_names}")


# -------------------------------------------------------------------- main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000/chat/")
    ap.add_argument("--csv", default=r"..\Unified_KB\all_products.csv")
    ap.add_argument("--n", type=int, default=12, help="answerable questions sampled from the catalog")
    ap.add_argument("--timeout", type=float, default=90)
    ap.add_argument("--pause", type=float, default=1.0, help="seconds between calls (avoids rate limits)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--refusal", default=DEFAULT_REFUSAL, help="regex that recognises 'not in catalog' answers")
    ap.add_argument("--max-p95", type=float, default=15.0)
    ap.add_argument("--skip", default="", help="comma list: constraints,accuracy,abstention,paraphrase,stability,followup")
    ap.add_argument("--out", default="eval_extra_report.json")
    a = ap.parse_args()
    skip = {s.strip() for s in a.skip.split(",") if s.strip()}

    cat = load_catalog(a.csv)
    cat_lower = {k.lower(): k for k in cat}
    global ID_RE
    prefixes = {k.split("_")[0] for k in cat if "_" in k}
    if prefixes:
        ID_RE = re.compile(r"\b(?:%s)_\d+\b" % "|".join(map(re.escape, sorted(prefixes))), re.I)
    rx = re.compile(a.refusal, re.I)
    rng = random.Random(a.seed)
    cl = Client(a.url, a.timeout, a.pause)
    print(f"Catalog: {len(cat)} products | endpoint: {a.url}\nRunning tests (this makes real LLM calls)...\n")

    sections = []  # (key, title, results, target, extra)
    if "constraints" not in skip:
        sections.append(("constraints", "Hard constraints: budget / brand / category / RAM", t_constraints(cl, cat, cat_lower, rx), 1.0, ""))
    if "accuracy" not in skip:
        res = t_accuracy(cl, cat, rx, a.n, rng)
        fa = sum(1 for r in res if r.get("kind") == "false-abstention")
        wrong = sum(1 for r in res if r.get("kind") == "wrong")
        sections.append(("accuracy", "Answer accuracy on answerable questions", res, 0.9, f"false abstentions: {fa} | wrong answers: {wrong}"))
    if "abstention" not in skip:
        sections.append(("abstention", "Abstention on products NOT in the catalog", t_abstention(cl, cat, rx), 1.0, ""))
    if "paraphrase" not in skip:
        res, j = t_paraphrase(cl, cat, cat_lower, rx)
        sections.append(("paraphrase", "Semantic robustness: paraphrases, typos, Hinglish", res, 0.8,
                         "mean overlap of results between phrasings (Jaccard): " + ("n/a" if j is None else f"{j:.2f}")))
    if "stability" not in skip:
        sections.append(("stability", "Stability: same question 3x gives the same top pick", t_stability(cl, cat_lower), 0.8, ""))
    if "followup" not in skip:
        sections.append(("followup", "Follow-up consistency ('why is this better?')", t_followup(cl, cat, cat_lower), 1.0, ""))

    # grounding runs over EVERY answer collected above
    g_res = []
    for e in cl.log:
        if e["data"].get("error"):
            continue
        iss = ground_issues(e["data"], cat, cat_lower)
        g_res.append({"ok": not iss, "label": e["q"], "detail": "; ".join(iss[:3]) if iss else "ok"})
    sections.append(("grounding", "Grounding: IDs exist, prices match catalog (all answers)", g_res, 1.0, ""))

    p95 = None
    if cl.latencies:
        s = sorted(cl.latencies)
        p95 = s[min(len(s) - 1, int(0.95 * len(s)))]
    lat_ok = cl.errors == 0 and (p95 is None or p95 <= a.max_p95)
    lat_detail = (
        f"errors/timeouts: {cl.errors} | median {statistics.median(cl.latencies):.1f}s | p95 {p95:.1f}s | max {max(cl.latencies):.1f}s"
        if cl.latencies else f"errors/timeouts: {cl.errors} | no successful calls"
    )
    sections.append(("latency", f"Reliability: no errors, p95 <= {a.max_p95:g}s", [{"ok": lat_ok, "label": "all calls", "detail": lat_detail}], 1.0, lat_detail))

    print("=" * 84)
    print(f"{'SECTION':<62}{'PASS':>6}{'TOTAL':>7}{'RATE':>6}  TARGET")
    print("-" * 84)
    below = 0
    for key, title, res, target, extra in sections:
        tot = len(res)
        ok = sum(1 for r in res if r["ok"])
        rate = ok / tot if tot else 0
        flag = "OK" if tot and rate >= target else "BELOW"
        below += flag == "BELOW"
        print(f"{title[:61]:<62}{ok:>6}{tot:>7}{rate * 100:>5.0f}%  {int(target * 100)}% {flag}")
        if extra and key != "latency":
            print(f"    {extra}")
    print("=" * 84)
    print(lat_detail)

    print("\nFAILURES (first 4 per section)")
    any_fail = False
    for key, title, res, target, extra in sections:
        bad = [r for r in res if not r["ok"]]
        if bad:
            any_fail = True
            print(f"\n[{key}]")
            for r in bad[:4]:
                print(f"  - {r['label'][:70]}\n      {r['detail']}")
    if not any_fail:
        print("  none")

    data_audit(cat)

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"sections": [{"key": k, "title": t, "results": r} for k, t, r, _, _ in sections], "raw": cl.log}, f, ensure_ascii=False, indent=2)
    print(f"\nFull report with every raw answer saved to {a.out}")
    print("RESULT:", "all sections meet their targets" if below == 0 else f"{below} section(s) below target")
    sys.exit(1 if below else 0)


if __name__ == "__main__":
    main()