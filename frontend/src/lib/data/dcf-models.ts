export type DCFAnnotation = "authoritative" | "optimistic" | "pessimistic" | "classic" | "supplemental";

export interface ComputedDCF {
  source: string;
  model: string;
  methodology: string;
  value: number;
  annotation: DCFAnnotation;
}

/**
 * Graham Number — √(22.5 × EPS × BookValuePerShare)
 * Classic conservative floor value. Used as the pessimistic benchmark.
 */
export function grahamNumber(eps: number, bvps: number): number | undefined {
  if (eps <= 0 || bvps <= 0) return undefined;
  return Math.round(Math.sqrt(22.5 * eps * bvps) * 100) / 100;
}

/**
 * Benjamin Graham Intrinsic Value Formula (updated)
 * V* = EPS × (8.5 + 2g) × 4.4 / Y
 * g = expected annual EPS growth % (next 7-10 years)
 * Y = current AAA corporate bond yield (default 4.4%)
 */
export function grahamFormula(eps: number, growthRatePct: number, aaBondYield = 4.4): number | undefined {
  if (eps <= 0 || growthRatePct == null) return undefined;
  const g = Math.max(0, Math.min(growthRatePct, 35));
  return Math.round((eps * (8.5 + 2 * g) * 4.4) / aaBondYield * 100) / 100;
}

/**
 * Peter Lynch Fair Value — EPS × growth%
 * Stock is fairly valued when PEG = 1 (Price/EPS = growth rate)
 */
export function lynchFairValue(eps: number, growthRatePct: number): number | undefined {
  if (eps <= 0 || growthRatePct <= 0) return undefined;
  return Math.round(eps * growthRatePct * 100) / 100;
}

/**
 * Dividend Discount Model (Gordon Growth)
 * P = D1 / (r - g)
 * Only meaningful for dividend-paying stocks.
 */
export function ddmValue(
  dividendPerShare: number,
  growthRate: number,
  discountRate = 0.10
): number | undefined {
  if (dividendPerShare <= 0) return undefined;
  const g = Math.min(growthRate, discountRate - 0.005);
  if (g >= discountRate) return undefined;
  return Math.round((dividendPerShare * (1 + g)) / (discountRate - g) * 100) / 100;
}

/**
 * FCF DCF — 5-year free cash flow projection with terminal value
 * Discount rate: 10%, Terminal growth: 3%
 */
export function fcfDCF(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number,
  discountRate = 0.10,
  terminalGrowth = 0.03,
  years = 5
): number | undefined {
  if (freeCashflow <= 0 || sharesOutstanding <= 0) return undefined;
  const g = Math.max(-0.2, Math.min(growthRate, 0.5));
  let totalPV = 0;
  let lastFCF = freeCashflow;
  for (let y = 1; y <= years; y++) {
    lastFCF *= 1 + g;
    totalPV += lastFCF / Math.pow(1 + discountRate, y);
  }
  const tv = (lastFCF * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  totalPV += tv / Math.pow(1 + discountRate, years);
  return Math.round((totalPV / sharesOutstanding) * 100) / 100;
}

/**
 * Build annotated DCF list from available data.
 * Returns sorted array with annotations for authoritative, optimistic, pessimistic models.
 */
export function buildDCFModels(params: {
  freeCashflow?: number;
  eps?: number;
  bvps?: number;
  earningsGrowthPct?: number; // e.g. 15 for 15%
  earningsGrowthRate?: number; // decimal, e.g. 0.15
  sharesOutstanding?: number;
  dividendPerShare?: number;
  revenueGrowthRate?: number;
}): ComputedDCF[] {
  const results: ComputedDCF[] = [];

  const growthPct = params.earningsGrowthPct ??
    (params.earningsGrowthRate != null ? params.earningsGrowthRate * 100 : undefined);
  const growthRate = params.earningsGrowthRate ??
    (params.earningsGrowthPct != null ? params.earningsGrowthPct / 100 : undefined);

  // 1. FCF DCF — most authoritative if FCF data available
  if (params.freeCashflow && params.sharesOutstanding && growthRate != null) {
    const val = fcfDCF(params.freeCashflow, growthRate, params.sharesOutstanding);
    if (val && val > 0) {
      results.push({
        source: "Yahoo Finance",
        model: "FCF DCF",
        methodology: "5年自由现金流折现 + 永续增长终值 (折现率10%, 终值增长3%)",
        value: val,
        annotation: "authoritative",
      });
    }
  }

  // 2. Graham Number — conservative floor
  if (params.eps && params.bvps) {
    const val = grahamNumber(params.eps, params.bvps);
    if (val && val > 0) {
      results.push({
        source: "Benjamin Graham",
        model: "格雷厄姆数字 Graham Number",
        methodology: "√(22.5 × EPS × 每股净资产) — 价值投资安全边际下限",
        value: val,
        annotation: "pessimistic",
      });
    }
  }

  // 3. Graham Formula — classic intrinsic value
  if (params.eps && growthPct != null) {
    const val = grahamFormula(params.eps, growthPct);
    if (val && val > 0) {
      results.push({
        source: "Benjamin Graham",
        model: "格雷厄姆内在价值公式",
        methodology: "EPS × (8.5 + 2g) × 4.4 / 债券收益率 — 格雷厄姆经典公式",
        value: val,
        annotation: "classic",
      });
    }
  }

  // 4. Peter Lynch Fair Value — optimistic growth-based
  if (params.eps && growthPct != null && growthPct > 0) {
    const val = lynchFairValue(params.eps, growthPct);
    if (val && val > 0) {
      results.push({
        source: "Peter Lynch",
        model: "Lynch 公允价值 (PEG=1)",
        methodology: "EPS × 增长率% — 当PEG=1时的合理价格",
        value: val,
        annotation: "optimistic",
      });
    }
  }

  // 5. DDM — only for dividend stocks
  if (params.dividendPerShare && params.dividendPerShare > 0.5 && growthRate != null) {
    const val = ddmValue(params.dividendPerShare, growthRate ?? 0.03);
    if (val && val > 0) {
      results.push({
        source: "Dividend Model",
        model: "股息折现模型 DDM",
        methodology: "D₁/(r-g) — 适用于稳定分红股票",
        value: val,
        annotation: "supplemental",
      });
    }
  }

  return results;
}
