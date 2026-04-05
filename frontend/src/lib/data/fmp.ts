const FMP_BASE = "https://financialmodelingprep.com/api/v3";

function getKey(): string {
  return process.env.FMP_API_KEY || "";
}

export interface FmpDcf {
  source: string;
  value: number;
  model: string;
}

export interface FmpTargetConsensus {
  targetHigh?: number;
  targetLow?: number;
  targetConsensus?: number;
  targetMedian?: number;
}

export interface FmpRating {
  ratingRecommendation?: string;
  ratingScore?: number;
}

async function fmpFetch<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  const key = getKey();
  if (!key) return null;

  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getDcf(symbol: string): Promise<FmpDcf[]> {
  const results: FmpDcf[] = [];

  // Standard DCF
  const dcfData = await fmpFetch<Array<{ dcf?: number; "Stock Price"?: number }>>(
    `/discounted-cash-flow/${symbol}`
  );
  if (Array.isArray(dcfData) && dcfData.length > 0 && dcfData[0].dcf != null) {
    results.push({
      source: "FMP",
      value: dcfData[0].dcf!,
      model: "Discounted Cash Flow",
    });
  }

  // Advanced DCF
  const advData = await fmpFetch<Array<{ dcf?: number }>>(
    `/advanced_discounted_cash_flow`,
    { symbol }
  );
  if (Array.isArray(advData) && advData.length > 0 && advData[0].dcf != null) {
    results.push({
      source: "FMP",
      value: advData[0].dcf!,
      model: "Advanced Levered DCF",
    });
  }

  return results;
}

export async function getTargetConsensus(symbol: string): Promise<FmpTargetConsensus | null> {
  const data = await fmpFetch<Array<FmpTargetConsensus>>(
    `/price-target-consensus/${symbol}`
  );
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getRating(symbol: string): Promise<FmpRating | null> {
  const data = await fmpFetch<Array<FmpRating>>(`/rating/${symbol}`);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
