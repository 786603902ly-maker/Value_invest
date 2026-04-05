import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface YahooData {
  ticker: string;
  companyName?: string;
  currentPrice?: number;
  currency?: string;
  targetHigh?: number;
  targetLow?: number;
  targetMean?: number;
  targetMedian?: number;
  analystCount?: number;
  forwardPE?: number;
  trailingPE?: number;
  pegRatio?: number;
  recommendation?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sharesOutstanding?: number;
  freeCashflow?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;
  dcfValue?: number;
}

/**
 * Simple DCF: project FCF for 5 years using growth rate, then terminal value at 3% perpetual growth.
 * Discount rate = 10%.
 */
function computeSimpleDCF(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number
): number | undefined {
  if (!freeCashflow || freeCashflow <= 0 || !sharesOutstanding || sharesOutstanding <= 0) {
    return undefined;
  }
  const discountRate = 0.10;
  const terminalGrowth = 0.03;
  const projectionYears = 5;

  // Cap growth rate to reasonable range
  const g = Math.max(-0.2, Math.min(growthRate, 0.5));

  let totalPV = 0;
  let lastFCF = freeCashflow;

  for (let y = 1; y <= projectionYears; y++) {
    lastFCF = lastFCF * (1 + g);
    totalPV += lastFCF / Math.pow(1 + discountRate, y);
  }

  // Terminal value (Gordon Growth Model)
  const terminalValue = (lastFCF * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  totalPV += terminalValue / Math.pow(1 + discountRate, projectionYears);

  const fairValue = totalPV / sharesOutstanding;
  return Math.round(fairValue * 100) / 100;
}

export async function getYahooData(symbol: string): Promise<YahooData> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote: any = await yahooFinance.quoteSummary(symbol, {
      modules: [
        "price",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "recommendationTrend",
        "earningsTrend",
      ],
    });

    const price = quote.price;
    const financial = quote.financialData;
    const stats = quote.defaultKeyStatistics;
    const summary = quote.summaryDetail;
    const earningsTrend = quote.earningsTrend;

    const currentPrice = financial?.currentPrice ?? price?.regularMarketPrice ?? undefined;
    const freeCashflow = financial?.freeCashflow ?? undefined;
    const sharesOutstanding = stats?.sharesOutstanding ?? price?.sharesOutstanding ?? undefined;

    // Get earnings growth from earningsTrend or financialData
    let earningsGrowth = financial?.earningsGrowth ?? undefined;
    const revenueGrowth = financial?.revenueGrowth ?? undefined;

    // Try to get forward earnings growth from earningsTrend
    if (earningsGrowth == null && earningsTrend?.trend) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fiveYearTrend = earningsTrend.trend.find((t: any) => t.period === "+5y");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oneYearTrend = earningsTrend.trend.find((t: any) => t.period === "+1y");
      if (fiveYearTrend?.growth != null) {
        earningsGrowth = fiveYearTrend.growth;
      } else if (oneYearTrend?.growth != null) {
        earningsGrowth = oneYearTrend.growth;
      }
    }

    // Compute PEG from forward PE and earnings growth if not directly available
    let pegRatio = stats?.pegRatio ?? undefined;
    const forwardPE = summary?.forwardPE ?? stats?.forwardPE ?? undefined;
    if (pegRatio == null && forwardPE != null && earningsGrowth != null && earningsGrowth > 0) {
      pegRatio = Math.round((forwardPE / (earningsGrowth * 100)) * 100) / 100;
    }

    // Compute simple DCF fair value
    let dcfValue: number | undefined;
    const growthForDCF = earningsGrowth ?? revenueGrowth;
    if (freeCashflow != null && growthForDCF != null && sharesOutstanding != null) {
      dcfValue = computeSimpleDCF(freeCashflow, growthForDCF, sharesOutstanding);
    }

    return {
      ticker: symbol.toUpperCase(),
      companyName: price?.shortName || price?.longName,
      currentPrice,
      currency: price?.currency ?? "USD",
      targetHigh: financial?.targetHighPrice ?? undefined,
      targetLow: financial?.targetLowPrice ?? undefined,
      targetMean: financial?.targetMeanPrice ?? undefined,
      targetMedian: financial?.targetMedianPrice ?? undefined,
      analystCount: financial?.numberOfAnalystOpinions ?? undefined,
      forwardPE,
      trailingPE: summary?.trailingPE ?? undefined,
      pegRatio,
      recommendation: financial?.recommendationKey ?? undefined,
      sector: undefined,
      marketCap: price?.marketCap ?? undefined,
      fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? undefined,
      sharesOutstanding,
      freeCashflow,
      earningsGrowth,
      revenueGrowth,
      dcfValue,
    };
  } catch (error) {
    console.error(`[Yahoo] Error fetching ${symbol}:`, error);
    return { ticker: symbol.toUpperCase() };
  }
}

export async function searchYahoo(
  query: string
): Promise<{ symbol: string; name: string; exchange?: string }[]> {
  try {
    const results = await yahooFinance.search(query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((results as any).quotes || [])
      .filter((q: Record<string, unknown>) => q.symbol)
      .slice(0, 10)
      .map((q: Record<string, unknown>) => ({
        symbol: q.symbol as string,
        name: ((q.shortname || q.longname || "") as string),
        exchange: q.exchange as string | undefined,
      }));
  } catch {
    return [];
  }
}
