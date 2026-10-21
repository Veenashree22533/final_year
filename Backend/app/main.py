import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.products import router as products_router
from app.api.routes.chat import router as chat_router

logger = logging.getLogger("convoshop")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the embedding model + Pinecone connection so the first real
    # query isn't slow, and so any config error shows up here in the terminal.
    try:
        from app.services.retriever import retrieve_products
        retrieve_products("phone", top_k=1)
        logger.info("Warm-up OK: embeddings and Pinecone are reachable.")
    except Exception as exc:
        logger.error("Warm-up FAILED (check .env keys, Pinecone index, model): %s", exc)
    yield


app = FastAPI(title="ConvoShop RAG API", lifespan=lifespan)

# The frontend doesn't send cookies, so credentials aren't needed.
# (Browsers reject "*" combined with credentials in some cases.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/health", tags=["Health"])
app.include_router(products_router, prefix="/products", tags=["Products"])
app.include_router(chat_router, prefix="/chat", tags=["Chat"])


@app.get("/")
def root():
    return {"message": "ConvoShop Backend RAG Pipeline Running"}