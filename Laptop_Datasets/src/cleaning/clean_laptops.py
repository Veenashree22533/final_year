import re
from pathlib import Path
import pandas as pd

RAW = Path("data/raw/huggingface/santhosh_laptops.csv")
OUT = Path("data/interim/laptops_clean.csv")

PRICE_CURRENCY = "USD"   # CHECK against the printed price range, change to "INR" or "EUR" if wrong
USD_TO_INR = None        # set a rate (e.g. 85) to get an approximate price_inr when currency is USD

df = pd.read_csv(RAW)
df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
print("raw shape:", df.shape)
print("columns:", df.columns.tolist())

ren = {"final_price": "price", "screen": "screen_in", "touch": "touchscreen"}
df = df.rename(columns={k: v for k, v in ren.items() if k in df.columns})

need = ["brand", "model", "cpu", "ram", "storage", "price"]
missing = [c for c in need if c not in df.columns]
if missing:
    raise SystemExit(f"Missing expected columns {missing}. Paste the columns list here.")

for c in ["gpu", "storage_type", "touchscreen", "status", "laptop", "screen_in"]:
    if c not in df.columns:
        df[c] = None

# keep new laptops only (if the dataset has a New/Refurbished status)
st = df["status"].astype(str).str.lower()
if st.eq("new").any():
    print("status counts:\n", df["status"].value_counts())
    df = df[st.eq("new")].copy()

def num(s):
    m = re.search(r"\d+(?:\.\d+)?", str(s).replace(",", ""))
    return float(m.group()) if m else None

def to_gb(s):
    m = re.search(r"(\d+(?:\.\d+)?)\s*(tb|gb)?", str(s).lower().replace(",", ""))
    if not m:
        return None
    v = float(m.group(1))
    return v * 1024 if m.group(2) == "tb" else v

df["ram_gb"] = df["ram"].map(to_gb)
df["storage_gb"] = df["storage"].map(to_gb)
df["screen_in"] = df["screen_in"].map(num)

df["price"] = pd.to_numeric(df["price"].astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce")
df["price_currency"] = PRICE_CURRENCY
if PRICE_CURRENCY == "INR":
    df["price_inr"] = df["price"]
elif PRICE_CURRENCY == "USD" and USD_TO_INR:
    df["price_inr"] = (df["price"] * USD_TO_INR).round(-2)
else:
    df["price_inr"] = None

FIX = {"Hp": "HP", "Msi": "MSI", "Lg": "LG", "Asus": "ASUS"}
df["brand"] = df["brand"].astype(str).str.strip().str.title().replace(FIX)
df["model"] = df["model"].astype(str).str.strip()

def cpu_brand(s):
    s = str(s).lower()
    if "apple" in s or re.search(r"\bm\d\b", s):
        return "Apple"
    if "intel" in s or "core" in s or "celeron" in s or "pentium" in s:
        return "Intel"
    if "amd" in s or "ryzen" in s or "athlon" in s:
        return "AMD"
    if "snapdragon" in s or "qualcomm" in s:
        return "Qualcomm"
    return None

def cpu_family(s):
    m = re.search(r"(core\s*ultra\s*\d|core\s*i\d|ryzen\s*(?:ai\s*)?\d|celeron|pentium|athlon|snapdragon|apple\s*m\d\w*)", str(s), re.I)
    return re.sub(r"\s+", " ", m.group(1)).title() if m else None

df["cpu_brand"] = df["cpu"].map(cpu_brand)
df["cpu_family"] = df["cpu"].map(cpu_family)

DEDICATED = r"rtx|gtx|geforce|radeon\s*rx|radeon\s*pro|quadro|\barc\s*a|\bmx\s?\d"
df["has_dedicated_gpu"] = df["gpu"].astype(str).str.lower().str.contains(DEDICATED, regex=True)

df["touchscreen"] = df["touchscreen"].astype(str).str.lower().map(
    {"yes": True, "true": True, "1": True, "1.0": True, "no": False, "false": False, "0": False, "0.0": False})

df["name"] = df["laptop"].where(df["laptop"].notna(), df["brand"] + " " + df["model"])

key = ["brand", "model", "cpu", "ram_gb", "storage_gb", "gpu", "screen_in", "price"]
before = len(df)
df = df.drop_duplicates(subset=key).reset_index(drop=True)
print("duplicates removed:", before - len(df))

cols = ["name", "brand", "model", "cpu", "cpu_brand", "cpu_family", "ram_gb", "storage_gb", "storage_type",
        "gpu", "has_dedicated_gpu", "screen_in", "touchscreen", "price", "price_currency", "price_inr"]
OUT.parent.mkdir(parents=True, exist_ok=True)
df[cols].to_csv(OUT, index=False, encoding="utf-8-sig")

print("\nrows:", len(df))
print("\nPRICE RANGE (check the currency!):\n", df["price"].describe())
print("\nnulls:\n", df[["cpu_family", "ram_gb", "storage_gb", "screen_in", "price"]].isna().sum())
print("\nbrands:\n", df["brand"].value_counts().head(12))
print("\ncpu families:\n", df["cpu_family"].value_counts(dropna=False).head(12))
print("\nsample:\n", df[["name", "cpu_family", "ram_gb", "storage_gb", "price"]].sample(8, random_state=1).to_string())
