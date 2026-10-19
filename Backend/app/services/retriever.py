import csv
import re
from pathlib import Path

from app.services.query_parser import parse_query
from app.services.vector_services import search_similar_products

# Fetch this many times top_k candidates, then re-rank by budget closeness.
POOL_MULTIPLIER = 4
# Max score bonus for a product priced close to the user's budget ceiling.
# Raise it to favour pricier phones within budget, 0 to switch re-ranking off.
PRICE_BONUS = 0.15
CHEAP_WORDS = ("cheap", "cheapest", "sasta", "lowest", "minimum price")

# Name lookup: "price of <full or partial product name>" -> that product.
NAME_MAX_HITS = 3
NAME_MIN_TOKENS = 3
NAME_MIN_RECALL = 0.75
NAME_STRONG_HITS = 5

_SPEC_RE = re.compile(r"\d+(?:gb|tb|g|t|mm|mah|mp|hz|inch|in|w|k)?")
_STOP = {
    "what", "whats", "is", "the", "a", "an", "of", "for", "to", "in", "on", "does", "do",
    "how", "much", "many", "price", "cost", "tell", "me", "about", "show", "give", "please",
    "ram", "storage", "specs", "spec", "and", "with", "it", "has", "have", "this", "that",
    "are", "you", "battery",
}

_catalog = None


def _tokens(text: str):
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _load_catalog():
    """Load Unified_KB/all_products.csv once (searched upward from this file)."""
    global _catalog
    if _catalog is not None:
        return _catalog
    _catalog = []
    for parent in Path(__file__).resolve().parents:
        path = parent / "Unified_KB" / "all_products.csv"
        if path.exists():
            with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
                for row in csv.DictReader(f):
                    toks = _tokens(row.get("name", ""))
                    if toks:
                        _catalog.append((toks, row))
            break
    return _catalog


def _to_num(val):
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _compatible(row, f) -> bool:
    cat = f.get("category")
    if cat and row.get("category") != cat:
        return False
    cats = f.get("categories")
    if cats and row.get("category") not in cats:
        return False
    brand = f.get("brand")
    if brand and brand.lower() != (row.get("brand") or "").lower():
        return False
    ram, row_ram = f.get("ram_gb"), _to_num(row.get("ram_gb"))
    if ram and row_ram and row_ram > 0 and row_ram != ram:
        return False
    return True


def _name_matches(query: str, filters: dict):
    """Products whose catalog name is (nearly) contained in the query."""
    # Shopping queries with a budget are not name lookups.
    if "max_price" in filters or "min_price" in filters:
        return []
    q = _tokens(query)
    scored = []
    for toks, row in _load_catalog():
        hits = toks & q
        if len(hits) < NAME_MIN_TOKENS:
            continue
        # needs at least one distinctive (non-spec) matching token
        if all(_SPEC_RE.fullmatch(t) for t in hits):
            continue
        # a model number in the query that this product lacks = a different product
        unmatched = [t for t in q - toks - _STOP
                     if re.fullmatch(r"\d{3,}", t)
                     or (re.search(r"[a-z]", t) and re.search(r"\d", t) and not _SPEC_RE.fullmatch(t))]
        if unmatched:
            continue
        recall = len(hits) / len(toks)
        if recall >= NAME_MIN_RECALL or len(hits) >= NAME_STRONG_HITS:
            scored.append((len(hits), recall, row))
    scored.sort(key=lambda s: (s[0], s[1]), reverse=True)
    return [
        {"score": 1.0, "metadata": dict(row)}
        for _, _, row in scored[:NAME_MAX_HITS]
        if _compatible(row, filters)
    ]


def _rerank_for_budget(matches, filters, query):
    """Among phones/laptops that fit the budget, prefer ones nearer the ceiling."""
    cap = filters.get("max_price")
    if not cap or not PRICE_BONUS or any(w in query.lower() for w in CHEAP_WORDS):
        return matches

    def key(m):
        price = _to_num(m.get("metadata", {}).get("price_inr")) or 0.0
        closeness = min(price / cap, 1.0) if price > 0 else 0.0
        return m.get("score", 0.0) + PRICE_BONUS * closeness

    return sorted(matches, key=key, reverse=True)


def _merge(name_hits, matches, limit):
    out, seen = [], set()
    for m in name_hits + matches:
        pid = m.get("metadata", {}).get("product_id")
        if pid in seen:
            continue
        seen.add(pid)
        out.append(m)
    return out[:limit]


def retrieve_products(query: str, top_k: int = 5):
    parsed_filters = parse_query(query)
    name_hits = _name_matches(query, parsed_filters)

    # Check for cross-category queries (e.g. asking for watch + phone)
    categories = parsed_filters.get("categories", [])
    if categories and len(categories) > 1:
        all_matches = []
        per_cat_k = max(2, top_k // len(categories))
        for cat in categories:
            cat_filters = dict(parsed_filters)
            cat_filters["category"] = cat
            matches = search_similar_products(query, top_k=per_cat_k, parsed_filters=cat_filters)
            all_matches.extend(matches)
        return _merge(name_hits, all_matches, max(top_k, len(all_matches))), parsed_filters

    pool = search_similar_products(query, top_k=top_k * POOL_MULTIPLIER, parsed_filters=parsed_filters)
    matches = _merge(name_hits, _rerank_for_budget(pool, parsed_filters, query), top_k)
    return matches, parsed_filters