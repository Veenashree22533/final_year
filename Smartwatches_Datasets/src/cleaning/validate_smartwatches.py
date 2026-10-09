import pandas as pd

df = pd.read_csv("data/processed/smartwatches_final_v2.csv")
errs = []

if df["product_id"].duplicated().any(): errs.append("duplicate product_id")
if df["document"].isna().any(): errs.append("empty document")
if not df["price_inr"].between(500, 150000).all(): errs.append("price outside 500-150000")
if (df["original_price_inr"] < df["price_inr"]).any(): errs.append("MRP below price")
if not df["rating"].dropna().between(1, 5).all(): errs.append("rating outside 1-5")
if not df["display_size_in"].dropna().between(0.9, 2.6).all(): errs.append("display size out of range")
dup = df.duplicated(["brand", "name", "price_inr"]).sum()
if dup: errs.append(f"{dup} duplicate brand+name+price rows")

print("rows:", len(df), "| current:", int((~df['legacy']).sum()), "| brands:", df["brand"].nunique())
print("\nmissing share per column:")
print(df.isna().mean().round(2)[lambda s: s > 0].to_string())
print("\nprice by brand (median):")
print(df.groupby("brand")["price_inr"].median().sort_values().round(0).to_string())
print("\nRESULT:", "PASS" if not errs else "FAIL -> " + "; ".join(errs))