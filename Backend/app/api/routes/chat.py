from fastapi import APIRouter
from app.schemas.chat import ChatRequest
from app.services.retriever import retrieve_products
from app.services.rag_pipeline import answer_query

router = APIRouter()

@router.post("/")
def chat(request: ChatRequest):
    response_text, matches, parsed_filters = answer_query(request.message, return_matches=True)

    clean_matches = []
    for match in matches:
        meta = match.get("metadata", {})
        clean_matches.append({
            "id": meta.get("product_id"),
            "product_id": meta.get("product_id"),
            "title": meta.get("name"),
            "brand": meta.get("brand"),
            "category": meta.get("category"),
            "price": meta.get("price_inr"),
            "ram_gb": meta.get("ram_gb"),
            "storage_gb": meta.get("storage_gb"),
            "screen_in": meta.get("screen_in"),
            "image": meta.get("image_url", ""),
            "description": meta.get("description")
        })

    return {
        "query": request.message,
        "response": response_text,
        "filters": parsed_filters,
        "matches": clean_matches
    }