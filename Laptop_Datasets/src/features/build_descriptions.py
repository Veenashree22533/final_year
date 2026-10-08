import pandas as pd

df = pd.read_csv("data/processed/laptops_final.csv")

def ok(x):
    return pd.notna(x) and str(x).strip() != ""

def desc(r):
    p = [f"{r['name']} is a laptop by {r['brand']}."]
    cpu = r["cpu_model"] if ok(r["cpu_model"]) else r["cpu"]
    if ok(cpu):
        g = f" (Intel generation {int(r['cpu_generation'])})" if ok(r["cpu_generation"]) else ""
        p.append(f"Processor: {cpu}{g}.")
    mem = []
    if ok(r["ram_gb"]): mem.append(f"{int(r['ram_gb'])} GB RAM")
    if ok(r["storage_gb"]):
        s = f"{int(r['storage_gb'])} GB"
        if ok(r["storage_type"]): s += f" {r['storage_type']}"
        mem.append(s + " storage")
    if mem: p.append("It has " + " and ".join(mem) + ".")
    if r["has_dedicated_gpu"] and ok(r["gpu_final"]):
        p.append(f"Dedicated graphics: {r['gpu_final']}.")
    if ok(r["screen_in"]):
        t = ", touchscreen" if r["touchscreen"] == True else ""
        p.append(f"The screen is {r['screen_in']:g} inches{t}.")
    if ok(r["price_inr"]):
        p.append(f"Approximate price: INR {int(r['price_inr']):,}.")
    elif ok(r["price_local"]):
        p.append(f"Listed price: {r['price_local']:.0f} {r['price_currency']}.")
    return " ".join(p)

df["description"] = df.apply(desc, axis=1)
df.to_csv("data/processed/laptops_kb.csv", index=False, encoding="utf-8-sig")
print(len(df), "rows")
for i in [0, 500, 1000]:
    print("\n", df.loc[i, "description"])
