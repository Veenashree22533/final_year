from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.products import router as products_router
from app.api.routes.chat import router as chat_router
app = FastAPI(title="Phone Recommendation API")

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
    return {"message": "Backend Running"}