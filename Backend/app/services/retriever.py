from app.services.query_parser import parse_query
from app.services.vector_services import search_similar_products

def retrieve_products(query: str, top_k: int = 5):
    parsed_filters = parse_query(query)

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
        return all_matches, parsed_filters

    matches = search_similar_products(query, top_k=top_k, parsed_filters=parsed_filters)
    return matches, parsed_filters
