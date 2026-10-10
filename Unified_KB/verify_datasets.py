import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Unified_KB"))
from currency import get_rates                                  # noqa: E402

name = "all_products_enriched.csv" if "enriched" in sys.argv else "all_products.csv"
df = pd.read_csv(ROOT / "Unified_KB" / name)
errs, warns = [], []
print("file:", name, "| rows per category:", df["category"].value_counts().to_dict())

print("\nmissing share (0 = fully filled, 1 = all empty):")
cols = ["price_inr", "rating", "ram_gb", "storage_gb", "screen_in", "battery_days", "image_url"]
print(df.groupby("category")[cols].agg(lambda s: round(s.isna().mean(), 2)).to_string())

# general integrity
if df["product_id"].duplicated().any(): errs.append("duplicate product_id")
if df["price_inr"].isna().any(): errs.append("rows with no price")
estimated = df["price_source"] != "dataset_inr"
no_label = estimated & ~df["description"].str.contains("estimate", case=False, na=False)
if no_label.any(): errs.append(f"{int(no_label.sum())} estimated prices not labelled in the description")

# laptops: recompute every conversion from the stored EUR price
raw = pd.read_csv(ROOT / "Laptop_Datasets/data/processed/laptops_kb.csv")
eur = raw[raw["price_basis"] == "converted_from_EUR"]
rate = get_rates()["EUR"]
expected = (eur["price_local"] * rate / 100).round() * 100
bad = int(((expected - eur["price_inr"]).abs() > 1).sum())
print(f"\nlaptops converted from EUR: {len(eur)} | rate {rate:.2f} | wrong conversions: {bad}")
if bad: errs.append(f"{bad} laptop prices do not match price_local x rate")
lp = df[df["category"] == "laptop"]
out = int((~lp["price_inr"].between(15000, 800000)).sum())
if out: warns.append(f"{out} laptops priced outside 15k-800k, check them")

# smartwatches
sw = df[df["category"] == "smartwatch"]
print(f"smartwatches with display size: {int(sw['screen_in'].notna().sum())} of {len(sw)}"
      f" | with battery: {int(sw['battery_days'].notna().sum())} of {len(sw)}")
if (sw["screen_in"].dropna().lt(0.9) | sw["screen_in"].dropna().gt(2.6)).any(): errs.append("watch screen outside 0.9-2.6 in")
if (sw["battery_days"].dropna().lt(0.5) | sw["battery_days"].dropna().gt(60)).any(): errs.append("watch battery outside 0.5-60 days")
if not sw["price_inr"].between(500, 150000).all(): errs.append("watch price outside 500-150000")

# phones
ph = df[df["category"] == "phone"]
if not ph["ram_gb"].dropna().between(1, 24).all(): errs.append("phone RAM outside 1-24 GB")
if not ph["price_inr"].between(3000, 300000).all(): warns.append("some phone prices outside 3k-300k")

for w in warns: print("WARN:", w)
print("\nRESULT:", "PASS" if not errs else "FAIL -> " + "; ".join(errs))