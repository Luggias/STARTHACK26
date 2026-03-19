"""GBM simulation engine with market events and Monte Carlo confidence bands."""
import math
import random
from typing import Optional

# Per-asset GBM parameters (annual mu, annual sigma)
GBM_PARAMS: dict[str, dict] = {
    "stocks":  {"mu": 0.10,  "sigma": 0.18},
    "bonds":   {"mu": 0.04,  "sigma": 0.06},
    "gold":    {"mu": 0.07,  "sigma": 0.14},
    "cash":    {"mu": 0.02,  "sigma": 0.005},
    "crypto":  {"mu": 0.60,  "sigma": 0.80},
}

# Pre-written market events
MARKET_EVENTS: list[dict] = [
    {
        "key": "rate_hike_shock",
        "headline": "Central Banks Hike Rates Aggressively",
        "description": "Global central banks raise interest rates sharply to fight inflation. Bond prices fall as yields spike. Growth stocks take a hit.",
        "step_frac": 0.60,
        "shocks": {"bonds": -0.05, "stocks": -0.08, "cash": 0.02},
    },
    {
        "key": "crypto_winter",
        "headline": "Crypto Winter Strikes",
        "description": "A major exchange collapses, triggering a cascade of liquidations. Bitcoin falls 60%. Investors flee to safe havens.",
        "step_frac": 0.40,
        "shocks": {"crypto": -0.60, "gold": 0.08, "cash": 0.01},
    },
    {
        "key": "tech_boom",
        "headline": "AI Tech Boom Ignites Markets",
        "description": "Breakthroughs in artificial intelligence drive a massive rally in technology stocks. Growth investors are rewarded.",
        "step_frac": 0.30,
        "shocks": {"stocks": 0.15, "bonds": -0.02, "crypto": 0.20},
    },
    {
        "key": "inflation_surge",
        "headline": "Inflation Hits 40-Year High",
        "description": "Supply chain disruptions and energy shortages push inflation to levels not seen since the 1980s. Bonds suffer; real assets shine.",
        "step_frac": 0.50,
        "shocks": {"bonds": -0.08, "gold": 0.12, "cash": -0.03, "stocks": -0.05},
    },
    {
        "key": "market_crash",
        "headline": "Black Swan: Global Recession Fear",
        "description": "A surprise geopolitical event triggers a global selloff. Risk assets plunge while government bonds and gold surge as safe havens.",
        "step_frac": 0.45,
        "shocks": {"stocks": -0.18, "crypto": -0.35, "bonds": 0.06, "gold": 0.15},
    },
    {
        "key": "fed_pivot",
        "headline": "Fed Pivots — Rate Cuts Begin",
        "description": "The Federal Reserve signals the end of its tightening cycle. Risk assets rally strongly as liquidity returns to markets.",
        "step_frac": 0.70,
        "shocks": {"stocks": 0.10, "bonds": 0.05, "crypto": 0.25},
    },
    {
        "key": "gold_rally",
        "headline": "Geopolitical Tensions Drive Gold to Record Highs",
        "description": "Rising global uncertainty pushes investors into gold as a safe-haven store of value, driving it to all-time highs.",
        "step_frac": 0.55,
        "shocks": {"gold": 0.18, "crypto": -0.10, "stocks": -0.03},
    },
    {
        "key": "crypto_rally",
        "headline": "Bitcoin ETF Approved — Institutional Flood",
        "description": "Regulators approve spot Bitcoin ETFs, opening the floodgates to institutional capital. Crypto markets surge dramatically.",
        "step_frac": 0.25,
        "shocks": {"crypto": 0.80, "gold": -0.05, "bonds": -0.01},
    },
]

INITIAL_VALUE = 10_000.0


