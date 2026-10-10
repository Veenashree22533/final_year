import json
from pathlib import Path

import numpy as np
import pandas as pd

P = Path("data/processed")
df = pd.read_csv(P / "smartwatches_final_v2.csv")
df["brand"] = df["brand"].replace({"Dizo By Realme": "Dizo", "Huami": "Amazfit"})

specs = df["specs"].apply(json.loads)
df["dial_shape"] = specs.apply(lambda s: s.get("dial_shape", np.nan))
df["strap_color"] = specs.apply(lambda s: s.get("strap_color", np.nan))

yn = {"yes": True, "no": False}
for c in ["touchscreen", "bluetooth"]:
    df[c] = df[c].astype("string").str.strip().str.lower().map(yn)

df["watch_id"] = range(1, len(df) + 1)
df["model_name"] = df["name"]
df["display_type"] = df["display"]
df["screen_in"] = df["display_size_in"]      # same column name as phones/laptops; missing stays missing
df["image_url"] = np.nan          # no images in the Kaggle sources
df["has_image"] = False


def describe(r):
    p = [f"{r['model_name']} by {r['brand']} is a smartwatch.",
         f"Price: INR {int(r['price_inr']):,}"
         + (f" (MRP INR {int(r['original_price_inr']):,}, {r['discount_pct']:g}% off)." if r["discount_pct"] > 0 else ".")]
    p.append(f"Display size: {r['display_size_in']:g} inches." if pd.notna(r["display_size_in"]) else "Display size: not listed.")
    if pd.notna(r["display_type"]):
        p.append(f"Display type: {r['display_type']}.")
    p.append(f"Battery life: {r['battery_days']:g} days." if pd.notna(r["battery_days"]) else "Battery life: not listed.")
    if pd.notna(r["touchscreen"]):
        p.append("Touchscreen: " + ("yes." if r["touchscreen"] else "no."))
    if pd.notna(r["bluetooth"]):
        p.append("Bluetooth: " + ("yes." if r["bluetooth"] else "no."))
    if pd.notna(r["strap_material"]):
        p.append(f"Strap material: {r['strap_material']}.")
    if pd.notna(r["rating"]):
        n = f" from {int(r['rating_count']):,} ratings" if pd.notna(r["rating_count"]) else ""
        p.append(f"Customer rating: {r['rating']}/5{n}.")
    return " ".join(p)


df["description"] = df.apply(describe, axis=1)

cols = ["watch_id", "brand", "model_name", "category", "price_inr", "original_price_inr", "discount_pct",
        "rating", "rating_count", "display_type", "display_size_in", "battery_days", "touchscreen",
        "bluetooth", "strap_material", "dial_shape", "strap_color", "legacy", "image_url", "has_image",
        "source", "description"]
out = df[cols]
out.drop(columns=["description"]).to_csv(P / "smartwatches_final.csv", index=False, encoding="utf-8-sig")
out.to_csv(P / "smartwatches_kb.csv", index=False, encoding="utf-8-sig")

print("wrote smartwatches_final.csv and smartwatches_kb.csv:", len(out), "rows")
print(out["description"].iloc[0])