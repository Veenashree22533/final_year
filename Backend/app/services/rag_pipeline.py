from app.services.vector_services import search_similar_products
from app.services.llm import generate_response


def answer_query(query):
    matches = search_similar_products(query)

    if not matches:
        return "No matching phones found in database."

    context = ""

    for match in matches:
        metadata = match.metadata

        context += f"""
Brand: {metadata.get('brand')}
Model: {metadata.get('model_name')}
Price: ₹{metadata.get('price_inr')}
Battery: {metadata.get('battery')}
RAM: {metadata.get('ram')}
Storage: {metadata.get('storage_gb')}
Processor: {metadata.get('processor')}
Back Camera: {metadata.get('back_camera')}
Screen: {metadata.get('screen')}
"""

    return generate_response(query, context)