import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const rateCache = new Map<string, { rate: number; ts: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000;

export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const key = `${from}${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rate;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote: any = await yahooFinance.quote(`${from}${to}=X`);
    const rate = quote?.regularMarketPrice;
    if (typeof rate === "number" && isFinite(rate) && rate > 0) {
      rateCache.set(key, { rate, ts: Date.now() });
      return rate;
    }
  } catch {
    // fall through to fallback
  }

  const approx: Record<string, number> = {
    TWDUSD: 0.031, USDTWD: 32.2,
    KRWUSD: 0.00073, USDKRW: 1370,
    JPYUSD: 0.0065, USDJPY: 154,
    GBPUSD: 1.27, USDGBP: 0.79,
    EURUSD: 1.08, USDEUR: 0.93,
    CNYUSD: 0.14, USDCNY: 7.25,
    INRUSD: 0.012, USDINR: 83.5,
    BRLUSD: 0.20, USDBRL: 5.0,
    HKDUSD: 0.128, USDHKD: 7.8,
    CADUSD: 0.74, USDCAD: 1.36,
    AUDUSD: 0.66, USDAUD: 1.52,
    CHFUSD: 1.13, USDCHF: 0.89,
    ILSUSD: 0.27, USDILS: 3.7,
  };

  if (approx[key]) {
    console.warn(`[Currency] Using approximate fallback rate for ${from}→${to}`);
    return approx[key];
  }

  const inverseKey = `${to}${from}`;
  if (approx[inverseKey]) {
    console.warn(`[Currency] Using approximate fallback rate for ${from}→${to} (inverse)`);
    return 1 / approx[inverseKey];
  }

  console.warn(`[Currency] No rate found for ${from}→${to}, returning 1`);
  return 1;
}
