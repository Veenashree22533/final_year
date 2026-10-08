from app.services.rag_pipeline import get_product_context

context = get_product_context(
    {
  "message": "best samsung phone for gaming under 100000"
}
)

print(context)