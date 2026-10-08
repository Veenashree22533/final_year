from app.db.mongo import products_collection
import math


def clean_document(doc):
    for key, value in doc.items():
        if isinstance(value, float) and math.isnan(value):
            doc[key] = None
    return doc


def get_all_products():
    products = list(
        products_collection.find(
            {},
            {"_id": 0}
        )
    )

    return [clean_document(product) for product in products]


def get_product_by_phone_id(phone_id):
    product = products_collection.find_one(
        {"phone_id": phone_id},
        {"_id": 0}
    )

    if product:
        product = clean_document(product)

    return product


def search_products(filters):
    query = {}

    if filters.get("brand"):
        query["brand"] = {
            "$regex": filters["brand"],
            "$options": "i"
        }

    if filters.get("max_price"):
        query["price_inr"] = {
            "$lte": filters["max_price"]
        }

    products = list(
        products_collection.find(
            query,
            {"_id": 0}
        ).limit(10)
    )

    return [clean_document(product) for product in products]