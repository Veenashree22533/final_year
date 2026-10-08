from app.db.mongo import products_collection

print(products_collection.count_documents({}))