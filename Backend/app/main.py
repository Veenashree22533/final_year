from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.products import router as products_router
from app.api.routes.chat import router as chat_router

app = FastAPI(title="ConvoShop RAG API")

# Enable CORS for Frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    health_router,
    prefix="/health",
    tags=["Health"]
)

app.include_router(
    products_router,
    prefix="/products",
    tags=["Products"]
)

app.include_router(
    chat_router,
    prefix="/chat",
    tags=["Chat"]
)

@app.get("/")
def root():
    return {"message": "ConvoShop Backend RAG Pipeline Running"}