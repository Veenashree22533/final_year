import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

try:
    model = genai.GenerativeModel("gemini-3.5-flash-lite")
except Exception:
    model = genai.GenerativeModel("gemini-3.5-flash")

ABSTAIN_MESSAGE = "Not in our catalog. No matching products were found in our verified product catalog."

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
4. Quote all specifications (RAM, Storage, Screen, Battery, Processor, Price) EXACTLY as listed.
5. If a spec is missing, explicitly state "not listed".
6. Respect user budget strictly.
7. If no retrieved product matches query/budget, state: "Not in our catalog."

REQUIRED OUTPUT FORMAT:
🎯 **Top Recommendation**: [Product Name] [Product_ID]
💰 **Price**: ₹xxxx (State "converted estimate" if applicable)

📋 **Key Specifications**:
- Battery: xxxx | RAM & Storage: xxxx | Processor/Screen: xxxx

💡 **Why Recommended & Comparison**:
- State clearly why this product best fits the query.
- Compare directly against other retrieved models in 2-3 bullet points.

Be concise, accurate, objective, and fast.
"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=250
            )
        )
        text = response.text.strip()
        if not text:
            return ABSTAIN_MESSAGE
        return text
    except Exception as e:
        # Fallback to gemini-3.5-flash if lite hits any error
        try:
            fb_model = genai.GenerativeModel("gemini-3.5-flash")
            res = fb_model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=250
                )
            )
            return res.text.strip() or ABSTAIN_MESSAGE
        except Exception as fb_err:
            print("GEMINI ERROR:", fb_err)
            return f"Gemini Error: {str(fb_err)}"