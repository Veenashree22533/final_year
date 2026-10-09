import re
from pathlib import Path

import numpy as np
import pandas as pd

P = Path("data/processed")
df = pd.read_csv(P / "smartwatches_final.csv")
n0 = len(df)

# 1. arnabchaki battery values are bucket midpoints, not real figures
df.loc[df["source"] == "kaggle_arnabchaki", "battery_days"] = np.nan

# 2. implausible display sizes are unit errors (mm/cm read as inches)
df.loc[~df["display_size_in"].between(0.9, 2.6), "display_size_in"] = np.nan

# 3. drop junk model names
names = df["name"].astype(str).str.strip()
low = names.str.lower()
junk = (
    names.str.match(r"^\d+(\.\d+)?[eE]\+\d+$")      # barcode in scientific notation
    | low.str.startswith("wrb-sw-")                  # Noise SKU codes
    | names.str.match(r"^GM-\d{3}-")                 # Garmin part numbers
    | low.str.endswith("-cr")                        # odd duplicate listing codes
)
df = df[~junk].copy()


# 4. flag discontinued lines (conservative list, extend it if you like)
def is_legacy(brand, name):
    b, n = str(brand).lower(), str(name).lower()
    if b == "samsung":
        return bool(re.match(r"(galaxy gear|gear|neo gear|t-mobile|r600)", n))
    if b == "fitbit":
        return bool(re.match(r"(surge|blaze|ionic|alta|charge hr|charge 2|flex)", n))
    if b == "apple":
        return bool(re.match(r"(series [123]\b|\d+ mm|\d - |nike\+|sport 42)", n))
    return False


df["legacy"] = [is_legacy(b, n) for b, n in zip(df["brand"], df["name"])]


# 5. rebuild retrieval text; missing specs say "not listed" so the bot can abstain
def make_doc(r):
    brand, name = str(r["brand"]), str(r["name"])
    title = name if name.lower().startswith(brand.lower()) else f"{brand} {name}"
    p = [f"{title} (smartwatch)", f"Price: Rs {int(r['price_inr']):,}"]
    if r["discount_pct"] > 0:
        p.append(f"Discount: {r['discount_pct']}%")
    if pd.notna(r["display"]):
        p.append(f"Display: {r['display']}")
    p.append(f"Display size: {r['display_size_in']:g} inches" if pd.notna(r["display_size_in"])
             else "Display size: not listed")
    p.append(f"Battery life: {r['battery_days']:g} days" if pd.notna(r["battery_days"])
             else "Battery life: not listed")
    for label, col in [("Touchscreen", "touchscreen"), ("Bluetooth", "bluetooth"), ("Strap", "strap_material")]:
        if pd.notna(r[col]):
            p.append(f"{label}: {r[col]}")
    if pd.notna(r["rating"]):
        p.append(f"Rating: {r['rating']}/5")
    return ". ".join(p)


df["document"] = df.apply(make_doc, axis=1)
df = df.sort_values(["brand", "name"]).reset_index(drop=True)
df["product_id"] = ["sw_" + str(i + 1).zfill(4) for i in range(len(df))]

cols = ["product_id", "category", "brand", "name", "price_inr", "original_price_inr", "discount_pct",
        "rating", "rating_count", "display", "display_size_in", "battery_days", "touchscreen",
        "bluetooth", "strap_material", "specs", "legacy", "document", "source"]
df[cols].to_csv(P / "smartwatches_final_v2.csv", index=False, encoding="utf-8-sig")

# 20 random current rows to check by hand against Flipkart
qa = df[~df["legacy"]].sample(20, random_state=7)
qa[["product_id", "brand", "name", "price_inr", "battery_days", "display_size_in", "source"]].to_csv(
    P / "smartwatches_qa_sample.csv", index=False, encoding="utf-8-sig")

print(f"rows: {n0} -> {len(df)} | legacy: {int(df['legacy'].sum())} | current: {int((~df['legacy']).sum())}")
print("battery filled:", round(df["battery_days"].notna().mean(), 2),
      "| display size filled:", round(df["display_size_in"].notna().mean(), 2))
print(df["display_size_in"].describe().round(2).to_dict())
print(df["document"].sample(3, random_state=3).to_string())