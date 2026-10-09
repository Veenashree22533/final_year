import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

SRC = Path("data/processed/smartwatches_clean.csv")
OUT = Path("data/processed")

df = pd.read_csv(SRC)
df["specs"] = df["specs"].apply(json.loads)

# 1. normalise brands
BRAND_FIX = {"boat": "boAt", "fire-boltt": "Fire-Boltt", "noise": "Noise",
             "oneplus": "OnePlus", "ptron": "pTron"}
df["brand"] = df["brand"].apply(
    lambda b: np.nan if pd.isna(b) else BRAND_FIX.get(str(b).strip().lower(), str(b).strip().title())
)


# 2. unify spec columns across the two sources
def first(specs, *keys):
    for k in keys:
        if k in specs and str(specs[k]).strip() != "":
            return specs[k]
    return np.nan


df["battery_days"] = pd.to_numeric(
    df["specs"].apply(lambda s: first(s, "battery_life_days", "average_battery_life_in_days")), errors="coerce")
df["display_size_in"] = pd.to_numeric(
    df["specs"].apply(lambda s: first(s, "display_size")).astype(str).str.extract(r"(\d+\.?\d*)")[0],
    errors="coerce")
df["touchscreen"] = df["specs"].apply(lambda s: first(s, "touchscreen"))
df["bluetooth"] = df["specs"].apply(lambda s: first(s, "bluetooth"))
df["strap_material"] = df["specs"].apply(lambda s: first(s, "strap_material"))
df["weight"] = df["specs"].apply(lambda s: first(s, "weight"))

PROMOTED = {"battery_life_days", "average_battery_life_in_days", "display_size",
            "touchscreen", "bluetooth", "strap_material", "weight"}
df["specs"] = df["specs"].apply(lambda s: json.dumps({k: v for k, v in s.items() if k not in PROMOTED}))

# 3. sanity flags
BUDGET = {"Noise", "boAt", "Fire-Boltt", "Zebronics", "Pebble", "Gizmore"}
df["flag_price"] = df["brand"].isin(BUDGET) & (df["price_inr"] > 15000)
df["flag_mrp"] = df["original_price_inr"].notna() & (df["price_inr"] > df["original_price_inr"])
df["flag_battery"] = df["battery_days"].notna() & ((df["battery_days"] > 60) | (df["battery_days"] < 0.5))
df["flag_name"] = df["name"].apply(
    lambda n: " " not in str(n) and bool(re.search(r"\d|_", str(n))))

review = df[df[["flag_price", "flag_mrp", "flag_battery", "flag_name"]].any(axis=1)]
review.drop(columns=["document"]).to_csv(OUT / "smartwatches_review.csv", index=False, encoding="utf-8-sig")

# drop rows whose price is clearly wrong; keep the other flagged rows for manual review
df = df[~(df["flag_price"] | df["flag_mrp"])]
df.loc[df["flag_battery"], "battery_days"] = np.nan   # don't keep an implausible value

# 4. dedupe again after normalising; keep the row with more specs filled in
df["_filled"] = df[["battery_days", "display_size_in", "touchscreen", "bluetooth"]].notna().sum(axis=1)
df["_key"] = df["brand"].fillna("").str.lower() + "|" + df["name"].str.lower() + "|" + df["price_inr"].astype(str)
df = df.sort_values("_filled", ascending=False).drop_duplicates("_key")
df = df.sort_values(["brand", "name"]).reset_index(drop=True)
df["product_id"] = ["sw_" + str(i + 1).zfill(4) for i in range(len(df))]


# 5. rebuild the retrieval text from the unified fields
def make_doc(r):
    brand, name = str(r["brand"]), str(r["name"])
    title = name if name.lower().startswith(brand.lower()) else f"{brand} {name}"
    p = [f"{title} (smartwatch)", f"Price: Rs {int(r['price_inr']):,}"]
    if r["discount_pct"] > 0:
        p.append(f"Discount: {r['discount_pct']}%")
    if pd.notna(r["display"]):
        p.append(f"Display: {r['display']}")
    if pd.notna(r["display_size_in"]):
        p.append(f"Display size: {r['display_size_in']:g} inches")
    if pd.notna(r["battery_days"]):
        p.append(f"Battery life: {r['battery_days']:g} days")
    for label, col in [("Touchscreen", "touchscreen"), ("Bluetooth", "bluetooth"),
                       ("Strap", "strap_material"), ("Weight", "weight")]:
        if pd.notna(r[col]):
            p.append(f"{label}: {r[col]}")
    if pd.notna(r["rating"]):
        p.append(f"Rating: {r['rating']}/5")
    return ". ".join(p)


df["document"] = df.apply(make_doc, axis=1)

cols = ["product_id", "category", "brand", "name", "price_inr", "original_price_inr", "discount_pct",
        "rating", "rating_count", "display", "display_size_in", "battery_days", "touchscreen",
        "bluetooth", "strap_material", "weight", "specs", "document", "source"]
df[cols].to_csv(OUT / "smartwatches_final.csv", index=False, encoding="utf-8-sig")

print("final rows:", len(df), "| flagged for review:", len(review))
print(df["brand"].value_counts().head(12))
print("filled:", df[["battery_days", "display_size_in", "touchscreen", "bluetooth"]].notna().mean().round(2).to_dict())
print(df["document"].sample(3, random_state=1).to_string())