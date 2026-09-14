import type { AnnualFinancials, FinancialHistory } from "./history";

/**
 * Through-cycle input normalization.
 *
 * Problem this solves: every model in dcf-models.ts is driven by a handful of
 * scalar inputs (FCF, EPS, growth). When those scalars are taken straight from
 * the latest trailing-twelve-month snapshot, a single unusual period propagates
 * into every model at once, so model "diversification" gives no protection and
 * the whole fair-value stack moves together.
 *
 * Two concrete failure modes, both common in large-cap tech:
 *  1. A capex build-out cycle. FCF = operating cash flow - capex. A company that
 *     doubles capex to build data centres shows collapsing FCF while its
 *     operating cash flow keeps growing. A perpetuity model fed that trough FCF
 *     capitalises the trough forever.
 *  2. A one-off charge (litigation settlement, a one-time tax charge, a writedown).
 *     It drags trailing EPS down, which drags Graham Number, Graham Formula,
 *     Lynch and EPV down together, and it makes the most recent year-over-year
 *     earnings growth deeply negative, which then gets compounded for ten years.
 *
 * The fix is to derive each input from the multi-year distribution (median
 * margins, multi-source median growth) instead of from one period, and to bound
 * how far normalization is allowed to move away from the reported figure.
 */

export interface NormalizationDiagnostics {
  yearsOfData: number;
  historyProvider: string;
  fcfMarginTTM?: number;
  fcfMarginMedian?: number;
  capexIntensityTTM?: number;
  capexIntensityMedian?: number;
  capexSpike: boolean;
  /** Coefficient of variation of the annual FCF margin series. Reported for
   *  transparency, but NOT used to set the discount rate — see businessVolatility. */
  fcfVolatility?: number;
  /** Coefficient of variation of the annual net margin series. */
  earningsVolatility?: number;
  /** Coefficient of variation of the annual OPERATING CASH FLOW margin. */
  ocfVolatility?: number;
  /** The volatility actually used to price risk. */
  businessVolatility?: number;
  /** Median EV/EBITDA the market paid for this business, from its own history. */
  evEbitdaMedian?: number;
  growthSources: { label: string; value: number; forward: boolean }[];
  /** Human-readable notes rendered in the UI so the adjustment is auditable. */
  adjustments: string[];
}

export interface NormalizedInputs {
  /** Median EV/EBITDA from the company's own history, for the relative model. */
  historicalEvEbitda?: number;
  /** Business volatility used to price risk, passed through to the models. */
  volatility?: number;
  freeCashflow?: number;
  freeCashflowTTM?: number;
  ownerEarnings?: number;
  eps?: number;
  epsTTM?: number;
  ebitda?: number;
  ebitdaTTM?: number;
  bvps?: number;
  growthRate?: number;
  growthRateRaw?: number;
  discountRate: number;
  terminalGrowth: number;
  netDebt?: number;
  diagnostics: NormalizationDiagnostics;
}

export interface NormalizeParams {
  history: FinancialHistory;
  /** TTM figures from the quote snapshot, already in REPORTING currency. */
  revenueTTM?: number;
  freeCashflowTTM?: number;
  operatingCashflowTTM?: number;
  ebitdaTTM?: number;
  epsTTM?: number;
  bvps?: number;
  sharesOutstanding?: number;
  netDebt?: number;
  beta?: number;
  /** Single-period YoY growth from the quote snapshot (decimal). */
  earningsGrowthTTM?: number;
  revenueGrowthTTM?: number;
  /** Analyst long-range growth estimate from Yahoo earningsTrend (decimal). */
  analystLongTermGrowth?: number;
  /** Annual enterprise values, oldest first, for the historical EV/EBITDA median. */
  enterpriseValues?: { year: number; enterpriseValue?: number }[];
  /** 10-year government bond yield, decimal: CAPM risk-free rate and the
   *  ceiling on perpetual growth. */
  riskFreeRate?: number;
  /** Growth the market is pricing in: forward P/E divided by PEG. */
  pegImpliedGrowth?: number;
}

// ---------------------------------------------------------------- statistics

const isNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);

