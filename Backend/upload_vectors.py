import json
import time
from pathlib import Path
import pandas as pd
import numpy as np

from app.services.embeddings import get_embeddings_batch
from app.services.pinecone import index

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "Unified_KB" / "all_products.csv"

def upload():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"{CSV_PATH} does not exist. Run build_unified_kb.py first.")

    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} products from {CSV_PATH}", flush=True)

    # Check Pinecone current count
    stats = index.describe_index_stats()
    print("Current Pinecone total vectors:", stats.total_vector_count, flush=True)

    batch_size = 25
    total_uploaded = 0

    for start_idx in range(0, len(df), batch_size):
        end_idx = min(start_idx + batch_size, len(df))
        batch_df = df.iloc[start_idx:end_idx]

        # Check which vectors in this batch are already uploaded
        pids = [str(r["product_id"]) for _, r in batch_df.iterrows()]
        try:
            fetch_res = index.fetch(ids=pids)
            existing_ids = set(fetch_res.get("vectors", {}).keys())
        except Exception:
            existing_ids = set()

        unuploaded_df = batch_df[~batch_df["product_id"].astype(str).isin(existing_ids)]

        if unuploaded_df.empty:
            print(f"Batch {start_idx//batch_size + 1} ({len(pids)} items) already uploaded. Skipping...", flush=True)
            continue

        descriptions = []
        metadatas = []
        product_ids = []

        for idx, row in unuploaded_df.iterrows():
            pid = str(row["product_id"])
            category = str(row["category"])
            brand = str(row["brand"]) if pd.notna(row["brand"]) else ""
            name = str(row["name"]) if pd.notna(row["name"]) else ""
            description = str(row["description"]) if pd.notna(row["description"]) else ""

            legacy = False
            if pd.notna(row.get("specs_json")):
                try:
                    specs = json.loads(row["specs_json"])
                    legacy = bool(specs.get("legacy", False))
                except Exception:
                    pass

            def clean_float(val):
                if pd.isna(val) or val is None:
                    return -1.0
                try:
                    return float(val)
                except Exception:
                    return -1.0

            metadata = {
                "product_id": pid,
                "category": category,
                "brand": brand,
                "brand_lower": brand.lower(),
                "name": name,
                "price_inr": clean_float(row.get("price_inr")),
                "price_source": str(row["price_source"]) if pd.notna(row.get("price_source")) else "",
                "ram_gb": clean_float(row.get("ram_gb")),
                "storage_gb": clean_float(row.get("storage_gb")),
                "screen_in": clean_float(row.get("screen_in")),
                "battery_mah": clean_float(row.get("battery_mah")),
                "battery_days": clean_float(row.get("battery_days")),
                "launched_year": clean_float(row.get("launched_year")),
                "rating": clean_float(row.get("rating")),
                "has_image": bool(row["has_image"]) if pd.notna(row.get("has_image")) else False,
                "image_url": str(row["image_url"]) if pd.notna(row.get("image_url")) else "",
                "legacy": legacy,
                "description": description[:1000]
            }

            product_ids.append(pid)
            descriptions.append(description)
            metadatas.append(metadata)

        embeddings = get_embeddings_batch(descriptions)

        vectors = []
        for pid, emb, meta in zip(product_ids, embeddings, metadatas):
            vectors.append({
                "id": pid,
                "values": emb,
                "metadata": meta
            })

        index.upsert(vectors=vectors)
        total_uploaded += len(vectors)
        print(f"Uploaded {len(vectors)} new items | Batch {start_idx//batch_size + 1}/{int(np.ceil(len(df)/batch_size))}", flush=True)

        # Pace requests for 100/min quota
        time.sleep(12)

    print("--- Pinecone Vector Ingestion Complete ---", flush=True)
    final_stats = index.describe_index_stats()
    print("Pinecone Final Total Vector Count:", final_stats.total_vector_count, flush=True)

if __name__ == "__main__":
    upload()