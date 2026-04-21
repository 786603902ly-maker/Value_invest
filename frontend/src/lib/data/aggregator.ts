import { getYahooData } from "./yahoo";
import { getDcf, getTargetConsensus, getRating, getRatios, getKeyMetrics, getIncomeStatement, getEnterpriseValue } from "./fmp";
import { getAVOverview } from "./alpha-vantage";
import { buildDCFModels } from "./dcf-models";
import type { StockValuation, SourceValue, TargetPriceSource } from "@/types/stock";

function safeAvg(values: (number | undefined)[]): number | undefined {
  const clean = values.filter((v): v is number => v != null);
  if (!clean.length) return undefined;
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 100) / 100;
}

/**
 * Conservative-weighted average DCF:
 * - The "conservative but reasonable" anchor value gets >50% weight
 * - Anchor = the conservative FCF DCF if available; else the lowest reliable value
 * - Other reliable values share the remaining weight equally
 * This reflects a conservative investor's preference.
 */
function conservativeWeightedAvg(sources: SourceValue[]): number | undefined {
  const reliable = sources.filter((s) => s.reliable !== false);
  if (reliable.length === 0) return undefined;
  if (reliable.length === 1) return reliable[0].value;

  // Find anchor: prefer the dedicated "conservative" annotated model
  let anchor = reliable.find((s) => s.annotation === "conservative" && s.model?.includes("FCF"));
  if (!anchor) {
    // Fallback: the lowest non-pessimistic (not Graham Number floor) value
    const nonFloor = reliable.filter((s) => s.annotation !== "pessimistic");
    const pool = nonFloor.length > 0 ? nonFloor : reliable;
    anchor = pool.reduce((min, s) => (s.value < min.value ? s : min), pool[0]);
  }

  // Weight scheme: anchor 55%, remaining 45% shared equally across others
  const others = reliable.filter((s) => s !== anchor);
  if (others.length === 0) return Math.round(anchor.value * 100) / 100;

  const anchorWeight = 0.55;
  const otherWeight = 0.45 / others.length;
  const weighted = anchor.value * anchorWeight + others.reduce((sum, s) => sum + s.value * otherWeight, 0);
  return Math.round(weighted * 100) / 100;
}

function safeMin(values: (number | undefined)[]): number | undefined {
  const clean = values.filter((v): v is number => v != null);
  return clean.length ? Math.round(Math.min(...clean) * 100) / 100 : undefined;
}

function safeMax(values: (number | undefined)[]): number | undefined {
  const clean = values.filter((v): v is number => v != null);
  return clean.length ? Math.round(Math.max(...clean) * 100) / 100 : undefined;
}

function pegSignal(peg?: number): string | undefined {
  if (peg == null) return undefined;
  if (peg < 1) return "undervalued";
  if (peg <= 2) return "fair";
  return "overvalued";
}

