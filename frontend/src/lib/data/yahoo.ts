import yahooFinance from "yahoo-finance2";

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
      ],
    });

    const price = quote.price;
    const financial = quote.financialData;
    const stats = quote.defaultKeyStatistics;
    const summary = quote.summaryDetail;

    return {
      ticker: symbol.toUpperCase(),
      companyName: price?.shortName || price?.longName,
      currentPrice:
        financial?.currentPrice ?? price?.regularMarketPrice ?? undefined,
      currency: price?.currency ?? "USD",
      targetHigh: financial?.targetHighPrice ?? undefined,
      targetLow: financial?.targetLowPrice ?? undefined,
      targetMean: financial?.targetMeanPrice ?? undefined,
      targetMedian: financial?.targetMedianPrice ?? undefined,
      analystCount: financial?.numberOfAnalystOpinions ?? undefined,
      forwardPE: summary?.forwardPE ?? stats?.forwardPE ?? undefined,
      trailingPE: summary?.trailingPE ?? undefined,
      pegRatio: stats?.pegRatio ?? undefined,
      recommendation: financial?.recommendationKey ?? undefined,
      sector: undefined,
      marketCap: price?.marketCap ?? undefined,
      fiftyTwoWeekHigh: summary?.fiftyTwoWeekHigh ?? undefined,
      fiftyTwoWeekLow: summary?.fiftyTwoWeekLow ?? undefined,
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
