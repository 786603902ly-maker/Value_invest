import { getYahooData } from "./yahoo";
import {
  getDcf,
  getTargetConsensus,
  getRating,
  getRatios,
  getKeyMetrics,
  getIncomeStatement,
  getEnterpriseValue,
} from "./fmp";
import { getAVOverview } from "./alpha-vantage";
import { getExchangeRate } from "./currency";
import { buildDCFModels, MODEL_WEIGHTS } from "./dcf-models";
import { getFinancialHistory } from "./history";
import { normalizeInputs } from "./normalize";
import type {
  StockValuation,
  SourceValue,
  TargetPriceSource,
  ValuationQuality,
} from "@/types/stock";

function safeAvg(values: (number | undefined)[]): number | undefined {
  const clean = values.filter((v): v is number => v != null);
  if (!clean.length) return undefined;
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 100) / 100;
}

function safeMin(values: (number | undefined)[]): number | undefined {
  const clean = values.filter((v): v is number => v != null);
  return clean.length ? Math.round(Math.min(...clean) * 100) / 100 : undefined;
}

function safeMax(values: (number | undefined)[]): number | undefined {
  const clean = values.filter((v): v is number => v != null);
  return clean.length ? Math.round(Math.max(...clean) * 100) / 100 : undefined;
}

