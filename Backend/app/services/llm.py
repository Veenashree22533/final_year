import google.generativeai as genai
from app.config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

print("MODEL LOADED: gemini-3.5-flash-lite")

model = genai.GenerativeModel("gemini-3.5-flash-lite")


def generate_response(query, context):

    # No matching products found
    if not context.strip():
        return """
Sorry, I couldn't find any phones matching your requirements in the current database.

Try:
• Increasing your budget
• Changing the brand
• Using fewer filters

Example:
- Best Samsung phone under 70000
- Best camera phone under 100000
- Best gaming phone
"""

    prompt = f"""
You are an expert smartphone recommendation assistant.

PHONE DATA:
{context}

USER QUESTION:
{query}

RULES:
- Use ONLY the phone data provided.
- Never invent specifications.
- Respect budget limits mentioned by the user.
- If the user asks for camera quality, prioritize camera specifications.
- If the user asks for battery life, prioritize battery capacity.
- If the user asks for gaming, prioritize processor and RAM.
- If the user asks for value for money, compare specifications against price.
- Rank recommendations from best to worst.
- Explain clearly why each phone was selected.
- Mention exact prices from the provided data.
- If a phone exceeds the user's budget, do not recommend it unless explicitly asked.
- If only one phone matches, return only one phone.
- If two phones match, return only two phones.
- Do not create fake recommendations.

OUTPUT FORMAT:

#1 Phone Name
Price: ₹xxxx

Specifications:
- Battery: xxxx
- Processor: xxxx
- RAM: xxxx
- Storage: xxxx
- Camera: xxxx
- Screen: xxxx

Why Recommended:
- Point 1
- Point 2
- Point 3
"""

    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print("GEMINI ERROR:", e)
        return f"Gemini Error: {str(e)}"