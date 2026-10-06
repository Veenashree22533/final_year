import json
from pathlib import Path
import pandas as pd

RAW = Path("data/raw/huggingface/PhoneSpecsDataset25K.json")
OUT = Path("data/interim/phonedb_flat.csv")

KEEP = {
    "Brand": "brand", "Model": "model", "Released": "released", "Announced": "announced",
    "Device Category": "category", "Operating System": "os", "CPU": "cpu",
    "RAM Capacity (converted)": "ram", "Non-volatile Memory Capacity (converted)": "storage",
    "Display Diagonal": "display_size", "Resolution": "resolution",
    "Display Refresh Rate": "refresh_rate", "Display Type": "display_type",
    "Nominal Battery Capacity": "battery", "Price": "price",
    "Market Countries": "countries", "Market Regions": "regions",
}

def val(specs, key):
    item = specs.get(key)
    if isinstance(item, dict):
        v = item.get("value")
        return v.strip() if isinstance(v, str) else v
    return None

rows = []
for rec in json.loads(RAW.read_text(encoding="utf-8")):
    specs = rec.get("specs") or {}
    row = {"title": rec.get("title"), "url": rec.get("url"), "img": rec.get("img")}
    for src, dst in KEEP.items():
        row[dst] = val(specs, src)
    row["price_currency"] = val(specs, "null")
    rows.append(row)

df = pd.DataFrame(rows)
df["release_year"] = df["released"].astype(str).str.extract(r"(\d{4})")[0].astype(float)
OUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUT, index=False, encoding="utf-8-sig")

print("rows:", len(df))
print("\ncategories:\n", df["category"].value_counts().head(8))
print("\nrelease years:\n", df["release_year"].value_counts().sort_index().tail(6))
print("\nprice non-null:", df["price"].notna().sum())
print(df[["price", "price_currency"]].dropna().head(8))
print("\nsmartphones 2024-2025:",
      ((df["category"] == "Smartphone") & df["release_year"].isin([2024, 2025])).sum())
