import re


def parse_query(message: str):
    filters = {}

    # Budget extraction
    budget_match = re.search(r"under\s+(\d+)", message.lower())
    if budget_match:
        filters["max_price"] = int(budget_match.group(1))

    # Brand extraction
    brands = [
        "apple",
        "samsung",
        "xiaomi",
        "realme",
        "oppo",
        "vivo",
        "oneplus",
        "google"
    ]

    for brand in brands:
        if brand in message.lower():
            filters["brand"] = brand.capitalize()
            break

    # RAM extraction
    ram_match = re.search(r"(\d+)\s*gb\s*ram", message.lower())
    if ram_match:
        filters["ram_gb"] = int(ram_match.group(1))

    return filters