export type DCFAnnotation = "authoritative" | "optimistic" | "pessimistic" | "classic" | "supplemental" | "conservative";

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
 * Conservative FCF DCF — same structure but with stricter assumptions
 * Discount rate: 12% (higher WACC), Terminal growth: 2%, Growth haircut 30%
 * This is our "most conservative reasonable" benchmark.
 */
export function conservativeFcfDCF(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number,
): number | undefined {
  if (freeCashflow <= 0 || sharesOutstanding <= 0) return undefined;
  // Haircut growth to 70% of Yahoo's estimate and cap more tightly
  const g = Math.max(-0.1, Math.min(growthRate * 0.7, 0.25));
  const discountRate = 0.12;
  const terminalGrowth = 0.02;
  const years = 5;
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
 * Earnings Power Value (Bruce Greenwald style) — no growth assumption
 * EPV = normalized EPS × (1 / cost of capital)
 * Represents value assuming zero growth — a conservative floor.
 */
export function earningsPowerValue(eps: number, costOfCapital = 0.09): number | undefined {
  if (eps <= 0) return undefined;
  return Math.round((eps / costOfCapital) * 100) / 100;
}

/**
 * Residual Income Model — simplified Stern Stewart approach
 * V = BVPS + Σ (ROE - r) × BVPS × (1+g)^(t-1) / (1+r)^t + terminal
 */
export function residualIncomeValue(
  bvps: number,
  eps: number,
  growthRate: number,
  requiredReturn = 0.10,
): number | undefined {
  if (bvps <= 0 || eps <= 0) return undefined;
  const roe = eps / bvps;
  if (roe <= requiredReturn) return Math.round(bvps * 100) / 100; // floor to book
  const g = Math.max(0, Math.min(growthRate, 0.15));
  const years = 5;
  let pv = bvps;
  let book = bvps;
  for (let t = 1; t <= years; t++) {
    const ri = (roe - requiredReturn) * book;
    pv += ri / Math.pow(1 + requiredReturn, t);
    book = book * (1 + g);
  }
  // Terminal: assume residual income fades to 0 after year 5
  return Math.round(pv * 100) / 100;
}

/**
 * 10-year FCF DCF — longer projection horizon, natural growth fade
 * Years 1-5: company growth rate (capped). Years 6-10: linearly fades to terminal growth.
 * A more conservative long-range view than the standard 5-year.
 */
export function fcfDCF10Year(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number,
  discountRate = 0.10,
  terminalGrowth = 0.025,
): number | undefined {
  if (freeCashflow <= 0 || sharesOutstanding <= 0) return undefined;
  const g = Math.max(-0.1, Math.min(growthRate * 0.8, 0.30));
  let totalPV = 0;
  let lastFCF = freeCashflow;
  for (let y = 1; y <= 10; y++) {
    // Phase 1 (years 1-5): use growth rate. Phase 2 (6-10): fade toward terminal.
    const yearGrowth = y <= 5 ? g : g - (g - terminalGrowth) * ((y - 5) / 5);
    lastFCF *= 1 + yearGrowth;
    totalPV += lastFCF / Math.pow(1 + discountRate, y);
  }
  const tv = (lastFCF * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  totalPV += tv / Math.pow(1 + discountRate, 10);
  return Math.round((totalPV / sharesOutstanding) * 100) / 100;
}

/**
 * EV/EBITDA Multiple-based Fair Value
 * Fair price = (EBITDA × sector median multiple) / shares outstanding
 * Uses a conservative 12× multiple (below S&P 500 median ~14×).
 */
export function evEbitdaFairValue(
  ebitda: number,
  sharesOutstanding: number,
  netDebt = 0,
  multiple = 12,
): number | undefined {
  if (ebitda <= 0 || sharesOutstanding <= 0) return undefined;
  const ev = ebitda * multiple;
  const equity = ev - netDebt;
  if (equity <= 0) return undefined;
  return Math.round((equity / sharesOutstanding) * 100) / 100;
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
  ebitda?: number;
  netDebt?: number;
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

  // 1b. Conservative FCF DCF — higher discount, haircut growth (heavy weight in avg)
  if (params.freeCashflow && params.sharesOutstanding && growthRate != null) {
    const val = conservativeFcfDCF(params.freeCashflow, growthRate, params.sharesOutstanding);
    if (val && val > 0) {
      results.push({
        source: "ValueInvest",
        model: "保守 FCF DCF",
        methodology: "折现率12%, 终值增长2%, 增长率打7折 — 保守价值投资者基准（平均值权重>50%）",
        value: val,
        annotation: "conservative",
      });
    }
  }

  // 1c. 10-year FCF DCF — longer horizon with growth fade
  if (params.freeCashflow && params.sharesOutstanding && growthRate != null) {
    const val = fcfDCF10Year(params.freeCashflow, growthRate, params.sharesOutstanding);
    if (val && val > 0) {
      results.push({
        source: "Yahoo Finance",
        model: "10年 FCF DCF (增长递减)",
        methodology: "10年FCF折现，前5年正常增速(打8折)，后5年线性衰减至终值增长率2.5%",
        value: val,
        annotation: "authoritative",
      });
    }
  }

  // 1d. EV/EBITDA Multiple Fair Value — if EBITDA data available
  if (params.ebitda && params.sharesOutstanding) {
    const val = evEbitdaFairValue(params.ebitda, params.sharesOutstanding, params.netDebt);
    if (val && val > 0) {
      results.push({
        source: "EV/EBITDA",
        model: "EV/EBITDA 乘数估值",
        methodology: "EBITDA × 保守乘数12× / 流通股数 — 相对估值法",
        value: val,
        annotation: "classic",
      });
    }
  }

  // 1e. Earnings Power Value (Greenwald) — no-growth conservative floor
  if (params.eps && params.eps > 0) {
    const val = earningsPowerValue(params.eps);
    if (val && val > 0) {
      results.push({
        source: "Bruce Greenwald",
        model: "Earnings Power Value",
        methodology: "EPS / 资本成本(9%) — 零增长假设下的盈利能力价值",
        value: val,
        annotation: "conservative",
      });
    }
  }

  // 1f. Residual Income Model
  if (params.eps && params.bvps && growthRate != null) {
    const val = residualIncomeValue(params.bvps, params.eps, growthRate);
    if (val && val > 0) {
      results.push({
        source: "Residual Income",
        model: "剩余收益模型 RIM",
        methodology: "BVPS + Σ(ROE-r)×BVPS 折现 — Stern Stewart 剩余收益法",
        value: val,
        annotation: "classic",
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
