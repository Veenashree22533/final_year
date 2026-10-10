import json
import random
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
random.seed(7)
df = pd.read_csv(HERE / "all_products.csv")
df["full"] = [n if n.lower().startswith(str(b).lower()) else f"{b} {n}" for b, n in zip(df["brand"], df["name"])]
uniq = df[~df["full"].str.lower().duplicated(keep=False)]     # only unambiguous names
rows = []


def add(kind, q, a, ids=""):
    rows.append({"type": kind, "question": q, "expected_answer": a, "product_ids": ids})


def pick(cat, n, ok=None):
    s = uniq[uniq["category"] == cat]
    if ok is not None:
        s = s[ok(s)]
    return s.sample(min(n, len(s)), random_state=7)


for _, r in pick("phone", 8).iterrows():
    add("spec_lookup", f"What is the price of the {r['full']}?", f"INR {r['price_inr']:,.0f}", r["product_id"])
for _, r in pick("phone", 8, lambda s: s["ram_gb"].notna()).iterrows():
    add("spec_lookup", f"How much RAM does the {r['full']} have?", f"{r['ram_gb']:g} GB", r["product_id"])
for _, r in pick("laptop", 8, lambda s: s["storage_gb"].notna()).iterrows():
    add("spec_lookup", f"How much storage does the {r['full']} have?", f"{r['storage_gb']:g} GB", r["product_id"])
for _, r in pick("smartwatch", 10).iterrows():
    add("spec_lookup", f"What is the price of the {r['full']}?", f"INR {r['price_inr']:,.0f}", r["product_id"])

for _, r in pick("laptop", 5, lambda s: s["price_source"] != "dataset_inr").iterrows():
    add("estimate_honesty", f"How much does the {r['full']} cost in rupees?",
        f"about INR {r['price_inr']:,.0f}, and the answer must say it is an estimate", r["product_id"])

sw = df[df["category"] == "smartwatch"]
big = sw.groupby("brand").filter(lambda g: len(g) >= 5)
for b in random.sample(sorted(big["brand"].unique()), 5):
    r = big[big["brand"] == b].nsmallest(1, "price_inr").iloc[0]
    add("filtered_search", f"What is the cheapest {b} smartwatch?",
        f"{r['full']} at INR {r['price_inr']:,.0f} (ties possible)", r["product_id"])

ph = df[df["category"] == "phone"]
for ram, cap in [(6, 30000), (8, 40000), (8, 60000), (12, 80000), (12, 100000)]:
    n = int(((ph["ram_gb"] >= ram) & (ph["price_inr"] <= cap)).sum())
    add("filtered_search", f"Show me phones with at least {ram} GB RAM under INR {cap:,}.",
        f"Every result must have ram_gb>={ram} and price<={cap}. {n} matching phones exist.")

for _, r in pick("smartwatch", 8, lambda s: s["battery_days"].isna()).iterrows():
    add("not_listed", f"What is the battery life of the {r['full']}?",
        "not listed in the catalog (must not invent a number)", r["product_id"])

names = " ".join(df["full"].str.lower())
for f in ["Samsung Galaxy Z Flux 9", "Apple iPhone 19 Pro", "OnePlus Nova X Ultra", "Dell Inspiron X9000 Pro",
          "Lenovo ThinkPad Zeta 15", "Apple Watch Ultra 9", "Garmin Fenix 12 Solar",
          "Noise ColorFit Quantum 5", "boAt Wave Titan Max", "HP Spectre Z Fold 3"]:
    if f.lower() not in names:
        add("not_in_catalog", f"Tell me the price and specs of the {f}.", "not in the catalog")

for q in ["Do you have DSLR cameras?", "Show me wireless headphones under INR 3000.", "Which gaming consoles do you sell?"]:
    add("not_in_catalog", q, "not in the catalog: only phones, laptops and smartwatches")

out = pd.DataFrame(rows)
out.insert(0, "qid", [f"Q{i + 1:03d}" for i in range(len(out))])
out.to_csv(HERE / "eval_questions.csv", index=False, encoding="utf-8-sig")
print(len(out), "questions\n", out["type"].value_counts().to_string())