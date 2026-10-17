import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

try:
    model = genai.GenerativeModel("gemini-3.5-flash-lite")
except Exception:
    model = genai.GenerativeModel("gemini-3.5-flash")

ABSTAIN_MESSAGE = "Not in our catalog. No matching products were found in our verified product catalog."

MAX_TOKENS = 600


def generate_response(query: str, context: str) -> str:
    if not context.strip():
        return ABSTAIN_MESSAGE

    prompt = f"""
You are ConvoShop, an expert conversational shopping assistant.

CATALOG PRODUCTS RETRIEVED FROM VERIFIED DATABASE:
{context}

USER QUESTION:
{query}

CRITICAL RULES & CONSTRAINTS:
1. Answer ONLY using the retrieved catalog products provided above.
2. DO NOT invent specs, prices, models, ratings, or features from external memory.
3. For every product mentioned, cite its product_id in brackets, e.g. [ph_0012], [lp_0450], [sw_0120].
4. Each product_id must match its product name exactly as written in the catalog above. Copy them, never guess them.
5. Quote all specifications (RAM, Storage, Screen, Battery, Processor, Price) EXACTLY as listed.
6. If a spec is missing, explicitly state "not listed".
7. Respect the user's budget strictly. Never recommend a product above it.
8. If no retrieved product matches the query or budget, reply with exactly: "Not in our catalog."
9. Use plain text only. No emojis. Never write corrections, notes, or asides in the answer.
10. Always finish your last sentence.

REQUIRED OUTPUT FORMAT:
### Top Recommendation
**[Product Name]** [Product_ID] - INR price (say "converted estimate" if applicable)

### Key Specifications
- Battery: xxxx
- RAM & Storage: xxxx
- Processor/Screen: xxxx

### Why Recommended & Comparison
- State clearly why this product best fits the query.
- Compare directly against the other retrieved models in 2-3 short bullet points.

Be concise, accurate and objective.
"""

    config = genai.types.GenerationConfig(temperature=0.1, max_output_tokens=MAX_TOKENS)

    try:
        response = model.generate_content(prompt, generation_config=config)
        text = response.text.strip()
        if not text:
            return ABSTAIN_MESSAGE
        return text
    except Exception:
        # Fallback to gemini-3.5-flash if lite hits any error
        try:
            fb_model = genai.GenerativeModel("gemini-3.5-flash")
            res = fb_model.generate_content(prompt, generation_config=config)
            return res.text.strip() or ABSTAIN_MESSAGE
        except Exception as fb_err:
            print("GEMINI ERROR:", fb_err)
            return f"Gemini Error: {str(fb_err)}"