export async function getFullValuation(symbol: string): Promise<StockValuation> {
  symbol = symbol.toUpperCase().trim();

  // Fetch all sources in parallel
  const [yahooData, fmpDcfList, fmpConsensus, fmpRating, avOverview, fmpRatios, fmpKeyMetrics, fmpIncome, fmpEV] = await Promise.all([
    getYahooData(symbol),
    getDcf(symbol),
    getTargetConsensus(symbol),
    getRating(symbol),
    getAVOverview(symbol),
    getRatios(symbol),
    getKeyMetrics(symbol),
    getIncomeStatement(symbol),
    getEnterpriseValue(symbol),
  ]);

  // Merge EPS/BookValue — prefer Alpha Vantage (more reliable for these), fallback to Yahoo
  const eps = avOverview?.eps ?? yahooData.eps;
  const bvps = avOverview?.bookValuePerShare ?? yahooData.bookValuePerShare;
  const dividendPerShare = avOverview?.dividendPerShare ?? yahooData.dividendPerShare;

  // Growth rate: Yahoo earningsTrend is generally more forward-looking
  const earningsGrowthRate = yahooData.earningsGrowthRate ?? yahooData.revenueGrowthRate;
  const earningsGrowthPct = earningsGrowthRate != null ? earningsGrowthRate * 100 : undefined;

  // EBITDA: prefer FMP income statement, fallback to Alpha Vantage
  const ebitda = fmpIncome?.ebitda ?? avOverview?.ebitda;
  // Net debt approximation: EV - Market Cap (if both available)
  const netDebt = fmpEV?.enterpriseValue != null && fmpEV?.marketCap != null
    ? fmpEV.enterpriseValue - fmpEV.marketCap
    : undefined;

  // --- Build computed DCF models ---
  const computedModels = buildDCFModels({
    freeCashflow: yahooData.freeCashflow,
    eps,
    bvps,
    earningsGrowthPct,
    earningsGrowthRate,
    sharesOutstanding: yahooData.sharesOutstanding,
    dividendPerShare,
    ebitda,
    netDebt,
  });

  // Sanity reference band: use analyst target low/high if available, else 0.4x–2.5x of current price
  const priceAnchor =
    yahooData.targetMean ?? yahooData.currentPrice ?? undefined;
  const bandLow =
    yahooData.targetLow != null
      ? yahooData.targetLow * 0.6
      : priceAnchor != null
      ? priceAnchor * 0.35
      : undefined;
  const bandHigh =
    yahooData.targetHigh != null
      ? yahooData.targetHigh * 1.5
      : priceAnchor != null
      ? priceAnchor * 2.8
      : undefined;

  const isReliable = (v: number): boolean => {
    if (bandLow == null || bandHigh == null) return true;
    return v >= bandLow && v <= bandHigh;
  };

  // --- DCF Fair Value sources (all included, but tagged with reliability) ---
  const dcfSources: SourceValue[] = computedModels.map((m) => ({
    source: m.source,
    value: m.value,
    model: m.model,
    methodology: m.methodology,
    annotation: m.annotation,
    reliable: isReliable(m.value),
  }));

  // Add FMP DCF sources (external, always considered reliable)
  for (const d of fmpDcfList) {
    dcfSources.push({
      source: "FMP",
      value: Math.round(d.value * 100) / 100,
      model: d.model,
      methodology: "FMP Discounted Cash Flow model",
      annotation: "external",
      reliable: true,
    });
  }

  // Average ONLY reliable values (filters out extreme outliers like Graham Formula on high-growth stocks)
  const reliableValues = dcfSources.filter((s) => s.reliable !== false).map((s) => s.value);
  const dcfValues = reliableValues.length > 0 ? reliableValues : dcfSources.map((s) => s.value);
  // Conservative-weighted average: anchor value gets >50% weight
  const dcfWeightedAvg = conservativeWeightedAvg(dcfSources);

  // --- Target Price sources ---
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

  // --- Deviations ---
  const currentPrice = yahooData.currentPrice;
  // Prefer conservative-weighted avg; fallback to simple avg if weighted not available
  const dcfAvg = dcfWeightedAvg ?? safeAvg(dcfValues);
  const targetAvg = safeAvg(allMeans);

  let vsAvgDcf: number | undefined;
  let vsAvgTarget: number | undefined;

  if (currentPrice != null && dcfAvg != null) {
    vsAvgDcf = Math.round(((currentPrice - dcfAvg) / dcfAvg) * 10000) / 100;
  }
  if (currentPrice != null && targetAvg != null) {
    vsAvgTarget = Math.round(((currentPrice - targetAvg) / targetAvg) * 10000) / 100;
  }

  // Forward PE: Yahoo → AV → FMP ratios
  const forwardPE = yahooData.forwardPE ?? avOverview?.forwardPE ?? fmpRatios?.forwardPE;

  // PEG: multi-source fallback chain for stability
  // Yahoo (primary) → Alpha Vantage → FMP ratios-ttm → FMP key-metrics-ttm → computed from forwardPE/growth
  let pegRatio: number | undefined =
    yahooData.pegRatio ?? avOverview?.pegRatio ?? fmpRatios?.pegRatio ?? fmpKeyMetrics?.pegRatio;
  // Last-resort: compute PEG from forwardPE and growth rate if all authoritative sources missing
  if (pegRatio == null && forwardPE != null && earningsGrowthPct != null && earningsGrowthPct > 0) {
    const computed = forwardPE / earningsGrowthPct;
    if (isFinite(computed) && computed > 0 && computed < 15) {
      pegRatio = Math.round(computed * 100) / 100;
    }
  }

  // Recommendation
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
      min: safeMin(dcfValues),
      max: safeMax(dcfValues),
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
    deviations: {
      vs_avg_dcf: vsAvgDcf,
      vs_avg_target: vsAvgTarget,
      peg_signal: pegSignal(pegRatio),
    },
    last_updated: new Date().toISOString(),
  };
}
