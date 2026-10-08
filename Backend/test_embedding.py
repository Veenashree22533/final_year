from app.services.embeddings import get_embedding

embedding = get_embedding("iphone 16")

print(type(embedding))
print(len(embedding))