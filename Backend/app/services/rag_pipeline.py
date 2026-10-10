from app.services.retriever import retrieve_products
from app.services.llm import generate_response, ABSTAIN_MESSAGE

SIMILARITY_SCORE_CUTOFF = 0.35

def to_float(val):
    if val is None or val == "" or val == "N/A" or val == "nan":
        return -1.0
    try:
        f = float(val)
        return -1.0 if (f != f or f < 0) else f
    except Exception:
        return -1.0

def answer_query(query: str, return_matches: bool = False):
    matches, parsed_filters = retrieve_products(query, top_k=5)

    if not matches:
        return (ABSTAIN_MESSAGE, [], parsed_filters) if return_matches else ABSTAIN_MESSAGE

    top_score = matches[0].get("score", 1.0)
    if top_score < SIMILARITY_SCORE_CUTOFF:
        return (ABSTAIN_MESSAGE, matches, parsed_filters) if return_matches else ABSTAIN_MESSAGE

    context_blocks = []

    for match in matches:
        meta = match.get("metadata", {})
        pid = meta.get("product_id", "N/A")
        cat = meta.get("category", "N/A")
        brand = meta.get("brand", "N/A")
        name = meta.get("name", "N/A")

        price = to_float(meta.get("price_inr"))
        price_str = f"₹{price:,.0f}" if price > 0 else "not listed"
        if meta.get("price_source") == "converted_from_EUR" and price > 0:
            price_str += " (converted estimate from EUR)"

        ram = to_float(meta.get("ram_gb"))
        ram_str = f"{ram:g} GB" if ram > 0 else "not listed"

        storage = to_float(meta.get("storage_gb"))
        storage_str = f"{storage:g} GB" if storage > 0 else "not listed"

        screen = to_float(meta.get("screen_in"))
        screen_str = f"{screen:g} inches" if screen > 0 else "not listed"

        bat_m = to_float(meta.get("battery_mah"))
        bat_d = to_float(meta.get("battery_days"))
        if bat_m > 0:
            bat_str = f"{bat_m:g} mAh"
        elif bat_d > 0:
            bat_str = f"{bat_d:g} days"
        else:
            bat_str = "not listed"

        desc = meta.get("description", "No description available.")
        if len(desc) > 200:
            desc = desc[:200] + "..."

        block = f"""
Product ID: [{pid}]
Category: {cat}
Brand: {brand}
Name: {name}
Price: {price_str}
RAM: {ram_str}
Storage: {storage_str}
Screen: {screen_str}
Battery: {bat_str}
Full Description: {desc}
-----------------------------------"""
        context_blocks.append(block)

    context = "\n".join(context_blocks)
    response_text = generate_response(query, context)
    return (response_text, matches, parsed_filters) if return_matches else response_text