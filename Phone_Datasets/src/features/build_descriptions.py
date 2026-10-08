import pandas as pd

df = pd.read_csv("data/processed/phones_final.csv")

def ok(x):
    return pd.notna(x) and str(x).strip() != ""

def desc(r):
    p = [f"{r['model_name']} by {r['brand']} is a smartphone launched in {int(r['launched_year'])}."]
    mem = []
    if ok(r["ram_gb"]): mem.append(f"{int(r['ram_gb'])} GB RAM")
    if ok(r["storage_gb"]): mem.append(f"{int(r['storage_gb'])} GB storage")
    if mem: p.append("It has " + " and ".join(mem) + ".")
    if ok(r["processor"]): p.append(f"Processor: {r['processor']}.")
    if ok(r["screen_in"]):
        extra = " ".join(str(r[c]) for c in ["display_type", "refresh_rate"] if ok(r[c]))
        p.append(f"The screen is {r['screen_in']:g} inches" + (f" ({extra})." if extra else "."))
    if ok(r["battery_mah"]): p.append(f"Battery: {int(r['battery_mah'])} mAh.")
    cams = []
    if ok(r["back_camera"]): cams.append(f"rear {r['back_camera']}")
    if ok(r["front_camera"]): cams.append(f"front {r['front_camera']}")
    if cams: p.append("Cameras: " + ", ".join(cams) + ".")
    if ok(r["weight_g"]): p.append(f"Weight: {r['weight_g']:g} g.")
    if ok(r["price_inr"]): p.append(f"Launch price: INR {int(r['price_inr']):,}.")
    return " ".join(p)

df["description"] = df.apply(desc, axis=1)
df.to_csv("data/processed/phones_kb.csv", index=False, encoding="utf-8-sig")
print(len(df), "rows")
for i in [0, 100, 200]:
    print("\n", df.loc[i, "description"])
