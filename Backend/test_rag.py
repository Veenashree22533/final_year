import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.services.rag_pipeline import answer_query

queries = [
    "Best Samsung phone under 30000",
    "ASUS laptop with 16GB RAM under 70000",
    "Fossil smartwatch with heart rate sensor",
    "NVIDIA RTX 5090 gaming desktop under 50000"  # Expected: Not in our catalog
]

for q in queries:
    print("\n==========================================")
    print("QUERY:", q)
    print("------------------------------------------")
    response = answer_query(q)
    print(response)