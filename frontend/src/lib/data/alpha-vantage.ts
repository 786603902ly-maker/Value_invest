const AV_BASE = "https://www.alphavantage.co/query";

function getKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY || "";
}

export interface AVOverview {
  eps?: number;
  bookValuePerShare?: number;
  pegRatio?: number;
  forwardPE?: number;
  analystTargetPrice?: number;
  beta?: number;
  dividendPerShare?: number;
  dividendYield?: number;
  sharesOutstanding?: number;
  revenueGrowthTTM?: number;
  ebitda?: number;
  marketCap?: number;
  grossProfitTTM?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function avFetch<T>(params: Record<string, string>): Promise<T | null> {
  const key = getKey();
  if (!key) return null;

  const url = new URL(AV_BASE);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: { revalidate: 3600 } as any,
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Alpha Vantage returns error info in Note or Information key when rate-limited
    if (data.Note || data.Information) return null;
    return data as T;
  } catch {
    return null;
  }
}

export async function getAVOverview(symbol: string): Promise<AVOverview | null> {
  const data = await avFetch<Record<string, string>>({ function: "OVERVIEW", symbol });
  if (!data || !data.Symbol) return null;

  const parse = (v: string | undefined): number | undefined => {
    if (!v || v === "None" || v === "-" || v === "0") return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  return {
    eps: parse(data.EPS),
    bookValuePerShare: parse(data.BookValue),
    pegRatio: parse(data.PEGRatio),
    forwardPE: parse(data.ForwardPE),
    analystTargetPrice: parse(data.AnalystTargetPrice),
    beta: parse(data.Beta),
    dividendPerShare: parse(data.DividendPerShare),
    dividendYield: parse(data.DividendYield),
    sharesOutstanding: parse(data.SharesOutstanding),
    ebitda: parse(data.EBITDA),
    marketCap: parse(data.MarketCapitalization),
    grossProfitTTM: parse(data.GrossProfitTTM),
  };
}
