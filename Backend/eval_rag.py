import sys
sys.stdout.reconfigure(encoding='utf-8')
import json
import time
from pathlib import Path
import pandas as pd
import google.generativeai as genai

from app.config import GEMINI_API_KEY
from app.services.pinecone import index
from app.services.embeddings import get_embedding
from app.services.rag_pipeline import answer_query

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-3.5-flash")

ROOT = Path(__file__).resolve().parents[1]
EVAL_CSV = ROOT / "Unified_KB" / "eval_questions.csv"

def run_plain_llm(question: str) -> str:
    prompt = f"""
You are an AI shopping assistant.
Question: {question}
Answer directly. If you don't know or if it's not a real catalog product, say "Not in our catalog".
"""
    try:
        res = model.generate_content(prompt)
        return res.text.strip()
    except Exception as e:
        return f"Error: {e}"

def run_basic_rag(question: str) -> str:
    emb = get_embedding(question)
    res = index.query(vector=emb, top_k=5, include_metadata=True)
    matches = res.get("matches", [])

    if not matches:
        return "Not in our catalog."

    context = "\n".join([
        f"Product [{m['metadata'].get('product_id')}]: {m['metadata'].get('name')} | "
        f"Brand: {m['metadata'].get('brand')} | Price: ₹{m['metadata'].get('price_inr')} | "
        f"Description: {m['metadata'].get('description')}"
        for m in matches
    ])

    prompt = f"""
Answer the user question using ONLY the provided catalog context:
CONTEXT:
{context}

QUESTION:
{question}
"""
    try:
        ans = model.generate_content(prompt)
        return ans.text.strip()
    except Exception as e:
        return f"Error: {e}"

def run_full_pipeline(question: str) -> str:
    return answer_query(question)

def evaluate_response(qtype: str, response: str) -> dict:
    resp_lower = response.lower()
    is_abstain = any(term in resp_lower for term in ["not in our catalog", "not listed", "no matching products", "don't sell", "do not sell", "not available"])

    is_hallucination = False
    if qtype in ["not_in_catalog", "not_listed"] and not is_abstain:
        is_hallucination = True

    is_correct_abstain = False
    if qtype in ["not_in_catalog", "not_listed"] and is_abstain:
        is_correct_abstain = True

    return {
        "is_abstain": is_abstain,
        "is_hallucination": is_hallucination,
        "is_correct_abstain": is_correct_abstain
    }

def main():
    if not EVAL_CSV.exists():
        print("eval_questions.csv not found!")
        return

    df = pd.read_csv(EVAL_CSV)
    print(f"Running evaluation benchmark on sample questions...", flush=True)

    # Take a 15-question sample across types
    sample_df = df.sample(min(len(df), 15), random_state=42).reset_index(drop=True)

    plain_hallucinations, plain_abstentions = 0, 0
    basic_hallucinations, basic_abstentions = 0, 0
    full_hallucinations, full_abstentions = 0, 0
    total_unanswerable = 0

    for idx in range(len(sample_df)):
        row = sample_df.iloc[idx]
        qtype = str(row["type"])
        question = str(row["question"])
        qid = str(row["qid"])

        if qtype in ["not_in_catalog", "not_listed"]:
            total_unanswerable += 1

        print(f"[{qid}] ({qtype}): {question}", flush=True)

        ans_plain = run_plain_llm(question)
        eval_plain = evaluate_response(qtype, ans_plain)
        if eval_plain["is_hallucination"]: plain_hallucinations += 1
        if eval_plain["is_correct_abstain"]: plain_abstentions += 1

        ans_basic = run_basic_rag(question)
        eval_basic = evaluate_response(qtype, ans_basic)
        if eval_basic["is_hallucination"]: basic_hallucinations += 1
        if eval_basic["is_correct_abstain"]: basic_abstentions += 1

        ans_full = run_full_pipeline(question)
        eval_full = evaluate_response(qtype, ans_full)
        if eval_full["is_hallucination"]: full_hallucinations += 1
        if eval_full["is_correct_abstain"]: full_abstentions += 1

        time.sleep(0.2)

    total_q = len(sample_df)

    print("\n=======================================================================", flush=True)
    print("                      CONVOSHOP RAG EVALUATION REPORT                   ", flush=True)
    print("=======================================================================", flush=True)
    print(f"Total Benchmark Questions Tested: {total_q}", flush=True)
    print(f"Unanswerable / Out-of-Catalog Questions: {total_unanswerable}", flush=True)
    print("-----------------------------------------------------------------------", flush=True)
    print(f"{'System Architecture':<30} | {'Hallucinations':<15} | {'Correct Abstentions':<20}", flush=True)
    print("-----------------------------------------------------------------------", flush=True)
    print(f"{'(a) Plain LLM (No RAG)':<30} | {plain_hallucinations}/{total_q:<13} | {plain_abstentions}/{total_unanswerable:<18}", flush=True)
    print(f"{'(b) Basic RAG (Vector Only)':<30} | {basic_hallucinations}/{total_q:<13} | {basic_abstentions}/{total_unanswerable:<18}", flush=True)
    print(f"{'(c) Full Hybrid Pipeline':<30} | {full_hallucinations}/{total_q:<13} | {full_abstentions}/{total_unanswerable:<18}", flush=True)
    print("=======================================================================", flush=True)

if __name__ == "__main__":
    main()
