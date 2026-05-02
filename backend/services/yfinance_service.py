import yfinance as yf
from typing import Optional


def _get_fx_rate(from_ccy: str, to_ccy: str) -> float:
    """Get exchange rate from one currency to another via yfinance."""
    if from_ccy == to_ccy:
        return 1.0
    try:
        pair = yf.Ticker(f"{from_ccy}{to_ccy}=X")
        rate = pair.info.get("regularMarketPrice") or pair.info.get("previousClose")
        if rate and rate > 0:
            return float(rate)
    except Exception:
        pass
    approx = {
        "TWDUSD": 0.031, "KRWUSD": 0.00073, "JPYUSD": 0.0065,
        "GBPUSD": 1.27, "EURUSD": 1.08, "CNYUSD": 0.14,
        "INRUSD": 0.012, "HKDUSD": 0.128, "BRLUSD": 0.20,
    }
    key = f"{from_ccy}{to_ccy}"
    if key in approx:
        return approx[key]
    inv = f"{to_ccy}{from_ccy}"
    if inv in approx:
        return 1.0 / approx[inv]
    return 1.0


def _compute_fcf_dcf(ticker_obj) -> Optional[float]:
    """Compute a simple FCF-based DCF fair value using yfinance fundamentals."""
    try:
        cf = ticker_obj.cashflow
        if cf is None or cf.empty:
            return None
        fcf_row = None
        for label in ["Free Cash Flow", "FreeCashFlow"]:
            if label in cf.index:
                fcf_row = cf.loc[label]
                break
        if fcf_row is None:
            return None
        recent_fcf = [v for v in fcf_row.values[:3] if v is not None and v == v]
        if not recent_fcf:
            return None
        avg_fcf = sum(recent_fcf) / len(recent_fcf)
        if avg_fcf <= 0:
            return None
        info = ticker_obj.info
        shares = info.get("sharesOutstanding")
        if not shares or shares <= 0:
            return None

        price_ccy = (info.get("currency") or "USD").upper()
        fin_ccy = (info.get("financialCurrency") or price_ccy).upper()
        fx = _get_fx_rate(fin_ccy, price_ccy) if fin_ccy != price_ccy else 1.0
        avg_fcf *= fx

        market_cap = info.get("marketCap")
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")
        if market_cap and current_price and current_price > 0:
            implied = market_cap / current_price
            ratio = shares / implied if implied > 0 else 1.0
            if ratio > 1.5 or ratio < 0.67:
                shares = implied

        growth = 0.08
        discount = 0.10
        terminal_growth = 0.03
        proj_fcf = avg_fcf
        pv_total = 0.0
        for yr in range(1, 11):
            proj_fcf *= (1 + growth)
            pv_total += proj_fcf / ((1 + discount) ** yr)
        terminal_val = proj_fcf * (1 + terminal_growth) / (discount - terminal_growth)
        pv_terminal = terminal_val / ((1 + discount) ** 10)
        fair_value_per_share = (pv_total + pv_terminal) / shares
        if fair_value_per_share > 0:
            return round(fair_value_per_share, 2)
    except Exception:
        pass
    return None


def get_stock_data(symbol: str) -> dict:
    """Fetch stock valuation data from Yahoo Finance via yfinance."""
    ticker = yf.Ticker(symbol)

    try:
        info = ticker.info
    except Exception:
        return {"error": f"Failed to fetch data for {symbol}"}

    if not info or info.get("trailingPegRatio") is None and info.get("currentPrice") is None:
        try:
            fast = ticker.fast_info
            current_price = getattr(fast, "last_price", None)
        except Exception:
            current_price = None
    else:
        current_price = info.get("currentPrice") or info.get("regularMarketPrice")

    fcf_dcf = _compute_fcf_dcf(ticker)

    return {
        "ticker": symbol.upper(),
        "company_name": info.get("shortName") or info.get("longName"),
        "current_price": current_price,
        "currency": info.get("currency", "USD"),
        "target_high": info.get("targetHighPrice"),
        "target_low": info.get("targetLowPrice"),
        "target_mean": info.get("targetMeanPrice"),
        "target_median": info.get("targetMedianPrice"),
        "analyst_count": info.get("numberOfAnalystOpinions"),
        "forward_pe": info.get("forwardPE"),
        "trailing_pe": info.get("trailingPE"),
        "peg_ratio": info.get("trailingPegRatio") or info.get("pegRatio"),
        "sector_pe": info.get("sectorPE"),
        "recommendation": info.get("recommendationKey"),
        "recommendation_mean": info.get("recommendationMean"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "market_cap": info.get("marketCap"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        "fcf_dcf": fcf_dcf,
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
