import re

BRANDS = [
    # Phones & general
    "apple", "samsung", "xiaomi", "realme", "oppo", "vivo", "oneplus", "google", "motorola", "iqoo", "poco", "nothing",
    # Laptops
    "asus", "hp", "lenovo", "dell", "msi", "acer", "medion", "alurin", "gigabyte", "lg", "microsoft", "dynabook",
    # Smartwatches
    "fossil", "garmin", "fire-boltt", "amazfit", "noise", "zebronics", "fitbit", "huawei", "pebble", "boat", "dizo",
    "gizmore", "honor", "ambrane", "crossbeats", "fastrack", "lcare", "ptron"
]

BRAND_DISPLAY = {"boat": "boAt", "hp": "HP", "asus": "ASUS", "msi": "MSI", "lg": "LG", "ptron": "pTron",
                 "iqoo": "iQOO", "oneplus": "OnePlus"}

CATEGORY_KEYWORDS = {
    "phone": ["phone", "phones", "mobile", "mobiles", "smartphone", "smartphones", "iphone"],
    "laptop": ["laptop", "laptops", "notebook", "notebooks", "macbook"],
    "smartwatch": ["smartwatch", "smartwatches", "watch", "watches", "fitness tracker", "band"]
}

# Number words: English + Hinglish
UNITS = {"k": 1_000, "thousand": 1_000, "hazaar": 1_000, "hazar": 1_000, "hajar": 1_000,
         "lakh": 100_000, "lakhs": 100_000, "lac": 100_000, "lacs": 100_000}
_UNIT_RE = "|".join(sorted(UNITS, key=len, reverse=True))

_CUR = r"(?:rs\.?|inr|₹)?\s*"
# number + optional unit; the lookahead stops "16gb ram" / "5000mah" being read as a price
_AMT = (r"(\d+(?:\.\d+)?)(?:\s*(" + _UNIT_RE + r")\b)?"
        r"(?![\d.]|\s*(?:gb|tb|mah|mp|mm|inch|hz|days?|hours?|hrs?|weeks?|months?|years?|mins?|minutes?)\b)")

_MAX_BEFORE = re.compile(
    r"(?:under|below|less than|within|upto|up to|max|maximum|not more than|budget of|budget)\s*" + _CUR + _AMT)
_MAX_AFTER = re.compile(
    _CUR + _AMT + r"\s*(?:ke andar|ke ander|ke niche|se kam|tak|or less|and below)\b")
_MIN_BEFORE = re.compile(
    r"(?:above|over|more than|at least|minimum|min|starting from)\s*" + _CUR + _AMT)
_MIN_AFTER = re.compile(
    _CUR + _AMT + r"\s*(?:se upar|se zyada|se jyada|or more|and above|plus)\b")


def _to_inr(num: str, unit: str | None) -> float:
    val = float(num)
    if unit:
        return val * UNITS[unit]
    # bare small number like "under 50" is shorthand for thousands
    return val * 1000 if val < 1000 else val


def _first_amount(patterns, text):
    for pat in patterns:
        m = pat.search(text)
        if m:
            return _to_inr(m.group(1), m.group(2))
    return None


def parse_query(message: str) -> dict:
    # lowercase and strip thousands separators: "25,000" -> "25000"
    msg_lower = re.sub(r"(?<=\d),(?=\d)", "", message.lower())
    filters = {}

    # Category extraction
    detected_categories = []
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", msg_lower):
                detected_categories.append(cat)
                break

    if len(detected_categories) == 1:
        filters["category"] = detected_categories[0]
    elif len(detected_categories) > 1:
        filters["categories"] = detected_categories

    # Budget (max) and minimum price - English and Hinglish
    max_price = _first_amount((_MAX_BEFORE, _MAX_AFTER), msg_lower)
    if max_price is not None:
        filters["max_price"] = max_price
    min_price = _first_amount((_MIN_BEFORE, _MIN_AFTER), msg_lower)
    if min_price is not None:
        filters["min_price"] = min_price

    # Brand extraction
    for brand in BRANDS:
        if re.search(r"\b" + re.escape(brand) + r"\b", msg_lower):
            # "nothing" is a common word: count it as a brand only in "nothing phone"
            if brand == "nothing" and not re.search(r"\bnothing\s+(?:phone|cmf|ear)", msg_lower):
                continue
            filters["brand"] = BRAND_DISPLAY.get(brand, brand.capitalize())
            break

    # RAM and storage: read every "<n> gb/tb [ram|ssd|storage|rom]" mention
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(gb|tb)\b(?:\s*(ram|ssd|hdd|storage|rom))?", msg_lower):
        val = float(m.group(1))
        if m.group(2) == "tb":
            val *= 1024
        kind = m.group(3)
        if kind == "ram":
            filters["ram_gb"] = val
        elif kind in ("ssd", "hdd", "storage", "rom") or m.group(2) == "tb":
            filters["storage_gb"] = val
        elif val >= 64 and "storage_gb" not in filters:
            filters["storage_gb"] = val  # bare "128gb" is storage
    ram_first = re.search(r"\bram\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*gb", msg_lower)  # "ram 16gb"
    if ram_first and "ram_gb" not in filters:
        filters["ram_gb"] = float(ram_first.group(1))

    # Legacy smartwatches: exclude discontinued lines unless explicitly requested
    filters["include_legacy"] = bool(re.search(r"\b(legacy|discontinued|old)\b", msg_lower))

    return filters


def parse_budget(query: str):
    """Compatibility helper: max budget in INR, or None."""
    return parse_query(query).get("max_price")