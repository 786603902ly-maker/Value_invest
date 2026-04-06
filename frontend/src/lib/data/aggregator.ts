import { getYahooData } from "./yahoo";
import { getDcf, getTargetConsensus, getRating } from "./fmp";
import { getAVOverview } from "./alpha-vantage";
import { buildDCFModels } from "./dcf-models";
import type { StockValuation, SourceValue, TargetPriceSource } from "@/types/stock";

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

function pegSignal(peg?: number): string | undefined {
  if (peg == null) return undefined;
  if (peg < 1) return "undervalued";
  if (peg <= 2) return "fair";
  return "overvalued";
}

export async function getFullValuation(symbol: string): Promise<StockValuation> {
  symbol = symbol.toUpperCase().trim();

  // Fetch all sources in parallel
  const [yahooData, fmpDcfList, fmpConsensus, fmpRating, avOverview] = await Promise.all([
    getYahooData(symbol),
    getDcf(symbol),
    getTargetConsensus(symbol),
    getRating(symbol),
    getAVOverview(symbol),
  ]);

  // Merge EPS/BookValue — prefer Alpha Vantage (more reliable for these), fallback to Yahoo
  const eps = avOverview?.eps ?? yahooData.eps;
  const bvps = avOverview?.bookValuePerShare ?? yahooData.bookValuePerShare;
  const dividendPerShare = avOverview?.dividendPerShare ?? yahooData.dividendPerShare;

  // Growth rate: Yahoo earningsTrend is generally more forward-looking
  const earningsGrowthRate = yahooData.earningsGrowthRate ?? yahooData.revenueGrowthRate;
  const earningsGrowthPct = earningsGrowthRate != null ? earningsGrowthRate * 100 : undefined;

  // --- Build computed DCF models ---
  const computedModels = buildDCFModels({
    freeCashflow: yahooData.freeCashflow,
    eps,
    bvps,
    earningsGrowthPct,
    earningsGrowthRate,
    sharesOutstanding: yahooData.sharesOutstanding,
    dividendPerShare,
  });

  // --- DCF Fair Value sources ---
  const dcfSources: SourceValue[] = computedModels.map((m) => ({
    source: m.source,
    value: m.value,
    model: m.model,
    methodology: m.methodology,
    annotation: m.annotation,
  }));

  // Add FMP DCF sources (from API)
  for (const d of fmpDcfList) {
    dcfSources.push({
      source: "FMP",
      value: Math.round(d.value * 100) / 100,
      model: d.model,
      methodology: "FMP Discounted Cash Flow model",
      annotation: "external",
    });
  }

  const dcfValues = dcfSources.map((s) => s.value);

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
  const dcfAvg = safeAvg(dcfValues);
  const targetAvg = safeAvg(allMeans);

  let vsAvgDcf: number | undefined;
  let vsAvgTarget: number | undefined;

  if (currentPrice != null && dcfAvg != null) {
    vsAvgDcf = Math.round(((currentPrice - dcfAvg) / dcfAvg) * 10000) / 100;
  }
  if (currentPrice != null && targetAvg != null) {
    vsAvgTarget = Math.round(((currentPrice - targetAvg) / targetAvg) * 10000) / 100;
  }

  // Merge PEG — prefer AV
  const pegRatio = avOverview?.pegRatio ?? yahooData.pegRatio;
  const forwardPE = avOverview?.forwardPE ?? yahooData.forwardPE;

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
      avg: safeAvg(dcfValues),
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
