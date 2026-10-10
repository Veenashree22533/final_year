import re
from pathlib import Path

import numpy as np
import pandas as pd

F = Path(__file__).resolve().parent / "all_products.csv"
MIN_SIMILAR = 3
LEVELS = {                      # most specific match first
    "phone": [["brand", "ram_gb", "storage_gb"], ["ram_gb", "storage_gb"], ["ram_gb"]],
    "laptop": [["brand", "ram_gb", "storage_gb"], ["ram_gb", "storage_gb"], ["ram_gb"]],
    "smartwatch": [["brand"]],
}

df = pd.read_csv(F)
old = df["price_source"] == "imputed_from_similar"          # rerun-safe
df.loc[old, "price_inr"] = np.nan
df.loc[old, "description"] = df.loc[old, "description"].str.replace(
    r"\s*Price not listed.*$", "", regex=True, flags=re.S)

for cat, levels in LEVELS.items():
    for keys in levels:
        sub = df["category"] == cat
        need = sub & df["price_inr"].isna()
        if not need.any():
            break
        g = (df[sub & df["price_inr"].notna()].groupby(keys)
             .agg(med=("price_inr", "median"), n=("price_inr", "size")).reset_index())
        m = df.loc[need, keys].reset_index().merge(g, on=keys, how="left").set_index("index")
        ok = m[m["n"] >= MIN_SIMILAR].copy()
        ok["p"] = (ok["med"] / 100).round() * 100
        df.loc[ok.index, "price_inr"] = ok["p"]
        df.loc[ok.index, "price_source"] = "imputed_from_similar"
        df.loc[ok.index, "description"] = (
            df.loc[ok.index, "description"]
            + " Price not listed in the source data. Estimated price: about INR "
            + ok["p"].map("{:,.0f}".format)
            + " (median of similar products; estimate only).")

df.to_csv(F, index=False, encoding="utf-8-sig")
print(df.groupby(["category", "price_source"]).size().to_string())
print("still missing a price:", int(df["price_inr"].isna().sum()))