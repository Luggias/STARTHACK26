"""
Historical market data and portfolio simulation engine.

Contains hardcoded monthly returns for 5 asset classes across 4 historical scenarios.
All returns are monthly percentage changes in decimal form (e.g., 0.05 = +5%, -0.12 = -12%).
Data sourced from public index performance records.
"""

import math
from typing import Optional

# ---------------------------------------------------------------------------
# Asset class definitions
# ---------------------------------------------------------------------------

ASSET_CLASSES = {
    "stocks": {
        "name": "Stocks",
        "icon": "📈",
        "risk_level": 4,
        "description": (
            "Stocks represent ownership in companies. When you buy stocks, you own a small "
            "piece of businesses like Apple, Nestle, or Toyota. Stocks tend to grow over long "
            "periods but can swing wildly in the short term. They are the engine of most "
            "portfolios — high potential reward, but you need patience and a strong stomach."
        ),
        "typical_return": "7-10% per year (long-term average)",
        "color": "#3B82F6",
    },
    "bonds": {
        "name": "Bonds",
        "icon": "🏦",
        "risk_level": 2,
        "description": (
            "Bonds are loans you give to governments or companies. In return, they pay you "
            "regular interest. Bonds are considered safer than stocks — they won't make you "
            "rich overnight, but they provide steady income and act as a cushion when stock "
            "markets crash. Think of them as the seatbelt of your portfolio."
        ),
        "typical_return": "2-5% per year",
        "color": "#10B981",
    },
    "gold": {
        "name": "Gold",
        "icon": "🥇",
        "risk_level": 3,
        "description": (
            "Gold has been a store of value for thousands of years. It doesn't pay dividends "
            "or interest, but it tends to hold its value during crises and inflation. When "
            "everything else falls, gold often rises. It's the ultimate 'safe haven' asset — "
            "insurance for your portfolio against uncertainty."
        ),
        "typical_return": "4-7% per year",
        "color": "#F59E0B",
    },
    "cash": {
        "name": "Cash",
        "icon": "💵",
        "risk_level": 1,
        "description": (
            "Cash (or money market funds) is the safest asset class. Your money stays stable "
            "and earns a small amount of interest. The downside? Inflation slowly eats away "
            "at its purchasing power. Cash is useful for short-term safety, but holding too "
            "much for too long means your money quietly loses value."
        ),
        "typical_return": "0.5-3% per year",
        "color": "#6B7280",
    },
    "crypto": {
        "name": "Crypto",
        "icon": "₿",
        "risk_level": 5,
        "description": (
            "Cryptocurrencies like Bitcoin are digital assets built on blockchain technology. "
            "They can deliver explosive gains — or devastating losses — in very short periods. "
            "Crypto is the most volatile asset class: prices can swing 20% in a single day. "
            "Only invest what you can afford to lose completely."
        ),
        "typical_return": "Highly unpredictable (-50% to +200% per year)",
        "color": "#8B5CF6",
    },
}

# ---------------------------------------------------------------------------
# Historical scenario data
# Monthly returns per asset class (decimal: 0.05 = +5%)
# ---------------------------------------------------------------------------

