from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from services.aggregator import get_full_valuation
from services.yfinance_service import search_tickers
from models.schemas import StockValuation, SearchResult
from datetime import datetime, timezone
import asyncio

app = FastAPI(
    title="ValueInvest API",
    description="Stock valuation data aggregation service for value investors",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache
_cache: dict[str, tuple[StockValuation, datetime]] = {}
CACHE_TTL = 3600  # seconds


def _get_cached(symbol: str) -> StockValuation | None:
    if symbol in _cache:
        val, ts = _cache[symbol]
        if (datetime.now(timezone.utc) - ts).total_seconds() < CACHE_TTL:
            return val
        del _cache[symbol]
    return None


@app.get("/api/valuation/{symbol}", response_model=StockValuation)
async def get_valuation(symbol: str):
    """Get full valuation data for a single stock."""
    symbol = symbol.upper().strip()
    if not symbol or len(symbol) > 10:
        raise HTTPException(400, "Invalid symbol")

    cached = _get_cached(symbol)
    if cached:
        return cached

    try:
        result = await get_full_valuation(symbol)
        _cache[symbol] = (result, datetime.now(timezone.utc))
        return result
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch data for {symbol}: {str(e)}")


@app.get("/api/valuation/batch", response_model=list[StockValuation])
async def get_batch_valuation(
    symbols: str = Query(..., description="Comma-separated stock symbols")
):
    """Get valuation data for multiple stocks."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(400, "No symbols provided")
    if len(symbol_list) > 20:
        raise HTTPException(400, "Maximum 20 symbols per batch request")

    tasks = []
    for sym in symbol_list:
        cached = _get_cached(sym)
        if cached:
            tasks.append(asyncio.coroutine(lambda c=cached: c)())
        else:
            tasks.append(get_full_valuation(sym))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    valuations = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            continue
        _cache[symbol_list[i]] = (result, datetime.now(timezone.utc))
        valuations.append(result)

    return valuations


@app.get("/api/search", response_model=list[SearchResult])
async def search(q: str = Query(..., min_length=1, description="Search query")):
    """Search for stock tickers by name or symbol."""
    results = search_tickers(q)
    return [
        SearchResult(
            symbol=r["symbol"],
            name=r["name"],
            exchange=r.get("exchange"),
        )
        for r in results
    ]


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
