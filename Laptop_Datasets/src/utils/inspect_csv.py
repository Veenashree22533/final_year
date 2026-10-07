import sys
import pandas as pd

path = sys.argv[1]
try:
    df = pd.read_csv(path, encoding="utf-8")
except UnicodeDecodeError:
    df = pd.read_csv(path, encoding="latin-1")

print("shape:", df.shape)
print("columns:", df.columns.tolist())
print("\nfirst rows:\n", df.head(3).T)

for c in df.columns:
    cl = c.lower()
    if "cpu" in cl or "processor" in cl:
        print(f"\n{c} sample:\n", df[c].astype(str).sample(min(8, len(df)), random_state=1).to_string())
        break

for c in df.columns:
    if "price" in c.lower():
        s = pd.to_numeric(df[c].astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce")
        print(f"\n{c} range: min={s.min()}, median={s.median()}, max={s.max()}")
        break