def simulate_gbm(
    allocation: dict[str, float],
    years: int = 20,
    seed: Optional[int] = None,
    inject_events: bool = True,
) -> dict:
    """
    Simulate portfolio using Geometric Brownian Motion.

    Returns dict with:
        months: list of month labels
        values: list of portfolio values (length = years*12 + 1)
        total_return: final % return
        events_triggered: list of event dicts that fired
    """
    rng = random.Random(seed)
    dt = 1 / 12  # monthly steps
    num_steps = years * 12

    # Normalise allocation to fractions
    total_alloc = sum(allocation.values())
    if total_alloc == 0:
        raise ValueError("Allocation must be non-zero")
    weights = {k: v / total_alloc for k, v in allocation.items()}

    # Per-asset monthly drift and vol
    params = {}
    for asset, w in weights.items():
        if w <= 0:
            continue
        p = GBM_PARAMS.get(asset, {"mu": 0.05, "sigma": 0.15})
        drift = (p["mu"] - 0.5 * p["sigma"] ** 2) * dt
        vol = p["sigma"] * math.sqrt(dt)
        params[asset] = {"w": w, "drift": drift, "vol": vol}

    # Determine which events fire (at most 3)
    fired_events: list[dict] = []
    if inject_events:
        candidates = MARKET_EVENTS[:]
        rng.shuffle(candidates)
        fired_events = candidates[:3]
        fired_events.sort(key=lambda e: e["step_frac"])

    portfolio_value = INITIAL_VALUE
    values = [portfolio_value]
    months = ["Start"]

    triggered = []
    event_idx = 0

    for step in range(1, num_steps + 1):
        step_frac = step / num_steps

        # Check if an event fires this step
        event_fired = None
        if event_idx < len(fired_events):
            ev = fired_events[event_idx]
            if step_frac >= ev["step_frac"]:
                event_fired = ev
                event_idx += 1

        # Compute weighted portfolio return this month
        portfolio_return = 0.0
        for asset, p in params.items():
            z = rng.gauss(0, 1)
            asset_return = math.exp(p["drift"] + p["vol"] * z) - 1

            # Apply shock if event fired
            if event_fired:
                shock = event_fired["shocks"].get(asset, 0.0)
                asset_return += shock

            portfolio_return += p["w"] * asset_return

        portfolio_value *= (1 + portfolio_return)
        portfolio_value = max(portfolio_value, 1.0)  # floor at $1
        values.append(round(portfolio_value, 2))

        # Month label
        year = (step - 1) // 12 + 1
        month = (step - 1) % 12 + 1
        months.append(f"Y{year}M{month}")

        if event_fired:
            triggered.append({
                "key": event_fired["key"],
                "headline": event_fired["headline"],
                "description": event_fired["description"],
                "step": step,
                "step_frac": step_frac,
            })

    total_return = round((values[-1] / INITIAL_VALUE - 1) * 100, 2)
    return {
        "months": months,
        "values": values,
        "total_return": total_return,
        "final_value": round(values[-1], 2),
        "events_triggered": triggered,
    }


def simulate_montecarlo(
    allocation: dict[str, float],
    years: int = 20,
    n_paths: int = 200,
    seed: Optional[int] = None,
) -> dict:
    """
    Run n_paths GBM simulations and return p5/p50/p95 confidence bands.
    """
    rng_seed = seed or 42
    all_values: list[list[float]] = []

    for i in range(n_paths):
        result = simulate_gbm(allocation, years=years, seed=rng_seed + i, inject_events=False)
        all_values.append(result["values"])

    num_steps = years * 12 + 1
    p5 = []
    p50 = []
    p95 = []

    for step in range(num_steps):
        step_vals = sorted(v[step] for v in all_values)
        n = len(step_vals)
        p5.append(round(step_vals[int(n * 0.05)], 2))
        p50.append(round(step_vals[int(n * 0.50)], 2))
        p95.append(round(step_vals[min(int(n * 0.95), n - 1)], 2))

    # Build month labels
    months = ["Start"] + [f"Y{(s-1)//12+1}M{(s-1)%12+1}" for s in range(1, num_steps)]

    return {"months": months, "p5": p5, "p50": p50, "p95": p95}
