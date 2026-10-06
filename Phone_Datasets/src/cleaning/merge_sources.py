import re
from pathlib import Path
import pandas as pd

K = Path("data/interim/kaggle_clean.csv")
P = Path("data/interim/phonedb_flat.csv")
OUT = Path("data/processed/phones_merged.csv")
REPORT = Path("data/interim/unmatched_kaggle.csv")

NOISE = {"5g","4g","3g","dual","sim","td-lte","lte","td","global","cn","in","eu","na","uk","us","jp","tw","version","edition"}
VARIANT = {"pro","plus","ultra","max","lite","fe","mini","se","neo","turbo","flip","fold","air","edge","gt",
           "prime","power","note","play","speed","racing","ace","master","zoom","stylus","fast"}
GROUP = {"poco": {"poco", "xiaomi"}, "redmi": {"redmi", "xiaomi"}, "xiaomi": {"xiaomi", "redmi", "poco"},
         "iqoo": {"iqoo", "vivo"}, "oneplus": {"oneplus", "oppo"}}

def tokens(s):
    s = str(s).lower().replace("+", " plus ")
    s = re.sub(r"\(.*?\)", " ", s)
    out = []
    for t in re.findall(r"[a-z0-9\-]+", s):
        if t in NOISE:
            continue
        if len(t) >= 7 and re.search(r"\d", t) and re.search(r"[a-z]", t):
            continue
        if re.fullmatch(r"\d+(gb|tb)", t):
            continue
        out.append(t)
    return out

k = pd.read_csv(K)
k["brand"] = k["brand"].str.strip().replace({"Poco": "POCO"})

p = pd.read_csv(P)
p = p[(p["category"] == "Smartphone") & p["release_year"].between(2023, 2025)].copy()
p["brand_l"] = p["brand"].astype(str).str.lower()
p["toks"] = p["model"].map(tokens)
p["has_india"] = p["countries"].astype(str).str.contains("India", case=False)
p["has_price"] = p["price"].notna()
p["has_img"] = p["img"].notna()

best = {}
unmatched = []
for (brand, base), _ in k.groupby(["brand", "base_model"]):
    kt = set(tokens(base))
    allowed = GROUP.get(brand.lower(), {brand.lower()})
    cands = p[p["brand_l"].isin(allowed)]
    scored = []
    for i, r in cands.iterrows():
        ps = set(r["toks"])
        if not kt or not kt <= ps:
            continue
        extra = ps - kt
        if extra & VARIANT:
            continue
        scored.append((len(extra), -int(r["has_india"]), -int(r["has_price"]), -int(r["has_img"]), i))
    if scored:
        best[(brand, base)] = min(scored)[-1]
    else:
        unmatched.append((brand, base))

rows = []
for (brand, base), idx in best.items():
    r = p.loc[idx]
    rows.append({"brand": brand, "base_model": base, "pdb_title": r["title"], "pdb_url": r["url"],
                 "image_url": r["img"], "pdb_price": r["price"], "pdb_currency": r["price_currency"],
                 "pdb_released": r["released"], "pdb_os": r["os"], "pdb_cpu": r["cpu"],
                 "display_type": r["display_type"], "refresh_rate": r["refresh_rate"],
                 "resolution": r["resolution"]})
m = pd.DataFrame(rows)

merged = k.merge(m, on=["brand", "base_model"], how="left")
OUT.parent.mkdir(parents=True, exist_ok=True)
merged.to_csv(OUT, index=False, encoding="utf-8-sig")
pd.DataFrame(unmatched, columns=["brand", "base_model"]).to_csv(REPORT, index=False)

total = k[["brand", "base_model"]].drop_duplicates().shape[0]
print(f"matched base models: {len(best)} / {total}")
print("rows with image:", merged["image_url"].notna().sum(), "/", len(merged))
print("\nsample matches (eyeball these):")
print(m[["brand", "base_model", "pdb_title"]].sample(min(12, len(m)), random_state=2).to_string())
print("\nunmatched (first 30):")
print(pd.DataFrame(unmatched, columns=["brand", "base_model"]).head(30).to_string())
