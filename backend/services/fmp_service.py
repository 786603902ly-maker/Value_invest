import httpx
from config import get_settings
from typing import Optional


async def get_dcf(symbol: str) -> list[dict]:
    """Fetch DCF fair value estimates from Financial Modeling Prep."""
    settings = get_settings()
    if not settings.fmp_api_key:
        return []

    results = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Standard DCF
        try:
            resp = await client.get(
                f"{settings.fmp_base_url}/discounted-cash-flow/{symbol}",
                params={"apikey": settings.fmp_api_key},
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    item = data[0]
                    results.append({
                        "source": "FMP",
                        "value": item.get("dcf"),
                        "model": "Discounted Cash Flow",
                        "stock_price": item.get("Stock Price"),
                    })
                elif isinstance(data, dict) and data.get("dcf"):
                    results.append({
                        "source": "FMP",
                        "value": data["dcf"],
                        "model": "Discounted Cash Flow",
                        "stock_price": data.get("Stock Price"),
                    })
        except Exception:
            pass

        # Advanced DCF (levered)
        try:
            resp = await client.get(
                f"{settings.fmp_base_url}/advanced_discounted_cash_flow",
                params={"apikey": settings.fmp_api_key, "symbol": symbol},
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    item = data[0]
                    if item.get("dcf"):
                        results.append({
                            "source": "FMP",
                            "value": item["dcf"],
                            "model": "Advanced Levered DCF",
                        })
        except Exception:
            pass

    return results


async def get_analyst_estimates(symbol: str) -> Optional[dict]:
    """Fetch analyst price target consensus from FMP."""
    settings = get_settings()
    if not settings.fmp_api_key:
        return None

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{settings.fmp_base_url}/analyst-estimates/{symbol}",
                params={"apikey": settings.fmp_api_key, "limit": 1},
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0]
        except Exception:
            pass

    return None


async def get_rating(symbol: str) -> Optional[dict]:
    """Fetch company rating from FMP."""
    settings = get_settings()
    if not settings.fmp_api_key:
        return None

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{settings.fmp_base_url}/rating/{symbol}",
                params={"apikey": settings.fmp_api_key},
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0]
        except Exception:
            pass

    return None


async def get_price_target_consensus(symbol: str) -> Optional[dict]:
    """Fetch analyst price target consensus from FMP."""
    settings = get_settings()
    if not settings.fmp_api_key:
        return None

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{settings.fmp_base_url}/price-target-consensus/{symbol}",
                params={"apikey": settings.fmp_api_key},
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0]
        except Exception:
            pass

    return None
