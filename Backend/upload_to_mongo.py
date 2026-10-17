import os
import math
import json
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")
COLLECTION = "products_unified"
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "Unified_KB", "all_products.csv")


def clean_val(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    return val


def parse_specs(s):
    if not s or (isinstance(s, float) and math.isnan(s)):
        return {}
    try:
        return json.loads(s)
    except Exception:
        return {}


def text(row, key):
    return str(row[key]) if pd.notna(row.get(key)) else None


def build_document(row):
    specs = parse_specs(row.get("specs_json"))
    brand = text(row, "brand")
    return {
        "product_id": str(row["product_id"]),
        "category": str(row["category"]),
        "brand": brand,
        "brand_lower": brand.lower() if brand else None,
        "name": text(row, "name"),
        "price_inr": clean_val(row.get("price_inr")),
        "price_source": text(row, "price_source") or "original",
        "ram_gb": clean_val(row.get("ram_gb")),
        "storage_gb": clean_val(row.get("storage_gb")),
        "screen_in": clean_val(row.get("screen_in")),
        "battery_mah": clean_val(row.get("battery_mah")),
        "battery_days": clean_val(row.get("battery_days")),
        "rating": clean_val(row.get("rating")),
        "launched_year": clean_val(row.get("launched_year")),
        "has_image": bool(row["has_image"]) if pd.notna(row.get("has_image")) else False,
        "image_url": text(row, "image_url"),
        "description": text(row, "description"),
        "specs": specs,
        "legacy": bool(specs.get("legacy", False)),
    }


df = pd.read_csv(CSV_PATH)
print("Loaded", len(df), "products")

col = MongoClient(MONGO_URI)[DATABASE_NAME][COLLECTION]

ops = []
for _, row in df.iterrows():
    doc = build_document(row)
    ops.append(UpdateOne({"product_id": doc["product_id"]}, {"$set": doc}, upsert=True))

for i in range(0, len(ops), 500):
    col.bulk_write(ops[i:i + 500])

col.create_index("product_id", unique=True)
col.create_index("category")
col.create_index("brand_lower")
col.create_index("price_inr")
col.create_index("ram_gb")
col.create_index("rating")
col.create_index("legacy")
col.create_index([("category", 1), ("brand_lower", 1), ("price_inr", 1)])

print("Total in collection:", col.count_documents({}))