import glob
import pandas as pd

for f in sorted(glob.glob("data/raw/kaggle/*/*.csv")):
    df = pd.read_csv(f)
    print("=" * 80)
    print(f, df.shape)
    print(list(df.columns))
    print(df.head(3).to_string())
    na = df.isna().sum()
    print("missing:", na[na > 0].to_dict())