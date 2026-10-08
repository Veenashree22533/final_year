from fastapi import APIRouter
from app.schemas.chat import ChatRequest
from app.services.rag_pipeline import answer_query

router = APIRouter()


@router.post("/")
def chat(request: ChatRequest):

    response = answer_query(
        request.message
    )

    return {
        "query": request.message,
        "response": response
    }