function percentile(sortedAsc: number[], p: number): number | undefined {
  if (!sortedAsc.length) return undefined;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

function medianOf(values: number[]): number | undefined {
  const s = [...values].sort((a, b) => a - b);
  return percentile(s, 0.5);
}

/**
 * Outlier guard.
 *
 * Replaces the previous analyst-band filter, which had two problems: it was
 * anchored to the sell-side target range (so a stock analysts disagreed on got
 * a wide-open band), and when it rejected everything the caller silently fell
 * back to averaging ALL values — including the ones just rejected. Failing open
 * like that turns the guard into a no-op exactly when it is needed most.
 *
 * Now: a wide absolute sanity band removes broken data, then a robust
 * median-absolute-deviation test removes values that disagree with the rest of
 * the model set. At least three models always survive, picked by closeness to
 * the median rather than by falling back to the unfiltered list.
 */
export function markReliability(values: number[], priceAnchor?: number): boolean[] {
  const n = values.length;
  const flags = new Array<boolean>(n).fill(true);
  if (n === 0) return flags;

  // Stage 1 — absolute sanity. Deliberately wide: this is for broken inputs
  // (a share count off by an ADR ratio, a currency mix-up), not for judgement.
  if (priceAnchor != null && priceAnchor > 0) {
    for (let i = 0; i < n; i++) {
      if (values[i] < priceAnchor * 0.2 || values[i] > priceAnchor * 5) flags[i] = false;
    }
  }

  // Stage 2 — robust dispersion test on whatever survived stage 1.
  const survivors = values.filter((_, i) => flags[i]);
  if (survivors.length >= 5) {
    const med = medianOf(survivors)!;
    const mad = medianOf(survivors.map((v) => Math.abs(v - med)))!;
    // 1.4826 rescales MAD to a standard-deviation equivalent for normal data.
    const scale = mad * 1.4826;
    if (scale > 0) {
      for (let i = 0; i < n; i++) {
        if (flags[i] && Math.abs(values[i] - med) > 3.5 * scale) flags[i] = false;
      }
    }
  }

  // Never fail open: keep the three values closest to the median of ALL values.
  if (flags.filter(Boolean).length < Math.min(3, n)) {
    const med = medianOf(values)!;
    const order = values
      .map((v, i) => ({ i, d: Math.abs(v - med) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.min(3, n))
      .map((x) => x.i);
    flags.fill(false);
    for (const i of order) flags[i] = true;
  }

  return flags;
}

/**
 * Weighted blend over the reliable models, using each model's declared weight
 * renormalized across whatever is actually available.
 */
export function weightedFairValue(sources: SourceValue[]): number | undefined {
  const reliable = sources.filter((s) => s.reliable !== false && (s.weight ?? 0) > 0);
  if (!reliable.length) return undefined;
  const totalWeight = reliable.reduce((sum, s) => sum + (s.weight ?? 0), 0);
  if (totalWeight <= 0) return undefined;
  const weighted = reliable.reduce((sum, s) => sum + s.value * (s.weight ?? 0), 0) / totalWeight;
  return Math.round(weighted * 100) / 100;
}

function pegSignal(peg?: number): string | undefined {
  if (peg == null) return undefined;
  if (peg < 1) return "undervalued";
  if (peg <= 2) return "fair";
  return "overvalued";
}

export async function getFullValuation(symbol: string): Promise<StockValuation> {
  symbol = symbol.toUpperCase().trim();

  const [
    yahooData,
    history,
    fmpDcfList,
    fmpConsensus,
    fmpRating,
    avOverview,
    fmpRatios,
    fmpKeyMetrics,
    fmpIncome,
    fmpEV,
  ] = await Promise.all([
    getYahooData(symbol),
    getFinancialHistory(symbol),
    getDcf(symbol),
    getTargetConsensus(symbol),
    getRating(symbol),
    getAVOverview(symbol),
    getRatios(symbol),
    getKeyMetrics(symbol),
    getIncomeStatement(symbol),
    getEnterpriseValue(symbol),
  ]);

  const epsTTM = avOverview?.eps ?? yahooData.eps;
  const bvpsRaw = avOverview?.bookValuePerShare ?? yahooData.bookValuePerShare;
  const dividendPerShare = avOverview?.dividendPerShare ?? yahooData.dividendPerShare;
  const ebitdaTTM = fmpIncome?.ebitda ?? avOverview?.ebitda ?? yahooData.ebitda;
  const netDebtRaw =
    fmpEV?.enterpriseValue != null && fmpEV?.marketCap != null
      ? fmpEV.enterpriseValue - fmpEV.marketCap
      : undefined;

  // --- Through-cycle normalization ---------------------------------------
  // Runs entirely in the REPORTING currency, because every input it derives is
  // either a ratio (margins, growth, volatility) or a company-level cash figure
  // reported in that currency. Conversion to the trading currency happens after.
  const normalized = normalizeInputs({
    history,
    revenueTTM: yahooData.totalRevenue,
    freeCashflowTTM: yahooData.freeCashflow,
    operatingCashflowTTM: yahooData.operatingCashflow,
    ebitdaTTM,
    epsTTM,
    bvps: bvpsRaw,
    sharesOutstanding: yahooData.sharesOutstanding,
    netDebt: netDebtRaw,
    beta: avOverview?.beta,
    earningsGrowthTTM: yahooData.earningsGrowthRate,
    revenueGrowthTTM: yahooData.revenueGrowthRate,
    analystLongTermGrowth: yahooData.analystLongTermGrowth,
  });

  // --- Currency & ADR adjustment for total-company figures ----------------
  const priceCurrency = (yahooData.currency || "USD").toUpperCase();
  const finCurrency = (yahooData.financialCurrency || priceCurrency).toUpperCase();
  const needsCurrencyConversion = finCurrency !== priceCurrency;

  let fxRate = 1;
  if (needsCurrencyConversion) {
    fxRate = await getExchangeRate(finCurrency, priceCurrency);
  }

  const adjustedFCF =
    normalized.freeCashflow != null ? normalized.freeCashflow * fxRate : undefined;
  const adjustedEbitda = normalized.ebitda != null ? normalized.ebitda * fxRate : undefined;
  const adjustedNetDebt = normalized.netDebt != null ? normalized.netDebt * fxRate : undefined;

  // For ADRs, sharesOutstanding is total ordinary shares, not ADR-equivalent.
  // marketCap / price gives the effective trading-unit share count.
  let effectiveShares = yahooData.sharesOutstanding;
  if (yahooData.marketCap && yahooData.currentPrice && yahooData.currentPrice > 0) {
    const impliedShares = Math.round(yahooData.marketCap / yahooData.currentPrice);
    if (effectiveShares && needsCurrencyConversion) {
      effectiveShares = impliedShares;
    } else if (effectiveShares && impliedShares > 0) {
      const ratio = effectiveShares / impliedShares;
      if (ratio > 1.5 || ratio < 0.67) effectiveShares = impliedShares;
    } else if (!effectiveShares) {
      effectiveShares = impliedShares;
    }
  }

  const computedModels = buildDCFModels({
    freeCashflow: adjustedFCF,
    eps: normalized.eps,
    bvps: normalized.bvps,
    earningsGrowthRate: normalized.growthRate,
    sharesOutstanding: effectiveShares,
    dividendPerShare,
    ebitda: adjustedEbitda,
    netDebt: adjustedNetDebt,
    discountRate: normalized.discountRate,
    terminalGrowth: normalized.terminalGrowth,
  });

  // --- Assemble the source list ------------------------------------------
  const dcfSources: SourceValue[] = computedModels.map((m) => ({
    source: m.source,
    value: m.value,
    model: m.model,
    methodology: m.methodology,
    annotation: m.annotation,
    weight: m.weight,
  }));

  // Third-party DCF values share one weight bucket, so a provider that returns
  // four near-identical numbers cannot outvote the internal model set.
  const externalCount = fmpDcfList.length;
  for (const d of fmpDcfList) {
    dcfSources.push({
      source: "FMP",
      value: Math.round(d.value * 100) / 100,
      model: d.model,
      methodology: "第三方 DCF 估值（独立视角，与内部模型共享 10% 权重）",
      annotation: "external",
      weight: MODEL_WEIGHTS.external / externalCount,
    });
  }

  const priceAnchor = yahooData.currentPrice ?? yahooData.targetMean ?? undefined;
  const flags = markReliability(
    dcfSources.map((s) => s.value),
    priceAnchor
  );
  dcfSources.forEach((s, i) => {
    s.reliable = flags[i];
  });

  const reliableValues = dcfSources.filter((s) => s.reliable !== false).map((s) => s.value);
  const dcfAvg = weightedFairValue(dcfSources) ?? safeAvg(reliableValues);

  // --- Target Price sources ----------------------------------------------
  const targetSources: TargetPriceSource[] = [];

  if (yahooData.targetMean != null) {
    targetSources.push({
      source: "Yahoo Finance 分析师共识",
      high: yahooData.targetHigh,
      low: yahooData.targetLow,
      mean: yahooData.targetMean,
      median: yahooData.targetMedian,
      count: yahooData.analystCount,
    });
  }
  if (fmpConsensus?.targetConsensus != null) {
    targetSources.push({
      source: "FMP 分析师共识",
      high: fmpConsensus.targetHigh,
      low: fmpConsensus.targetLow,
      mean: fmpConsensus.targetConsensus,
      median: fmpConsensus.targetMedian,
    });
  }
  if (avOverview?.analystTargetPrice != null) {
    targetSources.push({
      source: "Alpha Vantage 分析师目标",
      mean: avOverview.analystTargetPrice,
    });
  }

  const allMeans = targetSources.map((s) => s.mean);
  const allLows = targetSources.map((s) => s.low);
  const allHighs = targetSources.map((s) => s.high);

  const currentPrice = yahooData.currentPrice;
  const targetAvg = safeAvg(allMeans);

  let vsAvgDcf: number | undefined;
  let vsAvgTarget: number | undefined;
  if (currentPrice != null && dcfAvg != null && dcfAvg > 0) {
    vsAvgDcf = Math.round(((currentPrice - dcfAvg) / dcfAvg) * 10000) / 100;
  }
  if (currentPrice != null && targetAvg != null && targetAvg > 0) {
    vsAvgTarget = Math.round(((currentPrice - targetAvg) / targetAvg) * 10000) / 100;
  }

  // --- Valuation quality --------------------------------------------------
  // The single fair-value number hides how much the models actually agree.
  // Dispersion plus history depth drives a confidence label and an
  // interquartile band, so a wide disagreement is visible instead of averaged away.
  const sortedReliable = [...reliableValues].sort((a, b) => a - b);
  const p25 = percentile(sortedReliable, 0.25);
  const p75 = percentile(sortedReliable, 0.75);
  const medianReliable = percentile(sortedReliable, 0.5);
  const dispersion =
    p25 != null && p75 != null && medianReliable != null && medianReliable > 0
      ? (p75 - p25) / medianReliable
      : undefined;

  const years = normalized.diagnostics.yearsOfData;
  let confidence: ValuationQuality["confidence"] = "medium";
  if (years < 3 || reliableValues.length < 3 || (dispersion != null && dispersion > 1.0)) {
    confidence = "low";
  } else if (years >= 5 && reliableValues.length >= 5 && dispersion != null && dispersion < 0.45) {
    confidence = "high";
  }

  const valuationQuality: ValuationQuality = {
    confidence,
    years_of_data: years,
    history_provider: normalized.diagnostics.historyProvider,
    model_count: reliableValues.length,
    dispersion: dispersion != null ? Math.round(dispersion * 100) / 100 : undefined,
    fair_value_low: p25 != null ? Math.round(p25 * 100) / 100 : undefined,
    fair_value_high: p75 != null ? Math.round(p75 * 100) / 100 : undefined,
    normalized_fcf: normalized.freeCashflow,
    ttm_fcf: normalized.freeCashflowTTM,
    owner_earnings: normalized.ownerEarnings,
    normalized_eps: normalized.eps,
    ttm_eps: normalized.epsTTM,
    growth_rate_used: normalized.growthRate,
    growth_rate_raw: normalized.growthRateRaw,
    discount_rate_used: normalized.discountRate,
    terminal_growth_used: normalized.terminalGrowth,
    fcf_volatility: normalized.diagnostics.fcfVolatility,
    earnings_volatility: normalized.diagnostics.earningsVolatility,
    capex_spike: normalized.diagnostics.capexSpike,
    capex_intensity_ttm: normalized.diagnostics.capexIntensityTTM,
    capex_intensity_median: normalized.diagnostics.capexIntensityMedian,
    growth_sources: normalized.diagnostics.growthSources,
    adjustments: normalized.diagnostics.adjustments,
  };

  const forwardPE = yahooData.forwardPE ?? avOverview?.forwardPE ?? fmpRatios?.forwardPE;

  let pegRatio: number | undefined =
    yahooData.pegRatio ?? avOverview?.pegRatio ?? fmpRatios?.pegRatio ?? fmpKeyMetrics?.pegRatio;
  if (pegRatio == null && forwardPE != null && normalized.growthRate != null) {
    const growthPct = normalized.growthRate * 100;
    if (growthPct > 0) {
      const computed = forwardPE / growthPct;
      if (isFinite(computed) && computed > 0 && computed < 15) {
        pegRatio = Math.round(computed * 100) / 100;
      }
    }
  }

  let recommendation = yahooData.recommendation;
  if (!recommendation && fmpRating?.ratingRecommendation) {
    recommendation = fmpRating.ratingRecommendation.toLowerCase();
  }

  return {
    ticker: symbol,
    company_name: yahooData.companyName,
    current_price: currentPrice,
    currency: yahooData.currency || "USD",
    dcf_fair_value: {
      sources: dcfSources,
      avg: dcfAvg,
      min: safeMin(reliableValues),
      max: safeMax(reliableValues),
    },
    target_price: {
      sources: targetSources,
      avg: targetAvg,
      min: safeMin(allLows),
      max: safeMax(allHighs),
    },
    forward_pe: { value: forwardPE },
    peg_ratio: { value: pegRatio },
    recommendation,
    valuation_quality: valuationQuality,
    deviations: {
      vs_avg_dcf: vsAvgDcf,
      vs_avg_target: vsAvgTarget,
      peg_signal: pegSignal(pegRatio),
    },
    last_updated: new Date().toISOString(),
  };
}
