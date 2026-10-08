from app.db.mongo import products_collection
from app.services.embeddings import get_embedding
from app.services.pinecone import index

phones = list(products_collection.find({}))

vectors = []

for phone in phones:

    text = f"""
Brand: {phone.get('brand')}
Model: {phone.get('model_name')}
Price: {phone.get('price_inr')} INR
RAM: {phone.get('ram')}
Storage: {phone.get('storage_gb')}GB
Battery: {phone.get('battery')}
Processor: {phone.get('processor')}
Camera: {phone.get('back_camera')}
Screen: {phone.get('screen')}
"""

    embedding = get_embedding(text)

    metadata = {
        "brand": str(phone.get("brand") or ""),
        "model_name": str(phone.get("model_name") or ""),
        "price_inr": float(phone.get("price_inr") or 0),
        "ram": str(phone.get("ram") or ""),
        "storage_gb": str(phone.get("storage_gb") or ""),
        "battery": str(phone.get("battery") or ""),
        "processor": str(phone.get("processor") or ""),
        "back_camera": str(phone.get("back_camera") or ""),
        "screen": str(phone.get("screen") or "")
    }

    vectors.append(
        {
            "id": str(phone["_id"]),
            "values": embedding,
            "metadata": metadata
        }
    )

    if len(vectors) == 50:
        index.upsert(vectors=vectors)
        print("Uploaded 50")
        vectors = []

if vectors:
    index.upsert(vectors=vectors)

print("Upload complete")