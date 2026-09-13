import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/**
 * One fiscal year of normalized financial statement data.
 * All absolute figures are in the company's REPORTING currency (financialCurrency),
 * not the trading currency — the caller converts.
 */
export interface AnnualFinancials {
  fiscalYear: number;
  date: string;
  revenue?: number;
  netIncome?: number;
  /** Net income excluding one-off items (Yahoo `normalizedIncome`). Preferred over netIncome. */
  normalizedIncome?: number;
  ebitda?: number;
  normalizedEbitda?: number;
  operatingCashFlow?: number;
  /** Capital expenditure as a POSITIVE number (Yahoo reports it negative). */
  capex?: number;
  freeCashFlow?: number;
  /** Depreciation & amortization — proxy for maintenance capex. */
  depreciation?: number;
  dilutedEPS?: number;
  dilutedShares?: number;
  stockholdersEquity?: number;
  totalDebt?: number;
  cash?: number;
  netDebt?: number;
}

/** Trailing-twelve-month figures pulled from the same time series. */
export interface TrailingFinancials {
  revenue?: number;
  netIncome?: number;
  normalizedIncome?: number;
  ebitda?: number;
  normalizedEbitda?: number;
  dilutedEPS?: number;
}

export interface FinancialHistory {
  /** Fiscal years, OLDEST first. */
  annual: AnnualFinancials[];
  trailing?: TrailingFinancials;
  /** Which provider actually supplied the annual series. */
  provider: "yahoo" | "fmp" | "none";
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && isFinite(v) ? v : undefined;

const abs = (v: unknown): number | undefined => {
  const n = num(v);
  return n == null ? undefined : Math.abs(n);
};

/**
 * Yahoo `fundamentalsTimeSeries` is the only Yahoo endpoint that still returns
 * multi-year statement data — the quoteSummary `*History` modules have been
 * effectively empty since Nov 2024, which is why this module exists separately.
 */
async function getYahooHistory(symbol: string, years: number): Promise<FinancialHistory> {
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - (years + 1));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [annualRaw, trailingRaw]: [any[], any[]] = await Promise.all([
    yahooFinance
      .fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "all" })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch(() => [] as any[]),
    yahooFinance
      .fundamentalsTimeSeries(symbol, { period1, type: "trailing", module: "financials" })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch(() => [] as any[]),
  ]);

  const annual: AnnualFinancials[] = (Array.isArray(annualRaw) ? annualRaw : [])
    .map((r) => {
      const d = r?.date instanceof Date ? r.date : new Date(r?.date);
      if (isNaN(d.getTime())) return null;
      const capex = abs(r.capitalExpenditure ?? r.capitalExpenditureReported);
      const ocf = num(r.operatingCashFlow);
      return {
        fiscalYear: d.getUTCFullYear(),
        date: d.toISOString().slice(0, 10),
        revenue: num(r.totalRevenue ?? r.operatingRevenue),
        netIncome: num(r.netIncome ?? r.netIncomeCommonStockholders),
        normalizedIncome: num(r.normalizedIncome),
        ebitda: num(r.EBITDA),
        normalizedEbitda: num(r.normalizedEBITDA),
        operatingCashFlow: ocf,
        capex,
        // Prefer the reported FCF; otherwise derive it so a missing field does not drop the year.
        freeCashFlow:
          num(r.freeCashFlow) ?? (ocf != null && capex != null ? ocf - capex : undefined),
        depreciation: num(
          r.depreciationAndAmortization ??
            r.depreciationAmortizationDepletion ??
            r.depreciationAndAmortizationInIncomeStatement
        ),
        dilutedEPS: num(r.dilutedEPS ?? r.basicEPS),
        dilutedShares: num(r.dilutedAverageShares ?? r.basicAverageShares),
        stockholdersEquity: num(r.stockholdersEquity),
        totalDebt: num(r.totalDebt),
        cash: num(r.cashCashEquivalentsAndShortTermInvestments ?? r.cashAndCashEquivalents),
        netDebt: num(r.netDebt),
      } as AnnualFinancials;
    })
    .filter((r): r is AnnualFinancials => r != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let trailing: TrailingFinancials | undefined;
  const tRows = Array.isArray(trailingRaw) ? trailingRaw : [];
  if (tRows.length) {
    const t = tRows[tRows.length - 1];
    trailing = {
      revenue: num(t.totalRevenue ?? t.operatingRevenue),
      netIncome: num(t.netIncome ?? t.netIncomeCommonStockholders),
      normalizedIncome: num(t.normalizedIncome),
      ebitda: num(t.EBITDA),
      normalizedEbitda: num(t.normalizedEBITDA),
      dilutedEPS: num(t.dilutedEPS ?? t.basicEPS),
    };
  }

  return { annual, trailing, provider: annual.length ? "yahoo" : "none" };
}

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

