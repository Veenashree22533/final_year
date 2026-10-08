from pathlib import Path
import pandas as pd

df = pd.read_csv("data/interim/laptops_clean.csv")
before = len(df)
df = df.dropna(subset=["price", "ram_gb", "storage_gb", "cpu"]).reset_index(drop=True)
print("dropped for missing core fields:", before - len(df))

df.insert(0, "laptop_id", range(1, len(df) + 1))
df["image_url"] = None
df["has_image"] = False

Path("data/processed").mkdir(parents=True, exist_ok=True)
df.to_csv("data/processed/laptops_final.csv", index=False, encoding="utf-8-sig")
print("final rows:", len(df))
print(df.head(5).T)
