from pydantic import BaseModel
from typing import Optional


class SourceValue(BaseModel):
    source: str
    value: float
    model: Optional[str] = None


class TargetPriceSource(BaseModel):
    source: str
    high: Optional[float] = None
    low: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    count: Optional[int] = None


class MetricSummary(BaseModel):
    sources: list[SourceValue]
    avg: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None


class TargetPriceSummary(BaseModel):
    sources: list[TargetPriceSource]
    avg: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None


class ForwardPE(BaseModel):
    value: Optional[float] = None
    sector_avg: Optional[float] = None


class PEGRatio(BaseModel):
    value: Optional[float] = None


class Deviations(BaseModel):
    vs_avg_dcf: Optional[float] = None
    vs_avg_target: Optional[float] = None
    peg_signal: Optional[str] = None  # "undervalued" | "fair" | "overvalued"


class StockValuation(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    current_price: Optional[float] = None
    currency: Optional[str] = "USD"
    dcf_fair_value: MetricSummary
    target_price: TargetPriceSummary
    forward_pe: ForwardPE
    peg_ratio: PEGRatio
    recommendation: Optional[str] = None
    deviations: Deviations
    last_updated: Optional[str] = None


class BatchRequest(BaseModel):
    symbols: list[str]


class SearchResult(BaseModel):
    symbol: str
    name: str
    exchange: Optional[str] = None
