from datetime import datetime, timezone
from models.schemas import (
    StockValuation, MetricSummary, TargetPriceSummary,
    SourceValue, TargetPriceSource, ForwardPE, PEGRatio, Deviations,
)
from services.yfinance_service import get_stock_data
from services import fmp_service


def _safe_avg(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return round(sum(clean) / len(clean), 2) if clean else None


def _safe_min(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return round(min(clean), 2) if clean else None


def _safe_max(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return round(max(clean), 2) if clean else None


def _peg_signal(peg: float | None) -> str | None:
    if peg is None:
        return None
    if peg < 1:
        return "undervalued"
    if peg <= 2:
        return "fair"
    return "overvalued"


async def get_full_valuation(symbol: str) -> StockValuation:
    """Aggregate data from yfinance and FMP into a unified valuation response."""
    symbol = symbol.upper().strip()

    # Fetch from both sources
    yf_data = get_stock_data(symbol)
    fmp_dcf_list = await fmp_service.get_dcf(symbol)
    fmp_consensus = await fmp_service.get_price_target_consensus(symbol)
    fmp_rating = await fmp_service.get_rating(symbol)

    # --- DCF Fair Value ---
    dcf_sources = []
    for item in fmp_dcf_list:
        if item.get("value") is not None:
            dcf_sources.append(SourceValue(
                source=item["source"],
                value=round(item["value"], 2),
                model=item.get("model"),
            ))

    dcf_values = [s.value for s in dcf_sources]
    dcf_summary = MetricSummary(
        sources=dcf_sources,
        avg=_safe_avg(dcf_values),
        min=_safe_min(dcf_values),
        max=_safe_max(dcf_values),
    )

    # --- Target Price ---
    target_sources = []

    # Yahoo Finance consensus
    yf_target = yf_data.get("target_mean")
    if yf_target is not None:
        target_sources.append(TargetPriceSource(
            source="Yahoo Finance Consensus",
            high=yf_data.get("target_high"),
            low=yf_data.get("target_low"),
            mean=yf_data.get("target_mean"),
            median=yf_data.get("target_median"),
            count=yf_data.get("analyst_count"),
        ))

    # FMP consensus
    if fmp_consensus:
        target_sources.append(TargetPriceSource(
            source="FMP Analyst Consensus",
            high=fmp_consensus.get("targetHigh"),
            low=fmp_consensus.get("targetLow"),
            mean=fmp_consensus.get("targetConsensus"),
            median=fmp_consensus.get("targetMedian"),
        ))

    # Compute summary from all mean values
    all_means = [s.mean for s in target_sources if s.mean is not None]
    all_lows = [s.low for s in target_sources if s.low is not None]
    all_highs = [s.high for s in target_sources if s.high is not None]

    target_summary = TargetPriceSummary(
        sources=target_sources,
        avg=_safe_avg(all_means),
        min=_safe_min(all_lows),
        max=_safe_max(all_highs),
    )

    # --- Forward PE ---
    forward_pe = ForwardPE(
        value=yf_data.get("forward_pe"),
        sector_avg=yf_data.get("sector_pe"),
    )

    # --- PEG Ratio ---
    peg = PEGRatio(value=yf_data.get("peg_ratio"))

    # --- Recommendation ---
    recommendation = yf_data.get("recommendation")
    if fmp_rating and fmp_rating.get("ratingRecommendation"):
        # Could blend, for now prefer yfinance, fallback to FMP
        if not recommendation:
            recommendation = fmp_rating["ratingRecommendation"].lower()

    # --- Deviations ---
    current_price = yf_data.get("current_price")
    vs_avg_dcf = None
    vs_avg_target = None

    if current_price and dcf_summary.avg:
        vs_avg_dcf = round(
            (current_price - dcf_summary.avg) / dcf_summary.avg * 100, 2
        )

    if current_price and target_summary.avg:
        vs_avg_target = round(
            (current_price - target_summary.avg) / target_summary.avg * 100, 2
        )

    deviations = Deviations(
        vs_avg_dcf=vs_avg_dcf,
        vs_avg_target=vs_avg_target,
        peg_signal=_peg_signal(peg.value),
    )

    return StockValuation(
        ticker=symbol,
        company_name=yf_data.get("company_name"),
        current_price=current_price,
        currency=yf_data.get("currency", "USD"),
        dcf_fair_value=dcf_summary,
        target_price=target_summary,
        forward_pe=forward_pe,
        peg_ratio=peg,
        recommendation=recommendation,
        deviations=deviations,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )
