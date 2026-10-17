import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]          # final_year
sys.path.insert(0, str(ROOT / "Unified_KB"))
from currency import get_rates                      # noqa: E402

P = Path(__file__).resolve().parents[2] / "data" / "processed"
RATES = get_rates()


def convert(df):
    df = df.copy()
    if "price_inr_is_estimate" in df.columns:        # rerun-safe: drop old estimates
        df.loc[df["price_inr_is_estimate"] == True, "price_inr"] = np.nan

    cur = df["price_currency"].astype(object).str.upper()
    rate = cur.map(RATES).astype(float)              # INR per 1 unit, NaN if unknown
    est = (df["price_local"] * rate / 100).round() * 100
    real = df["price_inr"].notna()
    use = (~real) & est.notna()

    df["price_eur"] = np.where(cur.eq("EUR"), df["price_local"], np.nan)
    df["price_inr"] = df["price_inr"].where(real, est)
    df["price_inr_is_estimate"] = use
    df["price_basis"] = np.where(real, "dataset_inr",
                                 np.where(use, "converted_from_" + cur.fillna("").astype(str), "missing"))
    return df


def new_desc(r):
    d = str(r["description"])
    if str(r["price_basis"]).startswith("converted_from_"):
        c = r["price_basis"].split("_")[-1]
        d = re.sub(r"\s*Listed price.*$", "", d, flags=re.S)
        d += (f" Listed price: {r['price_local']:,.0f} {c} (original currency). "
              f"Approximate price in INR: about {r['price_inr']:,.0f} "
              f"(estimate, converted at 1 {c} = {RATES[c]:.2f} INR; actual Indian price may differ).")
    return d


for name in ["laptops_final.csv", "laptops_kb.csv"]:
    df = convert(pd.read_csv(P / name))
    if "description" in df.columns:
        df["description"] = df.apply(new_desc, axis=1)
    df.to_csv(P / name, index=False, encoding="utf-8-sig")
    print(name, df["price_basis"].value_counts().to_dict())
print("rates used:", {k: round(v, 2) for k, v in RATES.items() if v})