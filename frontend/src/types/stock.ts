export type DCFAnnotation = "primary" | "authoritative" | "optimistic" | "pessimistic" | "classic" | "supplemental" | "external" | "conservative";

/**
 * What quantity a model estimates. Only `value` models set the fair value;
 * `floor` models set the margin-of-safety band; `reference` models are context.
 */
export type DCFRole = "value" | "floor" | "reference";

export interface SourceValue {
  source: string;
  value: number;
  model?: string;
  methodology?: string;
  annotation?: DCFAnnotation;
  reliable?: boolean; // false = flagged as an outlier; excluded from the blend
  role?: DCFRole;
  /** Base weight within its role group, before renormalization. */
  weight?: number;
}

export interface TargetPriceSource {
  source: string;
  high?: number;
  low?: number;
  mean?: number;
  median?: number;
  count?: number;
}

export interface MetricSummary {
  sources: SourceValue[];
  avg?: number;
  min?: number;
  max?: number;
}

export interface TargetPriceSummary {
  sources: TargetPriceSource[];
  avg?: number;
  min?: number;
  max?: number;
}

export interface ForwardPE {
  value?: number;
  sector_avg?: number;
}

export interface PEGRatio {
  value?: number;
}

/**
 * Transparency payload for the fair-value blend: which inputs were normalized,
 * how far, and how much the models actually agree with each other.
 */
export interface ValuationQuality {
  confidence: "high" | "medium" | "low";
  years_of_data?: number;
  history_provider?: string;
  model_count?: number;
  /** Value models that are ours rather than a third party's. */
  internal_model_count?: number;
  /** Share of the primary DCF's present value sitting in the terminal value. */
  terminal_value_share?: number;
  /** (P75 - P25) / median across the reliable model values. */
  dispersion?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  /** Median of the floor models — margin-of-safety reference, not the estimate. */
  floor_value?: number;
  normalized_fcf?: number;
  ttm_fcf?: number;
  owner_earnings?: number;
  normalized_eps?: number;
  ttm_eps?: number;
  growth_rate_used?: number;
  growth_rate_raw?: number;
  discount_rate_used?: number;
  terminal_growth_used?: number;
  fcf_volatility?: number;
  earnings_volatility?: number;
  ocf_volatility?: number;
  /** The volatility actually used to set the discount rate. */
  business_volatility?: number;
  /** Median EV/EBITDA from the company's own history. */
  ev_ebitda_median?: number;
  capex_spike?: boolean;
  capex_intensity_ttm?: number;
  capex_intensity_median?: number;
  growth_sources?: { label: string; value: number; forward?: boolean }[];
  /** Set when PEG and the DCF point in opposite directions, with the reason. */
  peg_conflict?: string;
  risk_free_rate?: number;
  peg_implied_growth?: number;
  adjustments?: string[];
}

export interface Deviations {
  vs_avg_dcf?: number;
  vs_avg_target?: number;
  peg_signal?: string;
}

export interface StockValuation {
  ticker: string;
  company_name?: string;
  current_price?: number;
  currency?: string;
  dcf_fair_value: MetricSummary;
  target_price: TargetPriceSummary;
  forward_pe: ForwardPE;
  peg_ratio: PEGRatio;
  recommendation?: string;
  valuation_quality?: ValuationQuality;
  deviations: Deviations;
  last_updated?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

export type Tier = "free" | "pro" | "premium";

export interface Alert {
  id: string;
  ticker: string;
  metric: "dcf_fair_value" | "target_price" | "peg" | "forward_pe";
  condition: "above" | "below";
  threshold: number;
  active: boolean;
}

export interface PortfolioItem {
  id: string;
  ticker: string;
  note?: string;
  addedAt: string;
}

export interface Portfolio {
  id: string;
  name: string;
  items: PortfolioItem[];
  createdAt: string;
  updatedAt: string;
}
