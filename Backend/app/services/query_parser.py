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

CATEGORY_KEYWORDS = {
    "phone": ["phone", "phones", "mobile", "mobiles", "smartphone", "smartphones", "iphone"],
    "laptop": ["laptop", "laptops", "notebook", "notebooks", "macbook"],
    "smartwatch": ["smartwatch", "smartwatches", "watch", "watches", "fitness tracker", "band"]
}

def parse_query(message: str) -> dict:
    msg_lower = message.lower()
    filters = {}

    # Category extraction
    detected_categories = []
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', msg_lower):
                detected_categories.append(cat)
                break

    if len(detected_categories) == 1:
        filters["category"] = detected_categories[0]
    elif len(detected_categories) > 1:
        filters["categories"] = detected_categories

    # Budget extraction (max price)
    max_price_match = re.search(r"(?:under|below|less than|within|upto|up to|max|budget of)\s*(?:rs\.?|inr|₹)?\s*(\d+)\s*(k|thousand|lakh)?", msg_lower)
    if max_price_match:
        val = float(max_price_match.group(1))
        unit = max_price_match.group(2)
        if unit in ["k", "thousand"]:
            val *= 1000
        elif unit == "lakh":
            val *= 100000
        elif val < 1000 and "k" not in msg_lower and "lakh" not in msg_lower:
            # Handle e.g. "under 50k" vs "under 50000"
            val *= 1000
        filters["max_price"] = val

    # Min price extraction
    min_price_match = re.search(r"(?:above|over|more than|at least|starting from)\s*(?:rs\.?|inr|₹)?\s*(\d+)\s*(k|thousand|lakh)?", msg_lower)
    if min_price_match:
        val = float(min_price_match.group(1))
        unit = min_price_match.group(2)
        if unit in ["k", "thousand"]:
            val *= 1000
        elif unit == "lakh":
            val *= 100000
        elif val < 1000:
            val *= 1000
        filters["min_price"] = val

    # Brand extraction
    for brand in BRANDS:
        pattern = r'\b' + re.escape(brand) + r'\b'
        if re.search(pattern, msg_lower):
            # Normalize display brand name
            if brand == "boat":
                filters["brand"] = "boAt"
            elif brand == "hp":
                filters["brand"] = "HP"
            elif brand == "asus":
                filters["brand"] = "ASUS"
            elif brand == "msi":
                filters["brand"] = "MSI"
            elif brand == "lg":
                filters["brand"] = "LG"
            elif brand == "ptron":
                filters["brand"] = "pTron"
            else:
                filters["brand"] = brand.capitalize()
            break

    # RAM extraction
    ram_match = re.search(r"(\d+)\s*gb\s*ram", msg_lower)
    if ram_match:
        filters["ram_gb"] = float(ram_match.group(1))

    # Storage extraction
    storage_match = re.search(r"(\d+)\s*(?:gb|tb)\s*(?:ssd|storage|rom)?", msg_lower)
    if storage_match and "ram" not in storage_match.group(0):
        val = float(storage_match.group(1))
        if "tb" in storage_match.group(0):
            val *= 1024
        filters["storage_gb"] = val

    # Legacy smartwatches: exclude discontinued lines unless explicitly requested
    if "legacy" in msg_lower or "discontinued" in msg_lower or "old" in msg_lower:
        filters["include_legacy"] = True
    else:
        filters["include_legacy"] = False

    return filters