from app.db.mongo import products_collection

phones = list(
    products_collection.find(
        {"brand": {"$regex": "Samsung", "$options": "i"}},
        {"_id": 0, "brand": 1, "model_name": 1, "price_inr": 1}
    ).limit(20)
)

print("Count:", len(phones))

for p in phones:
    print(p)