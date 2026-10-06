import pandas as pd

p = pd.read_csv("data/interim/phonedb_flat.csv")
k = pd.read_csv("data/interim/kaggle_clean.csv")

sp = p[(p["category"] == "Smartphone") & p["release_year"].between(2024, 2025)]
print("PhoneDB smartphone brands 2024-2025:\n", sp["brand"].value_counts().head(25))

for q in ["Magic7", "Magic6", "Mate 70", "Nova 13", "Hot 50", "Magic V3", "Mate X6"]:
    hit = p[p["model"].astype(str).str.contains(q, case=False, regex=False)
            | p["title"].astype(str).str.contains(q, case=False, regex=False)]
    print(f"\n== {q}: {len(hit)} hits")
    print(hit[["brand", "model", "category", "released"]].head(4).to_string())

tab = k["base_model"].str.contains(r"\bpad\b|matepad|magicpad|\btab\b", case=False, regex=True)
print("\ntablet-like rows in Kaggle:", tab.sum(), "of", len(k))
print("PhoneDB rows with missing release_year:", p["release_year"].isna().sum())
