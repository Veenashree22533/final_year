import json
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "rates_cache.json"

# INR per 1 unit. EUR ~110 in Jul-Aug 2026. Others are None until the live fetch fills
# them; a missing rate gives a missing price, never a guessed one.
FALLBACK = {"INR": 1.0, "EUR": 110.0, "USD": None, "GBP": None, "CNY": None, "AED": None, "PKR": None}
MANUAL = {}              # set rates by hand if offline, e.g. {"PKR": 0.33}
AED_PER_USD = 3.6725     # fixed peg


def _fetch():
    for url in ("https://api.frankfurter.dev/v1/latest?base=INR&symbols=EUR,USD,GBP,CNY",
                "https://api.frankfurter.app/latest?from=INR&to=EUR,USD,GBP,CNY"):
        try:
            with urllib.request.urlopen(url, timeout=8) as r:
                data = json.load(r)["rates"]
            rates = {c: 1.0 / v for c, v in data.items() if v}      # INR per 1 unit
            if "USD" in rates:
                rates["AED"] = rates["USD"] / AED_PER_USD
            return rates
        except Exception:
            continue
    return {}


def get_rates(refresh=False):
    rates = dict(FALLBACK)
    if CACHE.exists() and not refresh:
        rates.update({k: v for k, v in json.loads(CACHE.read_text()).items() if v})
    else:
        live = _fetch()
        if live:
            rates.update(live)
            CACHE.write_text(json.dumps(rates, indent=2))
    rates.update(MANUAL)
    return rates


def to_inr(amount, currency, rates=None):
    rates = rates or get_rates()
    r = rates.get(str(currency).upper())
    if r is None or amount is None or amount != amount:
        return float("nan")
    return amount * r