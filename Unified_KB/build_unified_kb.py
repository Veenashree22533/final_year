import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]          # final_year
OUT = ROOT / "Unified_KB"
OUT.mkdir(exist_ok=True)
ENRICHED = "enriched" in sys.argv


def col(df, name):
    return df[name] if name in df.columns else pd.Series(np.nan, index=df.index)


def clean(v):
    return v.item() if isinstance(v, np.generic) else v


def pack(df, cols):
    cols = [c for c in cols if c in df.columns]
    return df[cols].apply(
        lambda r: json.dumps({k: clean(v) for k, v in r.items() if pd.notna(v)},
                             ensure_ascii=False, default=str), axis=1)


def ids(series, prefix):
    return prefix + pd.to_numeric(series).astype("Int64").astype(str).str.zfill(4)


# ---------------- phones
ph = pd.read_csv(ROOT / "Phone_Datasets/data/processed/phones_kb.csv")
phones = pd.DataFrame({
    "product_id": ids(ph["phone_id"], "ph_"),
    "category": "phone", "brand": ph["brand"], "name": ph["model_name"],
    "price_inr": col(ph, "price_inr"),
    "price_source": np.where(col(ph, "price_inr").notna(), "dataset_inr", "missing"),
    "rating": np.nan, "launched_year": col(ph, "launched_year"),
    "ram_gb": col(ph, "ram_gb"), "storage_gb": col(ph, "storage_gb"),
    "screen_in": col(ph, "screen_in"), "battery_mah": col(ph, "battery_mah"), "battery_days": np.nan,
    "image_url": col(ph, "image_url"), "has_image": col(ph, "has_image"),
    "description": ph["description"],
    "specs_json": pack(ph, ["processor", "front_mp", "back_mp", "weight_g", "display_type",
                            "refresh_rate", "resolution", "pdb_os"]),
})

# ---------------- laptops
lp = pd.read_csv(ROOT / "Laptop_Datasets/data/processed/laptops_kb.csv")
if "price_basis" in lp.columns:
    lp_src = lp["price_basis"]
else:
    est = col(lp, "price_inr_is_estimate").fillna(False).astype(bool)
    lp_src = pd.Series(np.where(lp["price_inr"].isna(), "missing",
                                np.where(est, "converted_estimate", "dataset_inr")), index=lp.index)
laptops = pd.DataFrame({
    "product_id": ids(lp["laptop_id"], "lp_"),
    "category": "laptop", "brand": lp["brand"], "name": lp["name"],
    "price_inr": col(lp, "price_inr"), "price_source": lp_src,
    "rating": np.nan, "launched_year": np.nan,
    "ram_gb": col(lp, "ram_gb"), "storage_gb": col(lp, "storage_gb"),
    "screen_in": col(lp, "screen_in"), "battery_mah": np.nan, "battery_days": np.nan,
    "image_url": col(lp, "image_url"), "has_image": col(lp, "has_image"),
    "description": lp["description"],
    "specs_json": pack(lp, ["cpu_model", "cpu_generation", "storage_type", "gpu_final",
                            "touchscreen", "price_local", "price_currency"]),
})

# ---------------- smartwatches (verified file by default, enriched file with the 'enriched' argument)
sw_name = "smartwatches_kb_enriched.csv" if ENRICHED else "smartwatches_kb.csv"
sw = pd.read_csv(ROOT / "Smartwatches_Datasets/data/processed" / sw_name)
sw_screen = sw["screen_in"] if "screen_in" in sw.columns else col(sw, "display_size_in")
watches = pd.DataFrame({
    "product_id": ids(sw["watch_id"], "sw_"),
    "category": "smartwatch", "brand": sw["brand"], "name": sw["model_name"],
    "price_inr": sw["price_inr"], "price_source": "dataset_inr",
    "rating": col(sw, "rating"), "launched_year": np.nan,
    "ram_gb": np.nan, "storage_gb": np.nan, "screen_in": sw_screen,
    "battery_mah": np.nan, "battery_days": col(sw, "battery_days"),
    "image_url": col(sw, "image_url"), "has_image": col(sw, "has_image"),
    "description": sw["description"],
    "specs_json": pack(sw, ["display_type", "touchscreen", "bluetooth", "strap_material",
                            "dial_shape", "legacy", "display_size_source", "battery_source"]),
})

# ---------------- combine and check
allp = pd.concat([phones, laptops, watches], ignore_index=True)
assert allp["product_id"].is_unique, "duplicate product_id"
assert allp["description"].notna().all(), "empty description"
out_name = "all_products_enriched.csv" if ENRICHED else "all_products.csv"
allp.to_csv(OUT / out_name, index=False, encoding="utf-8-sig")

print("wrote", out_name, "| smartwatch source:", sw_name)
print("rows per category:", allp["category"].value_counts().to_dict())
print("\nshare of rows with a value:")
print(allp.groupby("category").agg(
    price_inr=("price_inr", lambda s: round(s.notna().mean(), 2)),
    image=("image_url", lambda s: round(s.notna().mean(), 2)),
    ram=("ram_gb", lambda s: round(s.notna().mean(), 2)),
    screen=("screen_in", lambda s: round(s.notna().mean(), 2)),
    battery_days=("battery_days", lambda s: round(s.notna().mean(), 2))).to_string())
print("\nprice source:")
print(allp.groupby(["category", "price_source"]).size().to_string())