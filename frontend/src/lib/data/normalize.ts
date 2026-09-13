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
  /** Coefficient of variation of the annual FCF margin series. */
  fcfVolatility?: number;
  /** Coefficient of variation of the annual net margin series. */
  earningsVolatility?: number;
  growthSources: { label: string; value: number }[];
  /** Human-readable notes rendered in the UI so the adjustment is auditable. */
  adjustments: string[];
}

export interface NormalizedInputs {
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
/** Stage-1 growth bounds after normalization. */
const GROWTH_FLOOR = -0.05;
const GROWTH_CAP = 0.25;

export function normalizeInputs(params: NormalizeParams): NormalizedInputs {
  const { history } = params;
  const annual = history.annual ?? [];
  const adjustments: string[] = [];
  const growthSources: { label: string; value: number }[] = [];

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
  if (revCagr != null) growthSources.push({ label: "营收 CAGR (最多5年)", value: revCagr });

  const incomeSeries = withRevenue
    .map((a) => a.normalizedIncome ?? a.netIncome)
    .filter(isNum);
  const incomeCagr = cagr(tail(incomeSeries, 6));
  if (incomeCagr != null) growthSources.push({ label: "归一化净利润 CAGR", value: incomeCagr });

  const fcfSeries = withRevenue.map((a) => a.freeCashFlow).filter(isNum);
  const fcfCagr = cagr(tail(fcfSeries, 6));
  if (fcfCagr != null) growthSources.push({ label: "自由现金流 CAGR", value: fcfCagr });

  if (isNum(params.analystLongTermGrowth)) {
    growthSources.push({ label: "分析师长期增速预期", value: params.analystLongTermGrowth });
  }
  if (isNum(params.earningsGrowthTTM)) {
    growthSources.push({ label: "最近一期盈利同比", value: params.earningsGrowthTTM });
  }
  if (isNum(params.revenueGrowthTTM)) {
    growthSources.push({ label: "最近一期营收同比", value: params.revenueGrowthTTM });
  }

  const growthRateRaw = params.earningsGrowthTTM ?? params.revenueGrowthTTM;
  let growthRate: number | undefined;
  if (growthSources.length >= 2) {
    growthRate = median(growthSources.map((s) => s.value));
    adjustments.push(
      `增长率取 ${growthSources.length} 个来源的中位数 ${(growthRate! * 100).toFixed(
        1
      )}%（区间 ${(Math.min(...growthSources.map((s) => s.value)) * 100).toFixed(1)}% ~ ${(
        Math.max(...growthSources.map((s) => s.value)) * 100
      ).toFixed(1)}%），单一季度波动无法单独决定十年复合假设`
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

  // -------------------------------------------------- discount rate
  // Cash-flow stability is priced: a business whose margin swings widely year to
  // year carries more forecast risk than a stable compounder, so it is
  // discounted harder. Volatility is measured over the actual history, which is
  // exactly the "look at many years of variation" the point estimate ignores.
  const volatility = Math.max(fcfVolatility ?? 0, earningsVolatility ?? 0);
  let discountRate = 0.09 + clamp(volatility, 0, 1) * 0.04;
  if (isNum(params.beta)) discountRate += clamp((params.beta - 1) * 0.02, -0.01, 0.02);
  if (yearsOfData < 4) discountRate += 0.005;
  discountRate = Math.round(clamp(discountRate, 0.085, 0.13) * 10000) / 10000;
  adjustments.push(
    `折现率 ${(discountRate * 100).toFixed(2)}%：基准 9% + 现金流波动率调整（历史波动系数 ${
      volatility ? volatility.toFixed(2) : "n/a"
    }）${isNum(params.beta) ? ` + Beta ${params.beta.toFixed(2)} 调整` : ""}`
  );

  // Terminal growth: below long-run GDP, and trimmed further when the business
  // has shown it cannot hold a stable margin.
  let terminalGrowth = 0.025;
  if (volatility > 0.6) terminalGrowth = 0.02;
  if (growthRate != null && growthRate <= 0) terminalGrowth = 0.015;

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
      growthSources: growthSources.map((s) => ({
        label: s.label,
        value: Math.round(s.value * 10000) / 10000,
      })),
      adjustments,
    },
  };
}
