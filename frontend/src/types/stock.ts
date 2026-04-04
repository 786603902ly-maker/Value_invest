export interface SourceValue {
  source: string;
  value: number;
  model?: string;
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
