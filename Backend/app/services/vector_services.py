from app.services.embeddings import get_embedding
from app.services.pinecone import index

def build_pinecone_filter(parsed_filters: dict) -> dict:
    if not parsed_filters:
        return {}

    conditions = {}

    if "category" in parsed_filters and parsed_filters["category"]:
        conditions["category"] = {"$eq": str(parsed_filters["category"]).lower()}

    if "brand" in parsed_filters and parsed_filters["brand"]:
        conditions["brand_lower"] = {"$eq": str(parsed_filters["brand"]).lower()}

    price_cond = {}
    if "max_price" in parsed_filters and parsed_filters["max_price"] is not None:
        price_cond["$lte"] = float(parsed_filters["max_price"])
    if "min_price" in parsed_filters and parsed_filters["min_price"] is not None:
        price_cond["$gte"] = float(parsed_filters["min_price"])
    if price_cond:
        conditions["price_inr"] = price_cond

    if "ram_gb" in parsed_filters and parsed_filters["ram_gb"] is not None:
        conditions["ram_gb"] = {"$gte": float(parsed_filters["ram_gb"])}

    if "storage_gb" in parsed_filters and parsed_filters["storage_gb"] is not None:
        conditions["storage_gb"] = {"$gte": float(parsed_filters["storage_gb"])}

    if not parsed_filters.get("include_legacy", False):
        conditions["legacy"] = {"$ne": True}

    return conditions

def search_similar_products(query: str, top_k: int = 5, parsed_filters: dict = None):
    query_embedding = get_embedding(query)

    pinecone_filter = build_pinecone_filter(parsed_filters) if parsed_filters else None

    query_kwargs = {
        "vector": query_embedding,
        "top_k": top_k,
        "include_metadata": True
    }

    if pinecone_filter:
        query_kwargs["filter"] = pinecone_filter

    results = index.query(**query_kwargs)
    matches = results.get("matches", [])

    # Fallback search if strict numeric filters returned zero results
    if not matches and pinecone_filter and ("price_inr" in pinecone_filter or "ram_gb" in pinecone_filter or "storage_gb" in pinecone_filter):
        relaxed_filter = {}
        if "category" in pinecone_filter:
            relaxed_filter["category"] = pinecone_filter["category"]
        if "brand_lower" in pinecone_filter:
            relaxed_filter["brand_lower"] = pinecone_filter["brand_lower"]
        relaxed_filter["legacy"] = {"$ne": True}

        query_kwargs["filter"] = relaxed_filter
        results = index.query(**query_kwargs)
        matches = results.get("matches", [])

    return matches