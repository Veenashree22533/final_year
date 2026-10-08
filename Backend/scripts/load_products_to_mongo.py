import pandas as pd
from pathlib import Path

from app.db.mongo import products_collection

# Get project root
BASE_DIR = Path(__file__).resolve().parents[2]

csv_path = BASE_DIR / "Phone_Datasets" / "data" / "processed" / "phones_final.csv"

print(f"Reading: {csv_path}")

df = pd.read_csv(csv_path)

print(f"Rows found: {len(df)}")

records = df.to_dict(orient="records")

# Clear old data
products_collection.delete_many({})

# Insert new data
result = products_collection.insert_many(records)

print(f"Inserted {len(result.inserted_ids)} phones successfully")