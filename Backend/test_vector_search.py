from app.services.vector_services import search_similar_products

results = search_similar_products(
    "best samsung phone under 100000"
)

for match in results:
    print(match)