SCENARIOS = {
    "2008_crisis": {
        "name": "2008 Financial Crisis",
        "period": "Sep 2008 – Feb 2009",
        "description": (
            "The collapse of Lehman Brothers triggered a global financial meltdown. "
            "Stock markets around the world crashed, banks failed, and millions lost their "
            "savings. This scenario tests whether your portfolio can weather the worst "
            "financial storm in modern history."
        ),
        "lesson": "Diversification and safe havens protect you when markets crash.",
        "months": ["Sep 08", "Oct 08", "Nov 08", "Dec 08", "Jan 09", "Feb 09"],
        "returns": {
            "stocks":  [-0.090, -0.169, -0.074,  0.010, -0.085, -0.109],
            "bonds":   [ 0.012, -0.008,  0.040,  0.038, -0.013,  0.008],
            "gold":    [ 0.060, -0.058,  0.130,  0.052,  0.048,  0.022],
            "cash":    [ 0.001,  0.001,  0.001,  0.001,  0.001,  0.001],
            "crypto":  [ 0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
        },
        "crypto_note": "Bitcoin was invented in 2008 but had no market price yet.",
    },
    "covid_crash": {
        "name": "COVID Crash & Recovery",
        "period": "Feb 2020 – Dec 2020",
        "description": (
            "When COVID-19 became a global pandemic, markets crashed 30% in weeks — the "
            "fastest bear market in history. But then came an extraordinary recovery. "
            "This scenario tests whether you stay invested or panic."
        ),
        "lesson": "Staying invested through a crash is often better than panic selling.",
        "months": [
            "Feb 20", "Mar 20", "Apr 20", "May 20", "Jun 20",
            "Jul 20", "Aug 20", "Sep 20", "Oct 20", "Nov 20", "Dec 20",
        ],
        "returns": {
            "stocks":  [-0.084, -0.125,  0.127,  0.045,  0.019,  0.056,  0.070, -0.038, -0.027,  0.108,  0.037],
            "bonds":   [ 0.018,  0.006, -0.005, -0.001,  0.003,  0.014, -0.010, -0.004,  0.002,  0.005,  0.003],
            "gold":    [-0.013,  0.015,  0.070,  0.025,  0.029,  0.100, -0.008,  -0.042,  0.002,  -0.054,  0.068],
            "cash":    [ 0.001,  0.001,  0.001,  0.001,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000,  0.000],
            "crypto":  [-0.075, -0.250,  0.342,  0.095,  0.028,  0.242,  0.026,  -0.031,  0.282,  0.428,  0.469],
        },
        "crypto_note": None,
    },
    "dotcom_burst": {
        "name": "Dot-Com Bubble Burst",
        "period": "Mar 2000 – Mar 2001",
        "description": (
            "The internet hype of the late 1990s drove tech stocks to insane valuations. "
            "When the bubble burst, the Nasdaq lost nearly 80% of its value. Companies "
            "that seemed invincible disappeared overnight. This scenario shows the danger "
            "of chasing hype."
        ),
        "lesson": "Sector concentration is dangerous. Diversify beyond the trend of the day.",
        "months": [
            "Mar 00", "Apr 00", "May 00", "Jun 00", "Jul 00", "Aug 00",
            "Sep 00", "Oct 00", "Nov 00", "Dec 00", "Jan 01", "Feb 01", "Mar 01",
        ],
        "returns": {
            "stocks":  [ 0.097, -0.031, -0.022,  0.024, -0.016,  0.060, -0.053, -0.004, -0.080, 0.004, 0.035, -0.092, -0.064],
            "bonds":   [-0.010,  0.005,  0.006, 0.020,  0.002, 0.015,  0.012,  0.010,  0.020, 0.012,  0.015,  0.010,  0.008],
            "gold":    [-0.020,  0.010, -0.015, 0.005,  -0.010,  -0.005, 0.020,  -0.010,  0.005, 0.015,  -0.010,  0.005,  0.020],
            "cash":    [ 0.004,  0.004,  0.004, 0.004,   0.004,   0.004, 0.004,   0.004,  0.004, 0.004,   0.004,  0.004,  0.004],
            "crypto":  [ 0.000,  0.000,  0.000, 0.000,   0.000,   0.000, 0.000,   0.000,  0.000, 0.000,   0.000,  0.000,  0.000],
        },
        "crypto_note": "Bitcoin was not invented until 2009.",
    },
    "2022_inflation": {
        "name": "2022 Inflation Surge",
        "period": "Jan 2022 – Dec 2022",
        "description": (
            "After years of easy money, inflation surged to 40-year highs. Central banks "
            "raised interest rates aggressively. For the first time in decades, BOTH stocks "
            "AND bonds fell together. This was the year diversification was truly tested."
        ),
        "lesson": "In an inflation crisis, traditional stock-bond portfolios can both lose. Gold and real assets may hold up better.",
        "months": [
            "Jan 22", "Feb 22", "Mar 22", "Apr 22", "May 22", "Jun 22",
            "Jul 22", "Aug 22", "Sep 22", "Oct 22", "Nov 22", "Dec 22",
        ],
        "returns": {
            "stocks":  [-0.053, -0.030,  0.036, -0.088, 0.002, -0.083,  0.091, -0.041, -0.094,  0.080,  0.054, -0.058],
            "bonds":   [-0.022, -0.012, -0.028, -0.035, 0.006, -0.015,  0.025, -0.028, -0.043,  0.002,  0.035,  0.005],
            "gold":    [ 0.013, 0.060,  0.030, -0.020, 0.003,  -0.017, -0.023,  -0.031, -0.031,  -0.017,  0.070,  0.030],
            "cash":    [ 0.000,  0.000,  0.000,  0.001,  0.001,  0.001,  0.002,  0.002,  0.002,  0.003,  0.003,  0.003],
            "crypto":  [-0.167, -0.024, 0.053, -0.175, -0.260, -0.371,  0.422, -0.139, -0.032, 0.056, -0.163, -0.025],
        },
        "crypto_note": None,
    },
}


# ---------------------------------------------------------------------------
# Portfolio simulation
# ---------------------------------------------------------------------------

def simulate_portfolio(
    allocation: dict[str, float],
    scenario_key: str,
) -> dict:
    """
    Simulate a portfolio through a historical scenario.

    Args:
        allocation: Asset weights as percentages summing to 100.
                    e.g. {"stocks": 40, "bonds": 20, "gold": 15, "cash": 15, "crypto": 10}
        scenario_key: Key into SCENARIOS dict.

    Returns:
        {
            "months": ["Sep 08", "Oct 08", ...],
            "values": [100.0, 94.2, ...],         # Portfolio value over time (start=100)
            "final_value": 88.5,
            "total_return": -11.5,                 # Percentage
            "sharpe_ratio": -1.2,
            "max_drawdown": 15.3,                  # Percentage
            "asset_contributions": {"stocks": -8.2, "bonds": 1.5, ...},
        }
    """
    scenario = SCENARIOS[scenario_key]
    months = scenario["months"]
    returns = scenario["returns"]
    num_months = len(months)

    # Normalize allocation to fractions
    total_weight = sum(allocation.values())
    weights = {k: v / total_weight for k, v in allocation.items()}

    # Simulate month-by-month compounding
    values = [100.0]
    monthly_returns = []

    for i in range(num_months):
        monthly_return = sum(
            weights.get(asset, 0.0) * returns[asset][i]
            for asset in returns
        )
        monthly_returns.append(monthly_return)
        values.append(round(values[-1] * (1 + monthly_return), 2))

    # Compute metrics
    final_value = values[-1]
    total_return = round(final_value - 100.0, 2)

    # Sharpe ratio (annualized, using monthly data)
    if len(monthly_returns) > 1 and any(r != 0 for r in monthly_returns):
        mean_monthly = sum(monthly_returns) / len(monthly_returns)
        variance = sum((r - mean_monthly) ** 2 for r in monthly_returns) / (len(monthly_returns) - 1)
        std_monthly = math.sqrt(variance) if variance > 0 else 0.0001
        sharpe = round((mean_monthly / std_monthly) * math.sqrt(12), 3)
    else:
        sharpe = 0.0

    # Max drawdown
    peak = values[0]
    max_dd = 0.0
    for v in values:
        if v > peak:
            peak = v
        dd = (peak - v) / peak
        if dd > max_dd:
            max_dd = dd
    max_drawdown = round(max_dd * 100, 2)

    # Per-asset contribution to total return
    asset_contributions = {}
    for asset in returns:
        weight = weights.get(asset, 0.0)
        cumulative = 1.0
        for i in range(num_months):
            cumulative *= (1 + returns[asset][i])
        asset_contributions[asset] = round(weight * (cumulative - 1) * 100, 2)

    return {
        "months": ["Start"] + months,
        "values": values,
        "final_value": final_value,
        "total_return": total_return,
        "sharpe_ratio": sharpe,
        "max_drawdown": max_drawdown,
        "asset_contributions": asset_contributions,
    }


def compute_battle_score(result: dict, opponent_result: dict) -> float:
    """
    Compute composite battle score for a portfolio.

    score = 0.6 * normalized_return + 0.3 * normalized_sharpe + 0.1 * diversification_bonus
    """
    # Normalized return (0-1 scale relative to both players)
    max_return = max(result["total_return"], opponent_result["total_return"], 0.01)
    min_return = min(result["total_return"], opponent_result["total_return"])
    range_return = max_return - min_return if max_return != min_return else 1.0
    norm_return = (result["total_return"] - min_return) / range_return

    # Normalized Sharpe (higher is better)
    max_sharpe = max(result["sharpe_ratio"], opponent_result["sharpe_ratio"], 0.01)
    min_sharpe = min(result["sharpe_ratio"], opponent_result["sharpe_ratio"])
    range_sharpe = max_sharpe - min_sharpe if max_sharpe != min_sharpe else 1.0
    norm_sharpe = (result["sharpe_ratio"] - min_sharpe) / range_sharpe

    # Diversification bonus: how many asset classes have non-zero weight
    # Max bonus when all 5 are used
    return round(0.6 * norm_return + 0.3 * norm_sharpe + 0.1, 3)


def get_scenario_list() -> list[dict]:
    """Return metadata for all scenarios (without return data)."""
    return [
        {
            "key": key,
            "name": s["name"],
            "period": s["period"],
            "description": s["description"],
            "lesson": s["lesson"],
            "num_months": len(s["months"]),
        }
        for key, s in SCENARIOS.items()
    ]


def get_scenario_detail(key: str) -> Optional[dict]:
    """Return full scenario data including asset info."""
    if key not in SCENARIOS:
        return None

    scenario = SCENARIOS[key]
    return {
        **scenario,
        "key": key,
        "asset_classes": ASSET_CLASSES,
    }
