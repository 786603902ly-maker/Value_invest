import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface YahooData {
  ticker: string;
  companyName?: string;
  currentPrice?: number;
  currency?: string;
  financialCurrency?: string;
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
  operatingCashflow?: number;
  totalRevenue?: number;
  ebitda?: number;
  earningsGrowthRate?: number;  // decimal, e.g. 0.15
  revenueGrowthRate?: number;
  /** Analyst long-range (+5y) earnings growth estimate, decimal. */
  analystLongTermGrowth?: number;
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

    // Most-recent-period YoY earnings growth. Kept as ONE input to the growth
    // normalization, never as the sole ten-year compounding assumption.
    const earningsGrowthRate: number | undefined = financial?.earningsGrowth ?? undefined;

    // Analyst long-range growth is tracked separately so the normalizer can use
    // it as an independent vote alongside the realized historical CAGRs.
    let analystLongTermGrowth: number | undefined;
    if (earningsTrend?.trend) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fiveYr = earningsTrend.trend.find((t: any) => t.period === "+5y");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oneYr = earningsTrend.trend.find((t: any) => t.period === "+1y");
      const raw = fiveYr?.growth ?? oneYr?.growth;
      if (typeof raw === "number" && isFinite(raw)) analystLongTermGrowth = raw;
    }

    const revenueGrowthRate: number | undefined = financial?.revenueGrowth ?? undefined;
    const freeCashflow: number | undefined = financial?.freeCashflow ?? undefined;
    const operatingCashflow: number | undefined = financial?.operatingCashflow ?? undefined;
    const totalRevenue: number | undefined = financial?.totalRevenue ?? undefined;
    const ebitda: number | undefined = financial?.ebitda ?? undefined;
    const sharesOutstanding: number | undefined = stats?.sharesOutstanding ?? undefined;
    const forwardPE: number | undefined = summary?.forwardPE ?? stats?.forwardPE ?? undefined;

    // PEG: PREFER Yahoo's raw trailingPegRatio / pegRatio directly. Do NOT compute as it's unreliable.
    // Yahoo-finance2 v3 normalizes these to numbers (fallback: try raw key).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPeg: any = stats?.trailingPegRatio ?? stats?.pegRatio;
    let pegRatio: number | undefined;
    if (typeof rawPeg === "number" && isFinite(rawPeg)) {
      pegRatio = Math.round(rawPeg * 100) / 100;
    } else if (rawPeg && typeof rawPeg === "object" && typeof rawPeg.raw === "number") {
      pegRatio = Math.round(rawPeg.raw * 100) / 100;
    }

    // EPS and book value for Graham models
    const eps: number | undefined = stats?.trailingEps ?? stats?.forwardEps ?? undefined;
    const bookValuePerShare: number | undefined = stats?.bookValue ?? undefined;
    const dividendPerShare: number | undefined = summary?.dividendRate ?? undefined;

    const financialCurrency: string | undefined =
      financial?.financialCurrency ?? price?.financialCurrency ?? undefined;

    return {
      ticker: symbol.toUpperCase(),
      companyName: price?.shortName || price?.longName,
      currentPrice: financial?.currentPrice ?? price?.regularMarketPrice ?? undefined,
      currency: price?.currency ?? "USD",
      financialCurrency,
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
      operatingCashflow,
      totalRevenue,
      ebitda,
      earningsGrowthRate,
      revenueGrowthRate,
      analystLongTermGrowth,
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

/**
 * 10-year US Treasury yield, as a decimal.
 *
 * Used as the perpetual growth rate and the CAPM risk-free rate. Terminal
 * growth above the risk-free rate implies the company eventually outgrows the
 * economy forever, which is why the standard convention caps it there — and
 * why a hard-coded 2.5% is not neutral when the 10-year sits near 4%: it is
 * a permanent haircut on every terminal value.
 *
 * ^TNX has been quoted both as a percentage (4.25) and as percentage x 10
 * (42.5) across data revisions, so both forms are normalized and anything
 * outside a plausible band falls back to the default.
 */
const RISK_FREE_FALLBACK = 0.04;
let riskFreeCache: { value: number; ts: number } | undefined;
const RISK_FREE_TTL_MS = 6 * 60 * 60 * 1000;

export async function getRiskFreeRate(): Promise<number> {
  if (riskFreeCache && Date.now() - riskFreeCache.ts < RISK_FREE_TTL_MS) {
    return riskFreeCache.value;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = await yahooFinance.quote("^TNX");
    let raw = q?.regularMarketPrice;
    if (typeof raw !== "number" || !isFinite(raw)) return RISK_FREE_FALLBACK;
    if (raw > 20) raw = raw / 10; // legacy "yield x 10" form
    if (raw < 1.5 || raw > 8) return RISK_FREE_FALLBACK;
    const value = Math.round((raw / 100) * 10000) / 10000;
    riskFreeCache = { value, ts: Date.now() };
    return value;
  } catch (error) {
    console.error("[Yahoo] Risk-free rate fetch failed:", error);
    return RISK_FREE_FALLBACK;
  }
}
