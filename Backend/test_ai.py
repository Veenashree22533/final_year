from app.services.rag_pipeline import answer_query

response = answer_query(
    
    "best samsung phone under 50000"
)


print(response)