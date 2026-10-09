import re
import json
from pathlib import Path

import numpy as np
import pandas as pd

RAW = Path("data/raw/kaggle")
INTERIM = Path("data/interim")
PROCESSED = Path("data/processed")
INTERIM.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)

ARNAB = RAW / "arnabchaki_fitness_trackers" / "smartwatches.csv"
DEV = RAW / "devsubhash_fitness_trackers" / "Fitness_trackers_updated.csv"
if not DEV.exists():
    DEV = RAW / "devsubhash_fitness_trackers" / "Fitness_trackers.csv"


def norm_cols(df):
    df = df.copy()
    df.columns = [re.sub(r"[^a-z0-9]+", "_", str(c).strip().lower()).strip("_") for c in df.columns]
    return df


def to_num(s):
    return pd.to_numeric(s.astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce")


def pick(df, *names):
    for n in names:
        if n in df.columns:
            return n
    return None


def standardize(df, source):
    df = norm_cols(df)
    df = df.loc[:, ~df.columns.str.startswith("unnamed")]
    c = {
        "brand": pick(df, "brand", "brand_name"),
        "name": pick(df, "model_name", "name", "title"),
        "price": pick(df, "current_price", "selling_price", "price"),
        "original_price": pick(df, "original_price", "mrp"),
        "rating": pick(df, "rating", "rating_out_of_5"),
        "rating_count": pick(df, "number_of_ratings", "rating_count"),
        "display": pick(df, "display", "display_type"),
        "device_type": pick(df, "device_type"),
    }

    def get(k):
        return df[c[k]] if c[k] else pd.Series(np.nan, index=df.index)

    out = pd.DataFrame({
        "brand": get("brand").astype("string").str.strip(),
        "name": get("name").astype("string").str.strip(),
        "price_inr": to_num(get("price")),
        "original_price_inr": to_num(get("original_price")),
        "rating": to_num(get("rating")),
        "rating_count": to_num(get("rating_count")),
        "display": get("display").astype("string").str.strip(),
        "source": source,
    })

    used = [v for v in c.values() if v]
    extra = df.drop(columns=used).drop(columns=["discount_percentage"], errors="ignore")

    # keep smartwatches only (devsubhash mixes in fitness bands)
    if c["device_type"]:
        keep = df[c["device_type"]].astype(str).str.contains("smart", case=False, na=False)
        out, extra = out[keep], extra[keep]

    # everything else becomes a specs dict; missing values are left out, never guessed
    out["specs"] = extra.apply(
        lambda r: {k: v for k, v in r.items() if pd.notna(v) and str(v).strip().lower() not in ("", "nan")},
        axis=1,
    )
    return out


a = standardize(pd.read_csv(ARNAB), "kaggle_arnabchaki")
d = standardize(pd.read_csv(DEV), "kaggle_devsubhash")
a.to_csv(INTERIM / "smartwatches_arnabchaki_std.csv", index=False)
d.to_csv(INTERIM / "smartwatches_devsubhash_std.csv", index=False)

df = pd.concat([a, d], ignore_index=True)
print("rows after concat:", len(df))

# drop unusable rows
df = df.dropna(subset=["name", "price_inr"])
df = df[df["price_inr"] > 0]

# dedupe (same brand + model + price = same product listing, e.g. colour variants)
df["_key"] = (
    df["brand"].fillna("").str.lower() + "|" + df["name"].str.lower() + "|" + df["price_inr"].astype(str)
)
df = df.sort_values("rating_count", ascending=False, na_position="last")
df = df.drop_duplicates("_key").drop(columns="_key").reset_index(drop=True)

# derived fields
has_disc = df["original_price_inr"] > df["price_inr"]
df["discount_pct"] = np.where(
    has_disc, ((df["original_price_inr"] - df["price_inr"]) / df["original_price_inr"] * 100).round(1), 0.0
)
df["category"] = "smartwatch"
df["product_id"] = ["sw_" + str(i + 1).zfill(4) for i in range(len(df))]


def make_doc(r):
    parts = [f"{(r['brand'] if pd.notna(r['brand']) else '').strip()} {r['name']} (smartwatch)".strip()]
    parts.append(f"Price: Rs {int(r['price_inr']):,}")
    if r["discount_pct"] > 0:
        parts.append(f"Discount: {r['discount_pct']}%")
    if pd.notna(r["display"]):
        parts.append(f"Display: {r['display']}")
    if pd.notna(r["rating"]):
        parts.append(f"Rating: {r['rating']}/5")
    for k, v in r["specs"].items():
        parts.append(f"{k.replace('_', ' ').title()}: {v}")
    return ". ".join(parts)


df["document"] = df.apply(make_doc, axis=1)
df["specs"] = df["specs"].apply(lambda s: json.dumps(s, ensure_ascii=False, default=str))

cols = ["product_id", "category", "brand", "name", "price_inr", "original_price_inr", "discount_pct",
        "rating", "rating_count", "display", "specs", "document", "source"]
df = df[cols]
df.to_csv(PROCESSED / "smartwatches_clean.csv", index=False, encoding="utf-8-sig")

print("final rows:", len(df))
print(df["brand"].value_counts().head(10))
print(df["price_inr"].describe())
print("missing:", df.isna().sum()[df.isna().sum() > 0].to_dict())
print(df["document"].iloc[0])