async function fmpList<T>(path: string, limit: number): Promise<T[]> {
  const key = process.env.FMP_API_KEY || "";
  if (!key) return [];
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", key);
  url.searchParams.set("limit", String(limit));
  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

/** FMP annual statements — fallback when Yahoo returns nothing (e.g. some ADRs). */
async function getFmpHistory(symbol: string, years: number): Promise<FinancialHistory> {
  type Row = Record<string, unknown>;
  const [income, cashflow, balance] = await Promise.all([
    fmpList<Row>(`/income-statement/${symbol}`, years),
    fmpList<Row>(`/cash-flow-statement/${symbol}`, years),
    fmpList<Row>(`/balance-sheet-statement/${symbol}`, years),
  ]);
  if (!income.length && !cashflow.length) return { annual: [], provider: "none" };

  const byDate = new Map<string, AnnualFinancials>();
  const touch = (date: string): AnnualFinancials => {
    let row = byDate.get(date);
    if (!row) {
      row = { fiscalYear: parseInt(date.slice(0, 4), 10), date };
      byDate.set(date, row);
    }
    return row;
  };

  for (const r of income) {
    const date = String(r.date ?? "").slice(0, 10);
    if (!date) continue;
    const row = touch(date);
    row.revenue = num(r.revenue);
    row.netIncome = num(r.netIncome);
    row.ebitda = num(r.ebitda);
    row.dilutedEPS = num(r.epsdiluted ?? r.eps);
    row.dilutedShares = num(r.weightedAverageShsOutDil ?? r.weightedAverageShsOut);
    row.depreciation = num(r.depreciationAndAmortization);
  }
  for (const r of cashflow) {
    const date = String(r.date ?? "").slice(0, 10);
    if (!date) continue;
    const row = touch(date);
    row.operatingCashFlow = num(r.operatingCashFlow ?? r.netCashProvidedByOperatingActivities);
    row.capex = abs(r.capitalExpenditure);
    row.freeCashFlow =
      num(r.freeCashFlow) ??
      (row.operatingCashFlow != null && row.capex != null
        ? row.operatingCashFlow - row.capex
        : undefined);
    row.depreciation = row.depreciation ?? num(r.depreciationAndAmortization);
  }
  for (const r of balance) {
    const date = String(r.date ?? "").slice(0, 10);
    if (!date) continue;
    const row = touch(date);
    row.stockholdersEquity = num(r.totalStockholdersEquity);
    row.totalDebt = num(r.totalDebt);
    row.cash = num(r.cashAndShortTermInvestments ?? r.cashAndCashEquivalents);
    row.netDebt = num(r.netDebt);
  }

  const annual = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { annual, provider: annual.length ? "fmp" : "none" };
}

/**
 * Multi-year annual financial history, oldest first.
 * Yahoo first (free, no key); FMP fills in when Yahoo returns too few years.
 */
export async function getFinancialHistory(
  symbol: string,
  years = 10
): Promise<FinancialHistory> {
  let yahoo: FinancialHistory = { annual: [], provider: "none" };
  try {
    yahoo = await getYahooHistory(symbol, years);
  } catch (error) {
    console.error(`[History] Yahoo fundamentals failed for ${symbol}:`, error);
  }

  // 4+ years is enough to compute a robust median; below that, try FMP for more depth.
  if (yahoo.annual.length >= 4) return yahoo;

  try {
    const fmp = await getFmpHistory(symbol, years);
    if (fmp.annual.length > yahoo.annual.length) {
      return { ...fmp, trailing: yahoo.trailing };
    }
  } catch (error) {
    console.error(`[History] FMP statements failed for ${symbol}:`, error);
  }
  return yahoo;
}
