import re
from pathlib import Path
import pandas as pd

RAW = Path("data/raw/kaggle/Mobiles Dataset (2025).csv")
OUT = Path("data/interim/kaggle_clean.csv")

df = pd.read_csv(RAW, encoding="latin-1")
df.columns = ["brand", "model_name", "weight", "ram", "front_camera", "back_camera",
              "processor", "battery", "screen", "price_pkr", "price_inr", "price_cny",
              "price_usd", "price_aed", "launched_year"]

df = df.drop_duplicates().copy()
for c in ["brand", "model_name", "processor"]:
    df[c] = df[c].astype(str).str.strip()

def first_num(s):
    m = re.search(r"\d+(?:\.\d+)?", str(s).replace(",", ""))
    return float(m.group()) if m else None

def n_nums(s):
    return len(re.findall(r"\d+(?:\.\d+)?", str(s).replace(",", "")))

multi = {}
for raw, new in [("weight", "weight_g"), ("ram", "ram_gb"), ("front_camera", "front_mp"),
                 ("back_camera", "back_mp"), ("battery", "battery_mah"), ("screen", "screen_in")]:
    multi[raw] = int((df[raw].map(n_nums) > 1).sum())
    df[new] = df[raw].map(first_num)

for c in ["price_pkr", "price_inr", "price_cny", "price_usd", "price_aed"]:
    df[c] = df[c].map(first_num)

def parse_storage(name):
    ms = re.findall(r"(\d+)\s?(GB|TB)", name, flags=re.I)
    if not ms:
        return None
    n, u = ms[-1]
    return int(n) * (1024 if u.upper() == "TB" else 1)

df["storage_gb"] = df["model_name"].map(parse_storage)
df["base_model"] = (df["model_name"]
                    .str.replace(r"\s?\d+\s?(GB|TB)", "", regex=True, flags=re.I)
                    .str.replace(r"\s+", " ", regex=True).str.strip())
df["launched_year"] = pd.to_numeric(df["launched_year"], errors="coerce")

df = df[df["launched_year"].isin([2024, 2025])].reset_index(drop=True)
OUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUT, index=False, encoding="utf-8-sig")

print("rows after 2024-2025 filter:", len(df))
print("unique base models:", df["base_model"].nunique())
print("\nfields with multiple numbers in raw text (all years):", multi)
print("\nnulls:\n", df[["ram_gb", "battery_mah", "screen_in", "storage_gb", "price_usd", "price_inr"]].isna().sum())
print("\nbrands:\n", df["brand"].value_counts())
print("\nsample:\n", df[["brand", "base_model", "storage_gb", "ram_gb", "battery_mah", "price_inr"]].sample(8, random_state=1))
