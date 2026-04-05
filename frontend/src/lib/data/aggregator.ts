import { getYahooData } from "./yahoo";
import { getDcf, getTargetConsensus, getRating } from "./fmp";
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

  // Fetch from all sources in parallel
  const [yahooData, fmpDcfList, fmpConsensus, fmpRating] = await Promise.all([
    getYahooData(symbol),
    getDcf(symbol),
    getTargetConsensus(symbol),
    getRating(symbol),
  ]);

  // --- DCF Fair Value ---
  const dcfSources: SourceValue[] = [];

  // Yahoo-computed DCF (simple model based on FCF + growth)
  if (yahooData.dcfValue != null) {
    dcfSources.push({
      source: "Yahoo Finance (FCF Model)",
      value: yahooData.dcfValue,
      model: "Simple DCF (5yr FCF projection)",
    });
  }

  // FMP DCF sources
  for (const d of fmpDcfList) {
    dcfSources.push({
      source: d.source,
      value: Math.round(d.value * 100) / 100,
      model: d.model,
    });
  }

  const dcfValues = dcfSources.map((s) => s.value);

  // --- Target Price ---
  const targetSources: TargetPriceSource[] = [];

  if (yahooData.targetMean != null) {
    targetSources.push({
      source: "Yahoo Finance Consensus",
      high: yahooData.targetHigh,
      low: yahooData.targetLow,
      mean: yahooData.targetMean,
      median: yahooData.targetMedian,
      count: yahooData.analystCount,
    });
  }

  if (fmpConsensus?.targetConsensus != null) {
    targetSources.push({
      source: "FMP Analyst Consensus",
      high: fmpConsensus.targetHigh,
      low: fmpConsensus.targetLow,
      mean: fmpConsensus.targetConsensus,
      median: fmpConsensus.targetMedian,
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

  // --- Recommendation ---
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
    forward_pe: {
      value: yahooData.forwardPE,
    },
    peg_ratio: {
      value: yahooData.pegRatio,
    },
    recommendation,
    deviations: {
      vs_avg_dcf: vsAvgDcf,
      vs_avg_target: vsAvgTarget,
      peg_signal: pegSignal(yahooData.pegRatio),
    },
    last_updated: new Date().toISOString(),
  };
}
