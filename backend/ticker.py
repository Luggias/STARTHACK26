"""Live ticker prices via yfinance with GBM fallback and 5-min cache."""
import time
import random
from typing import Optional

# Symbols mapped to our asset classes
TICKER_SYMBOLS = {
    "SPY": {"label": "S&P 500", "asset": "stocks"},
    "TLT": {"label": "US Bonds", "asset": "bonds"},
    "GLD": {"label": "Gold", "asset": "gold"},
    "BTC-USD": {"label": "Bitcoin", "asset": "crypto"},
    "CASH": {"label": "Cash", "asset": "cash"},  # synthetic
}

_cache: dict = {}
_cache_ts: float = 0.0
_CACHE_TTL = 300  # 5 minutes


def _gbm_price(symbol: str, base_prices: dict) -> float:
    """Return a plausible GBM-perturbed price when yfinance is unavailable."""
    mu = 0.0001
    sigma = 0.002
    base = base_prices.get(symbol, 100.0)
    return round(base * (1 + random.gauss(mu, sigma)), 2)


_BASE_PRICES = {
    "SPY": 510.0,
    "TLT": 92.0,
    "GLD": 228.0,
    "BTC-USD": 85000.0,
    "CASH": 1.0,
}

_prev_prices: dict = dict(_BASE_PRICES)


def fetch_ticker_prices() -> list[dict]:
    """Return list of {symbol, label, price, change_pct} dicts. Cached 5 min."""
    global _cache, _cache_ts, _prev_prices

    now = time.time()
    if _cache and now - _cache_ts < _CACHE_TTL:
        return _cache

    results = []
    try:
        import yfinance as yf
        tickers = yf.Tickers(" ".join(s for s in TICKER_SYMBOLS if s != "CASH"))
        for symbol, meta in TICKER_SYMBOLS.items():
            if symbol == "CASH":
                results.append({"symbol": symbol, "label": meta["label"], "price": 1.0, "change_pct": 0.01})
                continue
            try:
                info = tickers.tickers[symbol].fast_info
                price = float(info.last_price)
                prev = float(getattr(info, "previous_close", price))
                change_pct = round((price - prev) / prev * 100, 2) if prev else 0.0
                _prev_prices[symbol] = price
                results.append({"symbol": symbol, "label": meta["label"], "price": round(price, 2), "change_pct": change_pct})
            except Exception:
                price = _gbm_price(symbol, _prev_prices)
                _prev_prices[symbol] = price
                results.append({"symbol": symbol, "label": meta["label"], "price": price, "change_pct": round(random.gauss(0, 0.5), 2)})
    except ImportError:
        for symbol, meta in TICKER_SYMBOLS.items():
            price = _gbm_price(symbol, _prev_prices)
            _prev_prices[symbol] = price
            results.append({"symbol": symbol, "label": meta["label"], "price": price, "change_pct": round(random.gauss(0, 0.5), 2)})

    _cache = results
    _cache_ts = now
    return results
