import re
from pathlib import Path
import pandas as pd

P = Path("data/processed/laptops_final.csv")
df = pd.read_csv(P)

# --- set after checking the dataset card ---
CURRENCY = "EUR"        # change if the card says otherwise
RATE_TO_INR = None      # fill with a current rate to get an approximate price_inr

CPU_RE = re.compile(r"(i[3579]-\d{4,5}[A-Z0-9]{0,3}|Ryzen\s?[3579]\s?\d{4}[A-Z0-9]{0,3}|Core Ultra\s?\d\s?\d{3}[A-Z]?|Apple M\d(?:\s?(?:Pro|Max|Ultra))?|Celeron\s?[A-Z]?\d{3,4}|\bN\d{4}\b)", re.I)
GPU_RE = re.compile(r"(RTX\s?\d{4}(?:\s?Ti|\s?Super)?|GTX\s?\d{3,4}(?:\s?Ti)?|Radeon\s?RX\s?\d{4}[A-Z]*|\bRX\s?\d{4}[A-Z]*|Arc\s?A\d{3}[A-Z]?|\bMX\s?\d{3})", re.I)

def find(rx, s):
    m = rx.search(str(s))
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None

def intel_gen(model):
    m = re.match(r"i[3579]-(\d{4,5})", str(model), re.I)
    if not m:
        return None
    d = m.group(1)
    if len(d) == 5:
        return int(d[:2])
    return int(d[:2]) if 10 <= int(d[:2]) <= 14 else int(d[0])

df["cpu_model"] = df["name"].map(lambda s: find(CPU_RE, s))
df["cpu_generation"] = df["cpu_model"].map(intel_gen)
df["cpu_family"] = df["cpu_family"].astype(str).str.replace("Core I", "Core i", regex=False).replace("nan", None)

gpu_name = df["name"].map(lambda s: find(GPU_RE, s))
df["gpu_final"] = df["gpu"].where(df["gpu"].notna(), gpu_name)
df["has_dedicated_gpu"] = df["gpu_final"].notna()   # False means integrated/unknown, not confirmed integrated

df["price_local"] = df["price"]
df["price_currency"] = CURRENCY
df["price_inr"] = (df["price"] * RATE_TO_INR).round(-2) if RATE_TO_INR else None
df = df.drop(columns=["price"])

df.to_csv(P, index=False, encoding="utf-8-sig")
print("rows:", len(df))
print("cpu_model parsed:", df["cpu_model"].notna().sum())
print("\nintel generation:\n", df["cpu_generation"].value_counts().sort_index())
print("\nwith dedicated GPU:", int(df["has_dedicated_gpu"].sum()))
print(df[["name", "cpu_model", "cpu_generation", "gpu_final"]].sample(8, random_state=3).to_string())
