from app.services.vector_services import search_similar_products

results = search_similar_products(
    "best samsung phone"
)

for r in results:
    print(r)