export function median(values: number[]): number | undefined {
  const clean = values.filter(isNum).sort((a, b) => a - b);
  if (!clean.length) return undefined;
  const mid = clean.length >> 1;
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function mean(values: number[]): number | undefined {
  const clean = values.filter(isNum);
  if (!clean.length) return undefined;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

/**
 * Coefficient of variation — standard deviation divided by |mean|.
 * Scale-free, so a 20%-margin business and a 3%-margin business are comparable.
 * Needs at least 3 observations to mean anything.
 */
function coeffOfVariation(values: number[]): number | undefined {
  const clean = values.filter(isNum);
  if (clean.length < 3) return undefined;
  const m = mean(clean)!;
  if (Math.abs(m) < 1e-9) return undefined;
  const variance = clean.reduce((sum, v) => sum + (v - m) ** 2, 0) / (clean.length - 1);
  return Math.sqrt(variance) / Math.abs(m);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Compound annual growth rate over a series ordered oldest-first.
 * Endpoints are averaged over two periods when the series is long enough, so
 * one unusually strong or weak start/end year cannot set the whole trend.
 * Returns undefined unless both endpoints are positive — a CAGR across a sign
 * change is arithmetically meaningless.
 */
function cagr(seriesOldestFirst: number[]): number | undefined {
  const s = seriesOldestFirst.filter(isNum);
  if (s.length < 3) return undefined;
  let start: number;
  let end: number;
  let periods: number;
  if (s.length >= 5) {
    start = (s[0] + s[1]) / 2;
    end = (s[s.length - 1] + s[s.length - 2]) / 2;
    periods = s.length - 2;
  } else {
    start = s[0];
    end = s[s.length - 1];
    periods = s.length - 1;
  }
  if (start <= 0 || end <= 0 || periods <= 0) return undefined;
  return Math.pow(end / start, 1 / periods) - 1;
}

/** Pick the last n entries of a series. */
const tail = <T,>(arr: T[], n: number): T[] => (n >= arr.length ? arr : arr.slice(arr.length - n));

export type Regime = "stable" | "declining" | "improving";

/**
 * Detect a persistent regime shift in a margin series (oldest first).
 *
 * This is the guard that keeps normalization honest. Replacing a depressed
 * current margin with the multi-year median is right when the dip is a cycle or
 * an investment phase, and WRONG when the business is simply getting worse —
 * a structurally declining margin would otherwise be "normalized" back up to a
 * level the company no longer earns.
 *
 * So: compare the recent regime (last 3 years) with the earlier half. A gap
 * wider than 20% in either direction is treated as a level shift, and the
 * long-run median is dropped in favour of the recent regime. Anything smaller
 * is treated as noise and the full-cycle median stands.
 */
function detectRegime(seriesOldestFirst: number[]): Regime {
  const s = seriesOldestFirst.filter(isNum);
  if (s.length < 5) return "stable";
  const earlyHalf = median(s.slice(0, Math.floor(s.length / 2)));
  const recent = median(tail(s, 3));
  if (earlyHalf == null || recent == null || earlyHalf <= 0) return "stable";
  if (recent < earlyHalf * 0.8) return "declining";
  if (recent > earlyHalf * 1.25) return "improving";
  return "stable";
}

// ------------------------------------------------------------ normalization

/** How many fiscal years feed the median margins. Long enough to span a cycle. */
const MARGIN_WINDOW = 8;
/** Normalized FCF may not fall below / rise above this multiple of reported TTM FCF. */
const FCF_FLOOR_MULT = 0.75;
const FCF_CAP_MULT = 2.5;
/** Same guard rails for normalized EPS. */
const EPS_FLOOR_MULT = 0.7;
const EPS_CAP_MULT = 2.0;
/**
 * Equity risk premium for the CAPM cost of equity. Damodaran's implied US ERP
 * has run in the 4-5% range; the published retail models source theirs there.
 */
const EQUITY_RISK_PREMIUM = 0.045;
/** Working cap on perpetual growth, below the risk-free-rate ceiling. */
const TERMINAL_GROWTH_CAP = 0.03;
/** Beta bounds, matching the convention the published models use. */
const BETA_MIN = 0.8;
const BETA_MAX = 2.0;
/** Stage-1 growth bounds after normalization. */
const GROWTH_FLOOR = -0.05;
const GROWTH_CAP = 0.25;

export function normalizeInputs(params: NormalizeParams): NormalizedInputs {
  const { history } = params;
  const annual = history.annual ?? [];
  const adjustments: string[] = [];
  const growthSources: { label: string; value: number; forward: boolean }[] = [];

  const withRevenue = annual.filter(
    (a): a is AnnualFinancials & { revenue: number } => isNum(a.revenue) && a.revenue > 0
  );
  const yearsOfData = withRevenue.length;

  // Revenue base: prefer the trailing series (matches the TTM cash-flow figures),
  // fall back to the quote snapshot, then to the latest fiscal year.
  const revenueTTM =
    history.trailing?.revenue ??
    params.revenueTTM ??
    (withRevenue.length ? withRevenue[withRevenue.length - 1].revenue : undefined);

  // -------------------------------------------------- free cash flow
  const marginWindow = tail(withRevenue, MARGIN_WINDOW);
  const fcfMargins = marginWindow
    .filter((a) => isNum(a.freeCashFlow))
    .map((a) => a.freeCashFlow! / a.revenue);
  const capexIntensities = marginWindow
    .filter((a) => isNum(a.capex))
    .map((a) => a.capex! / a.revenue);

  const fcfMarginMedian = median(fcfMargins);
  const capexIntensityMedian = median(capexIntensities);
  const fcfVolatility = coeffOfVariation(fcfMargins);

  const fcfTTM = params.freeCashflowTTM;
  const ocfTTM = params.operatingCashflowTTM;
  // Derive the missing leg of FCF = OCF - capex where possible.
  const capexTTM =
    ocfTTM != null && fcfTTM != null ? Math.max(0, ocfTTM - fcfTTM) : undefined;
  const fcfMarginTTM =
    fcfTTM != null && revenueTTM != null && revenueTTM > 0 ? fcfTTM / revenueTTM : undefined;
  const capexIntensityTTM =
    capexTTM != null && revenueTTM != null && revenueTTM > 0 ? capexTTM / revenueTTM : undefined;

  // A capex spike is a step change in investment intensity, not a small drift:
  // require both a 30% relative jump and 3 revenue points of absolute increase.
  const capexSpike =
    capexIntensityTTM != null &&
    capexIntensityMedian != null &&
    capexIntensityTTM > capexIntensityMedian * 1.3 &&
    capexIntensityTTM > capexIntensityMedian + 0.03;

  // Candidate 1 — reported TTM FCF.
  const fcfCandidates: number[] = [];
  if (fcfTTM != null && fcfTTM > 0) fcfCandidates.push(fcfTTM);

  // A capex spike explains a compressed FCF margin without implying the
  // business deteriorated, so it suppresses the declining-regime verdict.
  const fcfRegime = capexSpike ? "stable" : detectRegime(fcfMargins);

  // Candidate 2 — full-cycle median FCF margin applied to current revenue.
  // Skipped on a regime shift: the old margin level is no longer the company's.
  let marginBasedFCF: number | undefined;
  if (fcfMarginMedian != null && fcfMarginMedian > 0 && revenueTTM != null) {
    marginBasedFCF = fcfMarginMedian * revenueTTM;
    if (fcfRegime === "stable") fcfCandidates.push(marginBasedFCF);
  }
  if (fcfRegime !== "stable") {
    adjustments.push(
      fcfRegime === "declining"
        ? "现金流利润率处于持续下行通道（非资本开支周期所致）——不使用历史中位数回补，仅以近 3 年实际水平平滑"
        : "现金流利润率处于持续上行通道——不使用历史中位数下拉，仅以近 3 年实际水平平滑"
    );
  }

  // Candidate 3 — recent-regime (3y) median FCF margin applied to current revenue.
  const recentMargins = tail(fcfMargins, 3);
  const recentMarginMedian = median(recentMargins);
  if (recentMarginMedian != null && recentMarginMedian > 0 && revenueTTM != null) {
    fcfCandidates.push(recentMarginMedian * revenueTTM);
  }

  // Candidate 4 — owner earnings: operating cash flow less MAINTENANCE capex.
  // Growth capex buys future earning power; charging it against today's cash
  // flow and then capitalising the result in perpetuity double-counts the cost.
  // Maintenance capex is proxied by depreciation, floored at the historical
  // capex intensity, and never assumed larger than the capex actually spent.
  let ownerEarnings: number | undefined;
  let maintenanceCapex: number | undefined;
  if (ocfTTM != null && ocfTTM > 0) {
    const latestWithDA = [...withRevenue].reverse().find((a) => isNum(a.depreciation));
    const daScaled =
      latestWithDA && revenueTTM != null
        ? latestWithDA.depreciation! * (revenueTTM / latestWithDA.revenue)
        : undefined;
    const intensityFloor =
      capexIntensityMedian != null && revenueTTM != null
        ? capexIntensityMedian * revenueTTM
        : undefined;
    const floorCandidates = [daScaled, intensityFloor].filter(isNum);
    if (floorCandidates.length) {
      const proxy = Math.max(...floorCandidates);
      maintenanceCapex = capexTTM != null ? Math.min(capexTTM, proxy) : proxy;
      const oe = ocfTTM - maintenanceCapex;
      if (oe > 0) {
        ownerEarnings = oe;
        fcfCandidates.push(oe);
      }
    }
  }

  let normalizedFCF = median(fcfCandidates);

  if (normalizedFCF != null) {
    // FCF can never exceed operating cash flow — hard arithmetic ceiling.
    if (ocfTTM != null && ocfTTM > 0) normalizedFCF = Math.min(normalizedFCF, ocfTTM);
    // Bound the adjustment so normalization can correct a distortion but cannot
    // invent a company that is materially different from the one reported.
    if (fcfTTM != null && fcfTTM > 0) {
      normalizedFCF = clamp(normalizedFCF, fcfTTM * FCF_FLOOR_MULT, fcfTTM * FCF_CAP_MULT);
    } else if (marginBasedFCF != null) {
      normalizedFCF = Math.min(normalizedFCF, marginBasedFCF);
    }
    normalizedFCF = Math.round(normalizedFCF);
  }

  if (normalizedFCF != null && fcfTTM != null && fcfTTM > 0) {
    const delta = normalizedFCF / fcfTTM - 1;
    if (Math.abs(delta) >= 0.05) {
      adjustments.push(
        `自由现金流归一化：TTM ${(fcfTTM / 1e9).toFixed(1)}B → ${(normalizedFCF / 1e9).toFixed(
          1
        )}B（${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%），取 ${yearsOfData} 年 FCF 利润率中位数、近 3 年利润率、股东盈余(OCF−维持性资本开支)与 TTM 实际值的中位数`
      );
    }
  }
  if (capexSpike) {
    adjustments.push(
      `检测到资本开支高峰：当前 capex/营收 ${(capexIntensityTTM! * 100).toFixed(1)}%，历史中位数 ${(
        capexIntensityMedian! * 100
      ).toFixed(1)}% — 扩张期资本开支已按维持性口径还原，不按当期低谷 FCF 永续化`
    );
  }

  // -------------------------------------------------- earnings per share
  const netMargins = marginWindow
    .filter((a) => isNum(a.normalizedIncome ?? a.netIncome))
    .map((a) => (a.normalizedIncome ?? a.netIncome)! / a.revenue);
  const netMarginMedian = median(netMargins);
  const earningsVolatility = coeffOfVariation(netMargins);

  // Operating cash flow margin — business volatility with capex timing removed.
  const ocfMargins = marginWindow
    .filter((a) => isNum(a.operatingCashFlow))
    .map((a) => a.operatingCashFlow! / a.revenue);
  const ocfVolatility = coeffOfVariation(ocfMargins);

  const sharesTTM =
    params.sharesOutstanding ??
    (annual.length ? [...annual].reverse().find((a) => isNum(a.dilutedShares))?.dilutedShares : undefined);

  const epsTTM = params.epsTTM;
  const epsCandidates: number[] = [];
  if (epsTTM != null && epsTTM > 0) epsCandidates.push(epsTTM);

  // Yahoo's `normalizedIncome` is already reported ex one-off items, so the
  // trailing figure is the most direct correction for a one-time charge.
  if (isNum(history.trailing?.normalizedIncome) && sharesTTM && sharesTTM > 0) {
    const v = history.trailing!.normalizedIncome! / sharesTTM;
    if (v > 0) epsCandidates.push(v);
  }
  // Full-cycle median net margin applied to current revenue — same regime guard.
  const netMarginRegime = detectRegime(netMargins);
  let marginBasedEPS: number | undefined;
  if (netMarginMedian != null && netMarginMedian > 0 && revenueTTM != null && sharesTTM && sharesTTM > 0) {
    marginBasedEPS = (netMarginMedian * revenueTTM) / sharesTTM;
    if (netMarginRegime === "stable") epsCandidates.push(marginBasedEPS);
    else {
      // Recent-regime net margin instead of the full-cycle one.
      const recentNetMargin = median(tail(netMargins, 3));
      if (recentNetMargin != null && recentNetMargin > 0) {
        epsCandidates.push((recentNetMargin * revenueTTM) / sharesTTM);
      }
    }
  }
  if (netMarginRegime !== "stable") {
    adjustments.push(
      `净利率处于持续${netMarginRegime === "declining" ? "下行" : "上行"}通道——EPS 归一化改用近 3 年利润率水平，不回补至全周期中位数`
    );
  }

  let normalizedEPS = median(epsCandidates);
  if (normalizedEPS != null) {
    if (epsTTM != null && epsTTM > 0) {
      normalizedEPS = clamp(normalizedEPS, epsTTM * EPS_FLOOR_MULT, epsTTM * EPS_CAP_MULT);
    }
    normalizedEPS = Math.round(normalizedEPS * 100) / 100;
  }
  if (normalizedEPS != null && epsTTM != null && epsTTM > 0) {
    const delta = normalizedEPS / epsTTM - 1;
    if (Math.abs(delta) >= 0.05) {
      adjustments.push(
        `EPS 归一化：TTM ${epsTTM.toFixed(2)} → ${normalizedEPS.toFixed(2)}（${
          delta > 0 ? "+" : ""
        }${(delta * 100).toFixed(0)}%），剔除一次性损益并按 ${yearsOfData} 年净利率中位数还原`
      );
    }
  }

  // -------------------------------------------------- EBITDA
  const ebitdaMargins = marginWindow
    .filter((a) => isNum(a.normalizedEbitda ?? a.ebitda))
    .map((a) => (a.normalizedEbitda ?? a.ebitda)! / a.revenue);
  const ebitdaMarginMedian = median(ebitdaMargins);
  let normalizedEbitda = params.ebitdaTTM;
  if (ebitdaMarginMedian != null && ebitdaMarginMedian > 0 && revenueTTM != null) {
    const marginBased = ebitdaMarginMedian * revenueTTM;
    normalizedEbitda =
      params.ebitdaTTM != null
        ? median([params.ebitdaTTM, marginBased])
        : marginBased;
  }

  // -------------------------------------------------- growth rate
  // Every source gets one vote and the MEDIAN decides. A single distorted
  // period (a one-off charge, an easy or brutal comparison quarter) is then
  // outvoted instead of setting the ten-year compounding assumption alone.
  const revSeries = withRevenue.map((a) => a.revenue);
  const revCagr = cagr(tail(revSeries, 6));
  if (revCagr != null)
    growthSources.push({ label: "营收 CAGR (最多5年)", value: revCagr, forward: false });

  const incomeSeries = withRevenue
    .map((a) => a.normalizedIncome ?? a.netIncome)
    .filter(isNum);
  const incomeCagr = cagr(tail(incomeSeries, 6));
  if (incomeCagr != null)
    growthSources.push({ label: "归一化净利润 CAGR", value: incomeCagr, forward: false });

  const fcfSeries = withRevenue.map((a) => a.freeCashFlow).filter(isNum);
  const fcfCagr = cagr(tail(fcfSeries, 6));
  if (fcfCagr != null)
    growthSources.push({ label: "自由现金流 CAGR", value: fcfCagr, forward: false });

  if (isNum(params.analystLongTermGrowth)) {
    growthSources.push({
      label: "分析师长期增速预期",
      value: params.analystLongTermGrowth,
      forward: true,
    });
  }
  // Growth implied by PEG: PEG = forward P/E / growth%, so forward P/E / PEG
  // recovers the growth rate the PEG figure already encodes.
  //
  // This is what keeps the PEG column and the fair value column pointing the
  // same way. They are two views of the same company, and when the DCF forecasts
  // growth the PEG column never saw, the two can disagree in DIRECTION — the
  // page saying "PEG 0.36, cheap" and "fair value 30% below price" at once,
  // which is not a nuanced view, it is an internal contradiction. Feeding the
  // implied growth in as one forward vote removes the contradiction at its
  // source, while leaving the legitimate reasons the two still differ (capital
  // intensity, leverage, risk) intact — a DCF pays for capex, PEG does not.
  if (isNum(params.pegImpliedGrowth)) {
    growthSources.push({
      label: "PEG 隐含增速（前瞻PE÷PEG）",
      value: params.pegImpliedGrowth,
      forward: true,
    });
  }
  if (isNum(params.earningsGrowthTTM)) {
    growthSources.push({ label: "最近一期盈利同比", value: params.earningsGrowthTTM, forward: false });
  }
  if (isNum(params.revenueGrowthTTM)) {
    growthSources.push({ label: "最近一期营收同比", value: params.revenueGrowthTTM, forward: false });
  }

  const growthRateRaw = params.earningsGrowthTTM ?? params.revenueGrowthTTM;
  let growthRate: number | undefined;

  // Realized and forward-looking sources are medianed SEPARATELY and then
  // blended 50/50.
  //
  // A plain median over all sources looks robust but is not: realized CAGRs
  // outnumber forward estimates roughly four to two, so the median is always
  // one of the backward-looking votes and the forward view cannot move it at
  // all. For a business at an inflection — a capacity build-out finishing, a
  // new product cycle — that hard-codes "the next decade looks like the last
  // one". Medianing within each group keeps the original protection (one
  // distorted quarter is still outvoted by its peers) without letting the
  // count of historical series decide the answer.
  const realized = growthSources.filter((s) => !s.forward).map((s) => s.value);
  const forward = growthSources.filter((s) => s.forward).map((s) => s.value);
  const realizedMedian = realized.length >= 2 ? median(realized) : undefined;
  const forwardMedian = forward.length ? median(forward) : undefined;

  if (realizedMedian != null && forwardMedian != null) {
    growthRate = realizedMedian * 0.5 + forwardMedian * 0.5;
    adjustments.push(
      `增长率 = 历史已实现中位数 ${(realizedMedian * 100).toFixed(1)}%（${realized.length} 个来源）与前瞻预期 ${(
        forwardMedian * 100
      ).toFixed(1)}% 各取 50% → ${(growthRate * 100).toFixed(
        1
      )}%。组内取中位数保证单季波动被同组其他来源压过，组间等权保证前瞻视角不会因历史序列数量多而被淹没`
    );
  } else if (realizedMedian != null) {
    growthRate = realizedMedian;
    adjustments.push(
      `增长率取 ${realized.length} 个历史来源的中位数 ${(realizedMedian * 100).toFixed(
        1
      )}%（无可用前瞻预期），单一季度波动无法单独决定十年复合假设`
    );
  } else if (forwardMedian != null && realized.length) {
    growthRate = forwardMedian * 0.5 + median(realized)! * 0.5;
    adjustments.push(
      `增长率 = 前瞻预期与仅有的 ${realized.length} 个历史来源各取 50% → ${(growthRate * 100).toFixed(1)}%`
    );
  } else if (growthSources.length === 1) {
    // Only one observation: treat it as a point estimate and haircut it 30%,
    // because there is no cross-check available.
    growthRate = growthSources[0].value * 0.7;
    adjustments.push("增长率仅有单一来源，已打 7 折使用（缺少历史交叉验证）");
  }
  if (growthRate != null) {
    const bounded = clamp(growthRate, GROWTH_FLOOR, GROWTH_CAP);
    if (bounded !== growthRate) {
      adjustments.push(
        `增长率 ${(growthRate * 100).toFixed(1)}% 超出可用区间，已限制为 ${(bounded * 100).toFixed(1)}%`
      );
    }
    growthRate = Math.round(bounded * 10000) / 10000;
  }

  // -------------------------------------------------- historical EV/EBITDA
  // What the market has actually paid for THIS business's EBITDA, year by year.
  // Used instead of a flat sector multiple, which is a hidden haircut on any
  // company the market has consistently valued above that flat number.
  let historicalEvEbitda: number | undefined;
  if (params.enterpriseValues?.length) {
    const ebitdaByYear = new Map<number, number>();
    for (const a of annual) {
      const e = a.normalizedEbitda ?? a.ebitda;
      if (isNum(e) && e > 0) ebitdaByYear.set(a.fiscalYear, e);
    }
    const multiples: number[] = [];
    for (const ev of params.enterpriseValues) {
      const e = ebitdaByYear.get(ev.year);
      if (e && isNum(ev.enterpriseValue) && ev.enterpriseValue! > 0) {
        const m = ev.enterpriseValue! / e;
        // Drop arithmetically implausible points (a trough-EBITDA year can
        // produce a 100x multiple that says nothing about fair value).
        if (m > 2 && m < 40) multiples.push(m);
      }
    }
    if (multiples.length >= 3) {
      historicalEvEbitda = Math.round(median(multiples)! * 100) / 100;
      adjustments.push(
        `EV/EBITDA 乘数取该公司自身 ${multiples.length} 年历史中位数 ${historicalEvEbitda.toFixed(
          1
        )}×，而非固定行业乘数`
      );
    }
  }

  // -------------------------------------------------- discount rate
  // Cash-flow stability is priced: a business whose margin swings widely year to
  // year carries more forecast risk than a stable compounder, so it is
  // discounted harder. Volatility is measured over the actual history, which is
  // exactly the "look at many years of variation" the point estimate ignores.
  // Risk is priced off OPERATING cash flow and net margin, never off FCF margin.
  //
  // FCF margin volatility is dominated by capex timing, which is an investment
  // decision rather than business risk. A company building capacity shows a
  // violently swinging FCF margin; charging it a higher discount rate for that
  // penalises it twice for the same capex — once in the depressed cash flow and
  // again in the rate — and it penalises exactly the companies whose spending is
  // funding the growth the model is discounting. Operating cash flow margin
  // measures how stably the business converts revenue to cash, with the
  // investment decision stripped out.
  const businessVolatility = Math.max(ocfVolatility ?? 0, earningsVolatility ?? 0);

  // Cost of equity from CAPM, not a hand-set base rate:
  //     cost of equity = risk-free rate + beta x equity risk premium
  // A fixed 9% ignores both the level of interest rates and the individual
  // company's risk. CAPM with a bounded beta is what the published models use.
  const riskFree = clamp(params.riskFreeRate ?? 0.04, 0.02, 0.07);
  const beta = isNum(params.beta) ? clamp(params.beta, BETA_MIN, BETA_MAX) : 1.0;
  let discountRate = riskFree + beta * EQUITY_RISK_PREMIUM;
  // Beta is a market-price measure and can miss fundamental fragility, so a
  // capped modifier sits on top — it adjusts CAPM rather than replacing it.
  // Asymmetric: the modifier can add meaningfully for a fragile business but
  // barely subtracts, so CAPM stays the floor rather than something to erode.
  discountRate += clamp((businessVolatility - 0.25) * 0.04, -0.005, 0.015);
  if (yearsOfData < 4) discountRate += 0.005;
  // A cost of equity below 8% is hard to defend for a public equity, and the
  // floor also guards against a bad beta or risk-free reading feeding through.
  discountRate = Math.round(clamp(discountRate, 0.08, 0.14) * 10000) / 10000;
  adjustments.push(
    `折现率 ${(discountRate * 100).toFixed(2)}% = CAPM 股权成本：无风险利率 ${(riskFree * 100).toFixed(
      2
    )}%（10年期国债）+ Beta ${beta.toFixed(2)}${
      isNum(params.beta) ? "" : "（数据缺失，取 1.0）"
    } × 股权风险溢价 ${(EQUITY_RISK_PREMIUM * 100).toFixed(1)}%，再按经营波动系数 ${
      businessVolatility ? businessVolatility.toFixed(2) : "n/a"
    } 微调（上限 ±100~150bp）${
      fcfVolatility != null
        ? `。FCF 波动系数 ${fcfVolatility.toFixed(2)} 不计入定价，因其主要由资本开支节奏而非经营风险驱动`
        : ""
    }`
  );

  // Terminal growth: below long-run GDP, and trimmed further when the business
  // has shown it cannot hold a stable margin.
  // Perpetual growth is anchored to the risk-free rate, not fixed at 2.5%.
  //
  // A company growing faster than the economy forever eventually becomes the
  // economy, so the long-run nominal growth rate is the ceiling, and the
  // risk-free rate is the standard proxy for it. That cuts both ways: when the
  // 10-year sits near 4%, a hard-coded 2.5% is not a neutral choice but a
  // permanent haircut on every terminal value — and the terminal value is the
  // majority of a DCF. When rates are low, the same rule tightens it.
  // The risk-free rate is the ceiling, and 3% is the working cap on top of it:
  // sustaining full nominal GDP growth in perpetuity would mean never losing a
  // point of share to a new entrant, forever. 2.5% was too low when the 10-year
  // sits near 4%; the full risk-free rate is the aggressive end of the range.
  let terminalGrowth = Math.min(riskFree, TERMINAL_GROWTH_CAP);
  if (businessVolatility > 0.6) terminalGrowth = Math.min(terminalGrowth, 0.025);
  if (growthRate != null && growthRate <= 0) terminalGrowth = Math.min(terminalGrowth, 0.015);
  // Gordon's denominator has to stay wide enough that the terminal value is a
  // valuation rather than a division-by-almost-zero.
  terminalGrowth = Math.max(0.005, Math.min(terminalGrowth, discountRate - 0.04));
  terminalGrowth = Math.round(terminalGrowth * 10000) / 10000;
  adjustments.push(
    `永续增长率 ${(terminalGrowth * 100).toFixed(2)}%，取无风险利率 ${(riskFree * 100).toFixed(
      2
    )}%（长期名义增长代理）与 ${(TERMINAL_GROWTH_CAP * 100).toFixed(
      1
    )}% 工作上限的较低者，并保证与折现率至少相差 400bp`
  );

  // Book value per share, normalized off the latest reported equity when the
  // quote snapshot is missing it.
  let bvps = params.bvps;
  if (bvps == null && sharesTTM && sharesTTM > 0) {
    const latestEquity = [...annual].reverse().find((a) => isNum(a.stockholdersEquity));
    if (latestEquity) bvps = latestEquity.stockholdersEquity! / sharesTTM;
  }

  const netDebt =
    params.netDebt ??
    [...annual].reverse().find((a) => isNum(a.netDebt))?.netDebt ??
    undefined;

  if (yearsOfData === 0) {
    adjustments.push("未取得历史年报数据，本次估值全部基于 TTM 快照，可靠性较低");
  }

  return {
    historicalEvEbitda,
    volatility: businessVolatility,
    freeCashflow: normalizedFCF ?? fcfTTM,
    freeCashflowTTM: fcfTTM,
    ownerEarnings,
    eps: normalizedEPS ?? epsTTM,
    epsTTM,
    ebitda: normalizedEbitda,
    ebitdaTTM: params.ebitdaTTM,
    bvps,
    growthRate,
    growthRateRaw,
    discountRate,
    terminalGrowth,
    netDebt,
    diagnostics: {
      yearsOfData,
      historyProvider: history.provider,
      fcfMarginTTM: fcfMarginTTM != null ? Math.round(fcfMarginTTM * 10000) / 10000 : undefined,
      fcfMarginMedian:
        fcfMarginMedian != null ? Math.round(fcfMarginMedian * 10000) / 10000 : undefined,
      capexIntensityTTM:
        capexIntensityTTM != null ? Math.round(capexIntensityTTM * 10000) / 10000 : undefined,
      capexIntensityMedian:
        capexIntensityMedian != null ? Math.round(capexIntensityMedian * 10000) / 10000 : undefined,
      capexSpike: !!capexSpike,
      fcfVolatility: fcfVolatility != null ? Math.round(fcfVolatility * 100) / 100 : undefined,
      earningsVolatility:
        earningsVolatility != null ? Math.round(earningsVolatility * 100) / 100 : undefined,
      ocfVolatility: ocfVolatility != null ? Math.round(ocfVolatility * 100) / 100 : undefined,
      businessVolatility: Math.round(businessVolatility * 100) / 100,
      evEbitdaMedian: historicalEvEbitda,
      growthSources: growthSources.map((s) => ({
        label: s.label,
        value: Math.round(s.value * 10000) / 10000,
        forward: s.forward,
      })),
      adjustments,
    },
  };
}
