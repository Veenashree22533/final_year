from app.services.embeddings import get_embedding
from app.services.pinecone import index


def search_similar_products(query, top_k=5):
    query_embedding = get_embedding(query)

    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )

    return results["matches"]