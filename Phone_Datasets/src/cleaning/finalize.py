import pandas as pd

df = pd.read_csv("data/processed/phones_merged.csv")

tab = df["base_model"].str.contains(r"pad|\btab\b", case=False, regex=True)
print("tablets dropped:", tab.sum())
df = df[~tab].copy()

yr = df["pdb_released"].astype(str).str.extract(r"(\d{4})")[0].astype(float)
bad = yr.notna() & (yr != df["launched_year"])
cols = [c for c in df.columns if c.startswith("pdb_")] + ["image_url", "display_type", "refresh_rate", "resolution"]
df.loc[bad, cols] = None
print("matches blanked for year mismatch:", bad.sum())

df["has_image"] = df["image_url"].notna()
df = df.reset_index(drop=True)
df.insert(0, "phone_id", range(1, len(df) + 1))
df.to_csv("data/processed/phones_final.csv", index=False, encoding="utf-8-sig")

print("\nfinal rows:", len(df), "| unique models:", df["base_model"].nunique())
print("rows with image:", int(df["has_image"].sum()))
print(df.groupby("brand")["has_image"].agg(["sum", "count"]).sort_values("count", ascending=False))
