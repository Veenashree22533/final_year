from app.services.pinecone import index

stats = index.describe_index_stats()

print("TOTAL:", stats.total_vector_count)
print("NAMESPACES:", stats.namespaces)
print(stats)