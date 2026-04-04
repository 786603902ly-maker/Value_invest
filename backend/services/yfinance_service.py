import yfinance as yf
from typing import Optional


def get_stock_data(symbol: str) -> dict:
    """Fetch stock valuation data from Yahoo Finance via yfinance."""
    ticker = yf.Ticker(symbol)

    try:
        info = ticker.info
    except Exception:
        return {"error": f"Failed to fetch data for {symbol}"}

    if not info or info.get("trailingPegRatio") is None and info.get("currentPrice") is None:
        # Fallback: try fast_info for price
        try:
            fast = ticker.fast_info
            current_price = getattr(fast, "last_price", None)
        except Exception:
            current_price = None
    else:
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")

    return {
        "ticker": symbol.upper(),
        "company_name": info.get("shortName") or info.get("longName"),
        "current_price": current_price,
        "currency": info.get("currency", "USD"),
        # Target price data (analyst consensus)
        "target_high": info.get("targetHighPrice"),
        "target_low": info.get("targetLowPrice"),
        "target_mean": info.get("targetMeanPrice"),
        "target_median": info.get("targetMedianPrice"),
        "analyst_count": info.get("numberOfAnalystOpinions"),
        # Valuation metrics
        "forward_pe": info.get("forwardPE"),
        "trailing_pe": info.get("trailingPE"),
        "peg_ratio": info.get("trailingPegRatio") or info.get("pegRatio"),
        "sector_pe": info.get("sectorPE"),
        # Recommendation
        "recommendation": info.get("recommendationKey"),
        "recommendation_mean": info.get("recommendationMean"),
        # Additional context
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "market_cap": info.get("marketCap"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
    }


def search_tickers(query: str) -> list[dict]:
    """Search for tickers matching a query string."""
    try:
        results = yf.Search(query)
        quotes = results.quotes if hasattr(results, "quotes") else []
        return [
            {
                "symbol": q.get("symbol", ""),
                "name": q.get("shortname") or q.get("longname", ""),
                "exchange": q.get("exchange", ""),
            }
            for q in quotes[:10]
        ]
    except Exception:
        return []
