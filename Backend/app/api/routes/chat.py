
from fastapi import APIRouter, HTTPException
from app.schemas.chat import ChatRequest
from app.services.rag_pipeline import answer_query

router = APIRouter()


@router.post("/")
def chat(request: ChatRequest):
    """
    Process a user's message through the RAG pipeline and return
    the generated answer, parsed filters, matching products,
    and similarity scores when available.
    """

    # Validate the query
    message = request.message.strip() if request.message else ""

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    try:
        # Run the existing RAG pipeline
        response_text, matches, parsed_filters = answer_query(
            message,
            return_matches=True
        )

        # Normalize product matches for the frontend
        clean_matches = []

        for match in matches or []:
            meta = match.get("metadata") or {}

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
                "image": meta.get("image_url") or "",
                "description": meta.get("description"),
                "score": match.get("score")
            })

        return {
            "query": message,
            "response": response_text,
            "filters": parsed_filters or {},
            "matches": clean_matches
        }

    except HTTPException:
        raise

    except Exception as exc:
        # Log the actual error in the FastAPI terminal
        print(f"Chat endpoint error: {exc}")

        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your query."
        ) from exc
