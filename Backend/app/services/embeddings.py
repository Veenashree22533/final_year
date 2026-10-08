import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

def get_embedding(text: str):
    response = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text
    )

    return response["embedding"]