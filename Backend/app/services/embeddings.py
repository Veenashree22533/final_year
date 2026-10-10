import time
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

def get_embedding(text: str, retries: int = 5):
    for attempt in range(retries):
        try:
            response = genai.embed_content(
                model="models/gemini-embedding-001",
                content=text
            )
            return response["embedding"]
        except ResourceExhausted as e:
            print(f"Rate limit hit (429). Retrying in {(attempt+1)*5}s...", flush=True)
            time.sleep((attempt + 1) * 5)
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(3)

def get_embeddings_batch(texts: list[str], retries: int = 5):
    for attempt in range(retries):
        try:
            response = genai.embed_content(
                model="models/gemini-embedding-001",
                content=texts
            )
            return response["embedding"]
        except ResourceExhausted as e:
            print(f"Rate limit hit (429). Waiting {(attempt+1)*6}s for quota reset...", flush=True)
            time.sleep((attempt + 1) * 6)
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(3)