import re
from pathlib import Path

import numpy as np
import pandas as pd

P = Path(__file__).resolve().parents[2] / "data" / "processed"
MIN_SIMILAR = 3
# brands that sell the same line in several case sizes: never guess their display size
NO_DISPLAY_GUESS = {"Apple", "Fitbit", "Amazfit", "Garmin", "Samsung", "Fossil", "Huawei", "Honor"}

df = pd.read_csv(P / "smartwatches_kb.csv")             # always starts from the verified file
n0 = {"display": int(df["display_size_in"].notna().sum()), "battery": int(df["battery_days"].notna().sum())}

df["display_size_source"] = np.where(df["display_size_in"].notna(), "dataset", "missing")
df["battery_source"] = np.where(df["battery_days"].notna(), "dataset", "missing")

SIZE = re.compile(r"(\d\.\d{1,2})\s*(?:inch|in\b|\"|''|”|“)", re.I)
DAYS = re.compile(r"(\d{1,2})\s*[- ]?\s*days?", re.I)


def size_from_name(n):
    m = SIZE.search(str(n))
    v = float(m.group(1)) if m else np.nan
    return v if 0.9 <= v <= 2.6 else np.nan


def battery_from_name(n):
    s = str(n).lower()
    m = DAYS.search(s) if "batter" in s else None
    v = float(m.group(1)) if m else np.nan
    return v if 1 <= v <= 60 else np.nan


# step 1: extract real values from the title
for col, src, fn in [("display_size_in", "display_size_source", size_from_name),
                     ("battery_days", "battery_source", battery_from_name)]:
    ext = df["model_name"].apply(fn)
    m = df[col].isna() & ext.notna()
    df.loc[m, col] = ext[m]
    df.loc[m, src] = "extracted_from_title"

# step 2: brand median, only for tightly clustered brands, never for multi-size brands (display)
for col, src, nd in [("display_size_in", "display_size_source", 1), ("battery_days", "battery_source", 0)]:
    g = df[df[col].notna()].groupby("brand")[col].agg(
        med="median", n="size", q1=lambda s: s.quantile(0.25), q3=lambda s: s.quantile(0.75))
    ok = g[(g["n"] >= MIN_SIMILAR) & ((g["q3"] - g["q1"]) <= 0.25 * g["med"])]
    if col == "display_size_in":
        ok = ok[~ok.index.isin(NO_DISPLAY_GUESS)]
    fill = df.loc[df[col].isna(), "brand"].map(ok["med"]).dropna()
    df.loc[fill.index, col] = fill.round(nd)
    df.loc[fill.index, src] = "imputed_brand_median"

df["screen_in"] = df["display_size_in"]

TAG = {"extracted_from_title": "from the product title",
       "imputed_brand_median": "estimate based on similar watches from this brand"}


def fix(r):
    d = str(r["description"])
    for label, unit, col, src in [("Display size", "inches", "display_size_in", "display_size_source"),
                                  ("Battery life", "days", "battery_days", "battery_source")]:
        tag = TAG.get(r[src])
        if tag:
            d = re.sub(rf"{label}: (?:not listed|[\d.]+ {unit})\.", f"{label}: {r[col]:g} {unit} ({tag}).", d, count=1)
    return d


df["description"] = df.apply(fix, axis=1)
df.to_csv(P / "smartwatches_kb_enriched.csv", index=False, encoding="utf-8-sig")

print(f"display size: {n0['display']} -> {int(df['display_size_in'].notna().sum())} of {len(df)}")
print(f"battery days: {n0['battery']} -> {int(df['battery_days'].notna().sum())} of {len(df)}")
print("\ndisplay-size estimates by brand:")
print(df[df["display_size_source"] == "imputed_brand_median"].groupby("brand").size().to_string())