import json
from pathlib import Path
import pandas as pd

RAW = Path("data/raw/huggingface/PhoneSpecsDataset25K.json")

def load():
    text = RAW.read_text(encoding="utf-8")
    try:
        data = json.loads(text)                      # JSON array
    except json.JSONDecodeError:
        data = [json.loads(l) for l in text.splitlines() if l.strip()]  # JSON lines
    return data

if __name__ == "__main__":
    data = load()
    print("records:", len(data))
    first = data[0]
    print("\nkeys / sample values (truncated):")
    for k, v in first.items():
        print(f"  {k}: {str(v)[:100]}")
    df = pd.json_normalize(data[:500])
    print("\ncolumns:", list(df.columns))