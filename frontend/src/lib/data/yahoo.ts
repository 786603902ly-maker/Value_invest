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
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  // For DCF models
  sharesOutstanding?: number;
  freeCashflow?: number;
  earningsGrowthRate?: number;  // decimal, e.g. 0.15
  revenueGrowthRate?: number;
  eps?: number;
  bookValuePerShare?: number;
  dividendPerShare?: number;
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
        "earningsTrend",
      ],
    });

    const price = quote.price;
    const financial = quote.financialData;
    const stats = quote.defaultKeyStatistics;
    const summary = quote.summaryDetail;
    const earningsTrend = quote.earningsTrend;

    // Earnings growth: try multiple sources
    let earningsGrowthRate: number | undefined = financial?.earningsGrowth ?? undefined;
    if (earningsGrowthRate == null && earningsTrend?.trend) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fiveYr = earningsTrend.trend.find((t: any) => t.period === "+5y");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oneYr = earningsTrend.trend.find((t: any) => t.period === "+1y");
      earningsGrowthRate = fiveYr?.growth ?? oneYr?.growth ?? undefined;
    }

    const revenueGrowthRate: number | undefined = financial?.revenueGrowth ?? undefined;
    const freeCashflow: number | undefined = financial?.freeCashflow ?? undefined;
    const sharesOutstanding: number | undefined = stats?.sharesOutstanding ?? undefined;
    const forwardPE: number | undefined = summary?.forwardPE ?? stats?.forwardPE ?? undefined;

    // PEG: try direct, then compute
    let pegRatio: number | undefined = stats?.pegRatio ?? undefined;
    if (pegRatio == null && forwardPE != null && earningsGrowthRate != null && earningsGrowthRate > 0) {
      pegRatio = Math.round((forwardPE / (earningsGrowthRate * 100)) * 100) / 100;
    }

    // EPS and book value for Graham models
    const eps: number | undefined = stats?.trailingEps ?? stats?.forwardEps ?? undefined;
    const bookValuePerShare: number | undefined = stats?.bookValue ?? undefined;
    const dividendPerShare: number | undefined = summary?.dividendRate ?? undefined;

    return {
      ticker: symbol.toUpperCase(),
      companyName: price?.shortName || price?.longName,
      currentPrice: financial?.currentPrice ?? price?.regularMarketPrice ?? undefined,
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
      marketCap: price?.marketCap ?? undefined,
      fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? undefined,
      sharesOutstanding,
      freeCashflow,
      earningsGrowthRate,
      revenueGrowthRate,
      eps,
      bookValuePerShare,
      dividendPerShare,
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
