from app.db.mongo import products_collection

product = products_collection.find_one()

print(product)