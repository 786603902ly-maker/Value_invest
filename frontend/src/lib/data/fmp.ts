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

export interface FmpRatios {
  peRatio?: number;
  pegRatio?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  forwardPE?: number;
}

async function fmpFetch<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  const base = FMP_BASE;
  const key = getKey();
  if (!key) return null;

  const url = new URL(`${base}${path}`);
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

  // Fetch all FMP DCF endpoints in parallel for speed
  const [dcfData, advData, histData, outlookData] = await Promise.all([
    // Standard DCF (baseline)
    fmpFetch<Array<{ dcf?: number; "Stock Price"?: number }>>(
      `/discounted-cash-flow/${symbol}`
    ),
    // Advanced Levered DCF
    fmpFetch<Array<{ dcf?: number }>>(
      `/advanced_discounted_cash_flow`,
      { symbol }
    ),
    // Historical DCF — smoothed average of recent quarters
    fmpFetch<Array<{ dcf?: number; date?: string }>>(
      `/historical-discounted-cash-flow-statement/${symbol}`,
      { limit: "4" }
    ),
    // Company outlook — returns yet another independent DCF figure
    fmpFetch<{ dcf?: number; rating?: { ratingScore?: number }; financialsAnnual?: { income?: Array<Record<string, number>> } }>(
      `/company-outlook`,
      { symbol }
    ),
  ]);

  if (Array.isArray(dcfData) && dcfData.length > 0 && dcfData[0].dcf != null) {
    results.push({
      source: "FMP",
      value: dcfData[0].dcf!,
      model: "FMP Discounted Cash Flow",
    });
  }

  if (Array.isArray(advData) && advData.length > 0 && advData[0].dcf != null) {
    results.push({
      source: "FMP",
      value: advData[0].dcf!,
      model: "FMP Advanced Levered DCF",
    });
  }

  if (Array.isArray(histData) && histData.length > 0) {
    const recent = histData.slice(0, 4).map((r) => r.dcf).filter((v): v is number => v != null);
    if (recent.length > 0) {
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg > 0) {
        results.push({
          source: "FMP",
          value: Math.round(avg * 100) / 100,
          model: "FMP Historical DCF (4Q avg)",
        });
      }
    }
  }

  // Company outlook DCF — often returns a slightly different value from the standard endpoint
  if (outlookData && typeof outlookData === "object" && !Array.isArray(outlookData) && outlookData.dcf != null && outlookData.dcf > 0) {
    const existing = results.map((r) => r.value);
    // Only add if meaningfully different from existing values (>2% apart)
    const isDuplicate = existing.some((v) => Math.abs(v - outlookData.dcf!) / outlookData.dcf! < 0.02);
    if (!isDuplicate) {
      results.push({
        source: "FMP",
        value: Math.round(outlookData.dcf * 100) / 100,
        model: "FMP Company Outlook DCF",
      });
    }
  }

  return results;
}

/**
 * Fetch FMP financial growth data for EV/EBITDA based fair value computation
 */
export async function getEnterpriseValue(symbol: string): Promise<{
  evToEbitda?: number;
  marketCap?: number;
  enterpriseValue?: number;
} | null> {
  const data = await fmpFetch<Array<Record<string, number | null>>>(
    `/enterprise-values/${symbol}`,
    { limit: "1" }
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const r = data[0];
  const parse = (v: number | null | undefined): number | undefined => {
    if (v == null || !isFinite(v)) return undefined;
    return v;
  };
  return {
    marketCap: parse(r.marketCapitalization as number),
    enterpriseValue: parse(r.enterpriseValue as number),
  };
}

/**
 * Fetch FMP income statement data for EBITDA-based valuation
 */
export async function getIncomeStatement(symbol: string): Promise<{
  ebitda?: number;
  netIncome?: number;
  revenue?: number;
} | null> {
  const data = await fmpFetch<Array<Record<string, number | null>>>(
    `/income-statement/${symbol}`,
    { limit: "1" }
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const r = data[0];
  return {
    ebitda: r.ebitda != null && isFinite(r.ebitda as number) ? (r.ebitda as number) : undefined,
    netIncome: r.netIncome != null && isFinite(r.netIncome as number) ? (r.netIncome as number) : undefined,
    revenue: r.revenue != null && isFinite(r.revenue as number) ? (r.revenue as number) : undefined,
  };
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

/**
 * Get key financial ratios from FMP (TTM) — used as fallback for PEG / forward PE
 * when Yahoo's data is missing.
 */
export async function getRatios(symbol: string): Promise<FmpRatios | null> {
  const data = await fmpFetch<Array<Record<string, number | null>>>(
    `/ratios-ttm/${symbol}`
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const r = data[0];
  const parse = (v: number | null | undefined): number | undefined => {
    if (v == null || !isFinite(v)) return undefined;
    return Math.round(v * 100) / 100;
  };
  return {
    peRatio: parse(r.peRatioTTM as number),
    pegRatio: parse(r.pegRatioTTM as number),
    priceToBookRatio: parse(r.priceToBookRatioTTM as number),
    priceToSalesRatio: parse(r.priceToSalesRatioTTM as number),
  };
}

/**
 * FMP company key metrics — another PEG / forwardPE source.
 */
export async function getKeyMetrics(symbol: string): Promise<{ pegRatio?: number; peRatio?: number } | null> {
  const data = await fmpFetch<Array<Record<string, number | null>>>(
    `/key-metrics-ttm/${symbol}`
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const r = data[0];
  const parse = (v: number | null | undefined): number | undefined => {
    if (v == null || !isFinite(v)) return undefined;
    return Math.round(v * 100) / 100;
  };
  return {
    pegRatio: parse(r.pegRatioTTM as number),
    peRatio: parse(r.peRatioTTM as number),
  };
}
