export type DCFAnnotation =
  | "primary"
  | "authoritative"
  | "optimistic"
  | "pessimistic"
  | "classic"
  | "supplemental"
  | "conservative";

/**
 * What quantity a model estimates. This is the distinction the blend depends on.
 *
 * A weighted average is only meaningful over estimates of the SAME quantity.
 * Mixing a going-concern intrinsic value with a no-growth floor produces
 * neither: the floors are not wrong, they are answering a different question
 * ("what is this worth if growth stops / if it liquidates"), and averaging them
 * into the central estimate applies a permanent, invisible haircut to every
 * growing business. Measured on representative large-cap inputs, that haircut
 * was 17-28% below the cash-flow anchor before this split existed.
 *
 * So: `value` models set the fair value, `floor` models set the margin-of-safety
 * band shown beside it, and `reference` models are displayed as context only.
 */
export type DCFRole = "value" | "floor" | "reference";

export interface ComputedDCF {
  source: string;
  model: string;
  methodology: string;
  value: number;
  annotation: DCFAnnotation;
  role: DCFRole;
  /** Share of present value coming from the terminal value (primary model only). */
  terminalShare?: number;
  /** Base weight within its own role group, before renormalization. */
  weight: number;
}

/**
 * Weights within the `value` group. Cash-flow models dominate because they
 * value the cash the business actually produces; the relative-valuation
 * cross-check and third-party DCFs keep the estimate from being a single
 * model's opinion.
 */
export const MODEL_WEIGHTS = {
  twoStage: 0.32,
  tenYearFade: 0.17,
  fiveYearFcf: 0.11,
  evEbitda: 0.15,
  earningsDCF: 0.12,
  external: 0.1, // shared across all third-party DCF values
  ddm: 0.03,
  // --- floor group (excluded from the central fair value) ---
  conservativeFcf: 0.35,
  earningsPower: 0.3,
  residualIncome: 0.25,
  grahamNumber: 0.1,
  // --- reference only (excluded from both) ---
  grahamFormula: 0,
  lynch: 0,
} as const;

/** Net cash may not contribute more than this share of the operating PV. */
const NET_CASH_CAP = 0.2;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Present value of a free-cash-flow stream that grows at `g` for `highYears`
 * and then fades linearly to `terminalGrowth` by year `totalYears`, plus a
 * Gordon Growth terminal value.
 *
 * The fade matters: a flat high-growth decade followed by an instant drop to
 * 2.5% puts a discontinuity right where most of the value sits. Fading avoids
 * capitalising a growth rate the model itself no longer believes.
 */
function fadingDcfPV(
  freeCashflow: number,
  g: number,
  discountRate: number,
  terminalGrowth: number,
  highYears: number,
  totalYears: number
): { pv: number; terminalShare: number } | undefined {
  if (!(freeCashflow > 0)) return undefined;
  if (discountRate <= terminalGrowth) return undefined;

  let pvStream = 0;
  let fcf = freeCashflow;
  const fadeYears = Math.max(1, totalYears - highYears);
  for (let t = 1; t <= totalYears; t++) {
    const yearGrowth =
      t <= highYears ? g : g - (g - terminalGrowth) * ((t - highYears) / fadeYears);
    fcf *= 1 + yearGrowth;
    pvStream += fcf / Math.pow(1 + discountRate, t);
  }
  const terminalValue = (fcf * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, totalYears);
  const pv = pvStream + pvTerminal;
  return { pv, terminalShare: pv > 0 ? pvTerminal / pv : 1 };
}

/**
 * Primary model: 10-year two-stage DCF with a growth fade and a net-cash bridge.
 *
 * Yahoo/FMP free cash flow is levered (operating cash flow is after interest
 * paid), so the discounted stream is already equity cash flow and debt is NOT
 * subtracted again. Net CASH, however, is an asset the stream barely earns on,
 * so it is added — capped at 20% of the operating PV so a bad balance-sheet
 * figure cannot drive the valuation.
 */
export function twoStageDCF(
  freeCashflow: number,
  stage1GrowthRate: number,
  sharesOutstanding: number,
  opts: {
    discountRate?: number;
    terminalGrowthRate?: number;
    netDebt?: number;
    highGrowthYears?: number;
    totalYears?: number;
  } = {}
): { value: number; terminalShare: number } | undefined {
  const {
    discountRate = 0.1,
    terminalGrowthRate = 0.025,
    netDebt,
    highGrowthYears = 5,
    totalYears = 10,
  } = opts;
  if (!(sharesOutstanding > 0)) return undefined;

  const g = Math.max(-0.1, Math.min(stage1GrowthRate, 0.3));
  const result = fadingDcfPV(
    freeCashflow,
    g,
    discountRate,
    terminalGrowthRate,
    highGrowthYears,
    totalYears
  );
  if (!result) return undefined;

  let equity = result.pv;
  if (netDebt != null && isFinite(netDebt) && netDebt < 0) {
    const netCash = Math.min(-netDebt, result.pv * NET_CASH_CAP);
    equity += netCash;
  }
  if (equity <= 0) return undefined;
  return { value: round2(equity / sharesOutstanding), terminalShare: result.terminalShare };
}

/**
 * Graham Number — sqrt(22.5 x EPS x BookValuePerShare).
 * A 1930s screening threshold for defensive investors, not a valuation of a
 * capital-light business. Kept as a visible floor marker at minimal weight.
 */
export function grahamNumber(eps: number, bvps: number): number | undefined {
  if (eps <= 0 || bvps <= 0) return undefined;
  return round2(Math.sqrt(22.5 * eps * bvps));
}

/**
 * Benjamin Graham intrinsic value: V = EPS x (8.5 + 2g) x 4.4 / Y
 */
export function grahamFormula(
  eps: number,
  growthRatePct: number,
  aaBondYield = 4.4
): number | undefined {
  if (eps <= 0 || growthRatePct == null) return undefined;
  const g = Math.max(0, Math.min(growthRatePct, 20));
  return round2((eps * (8.5 + 2 * g) * 4.4) / aaBondYield);
}

/** Peter Lynch fair value — the price at which PEG = 1. */
export function lynchFairValue(eps: number, growthRatePct: number): number | undefined {
  if (eps <= 0 || growthRatePct <= 0) return undefined;
  return round2(eps * Math.min(growthRatePct, 25));
}

/** Gordon Growth dividend discount model. */
export function ddmValue(
  dividendPerShare: number,
  growthRate: number,
  discountRate = 0.1
): number | undefined {
  if (dividendPerShare <= 0) return undefined;
  const g = Math.min(growthRate, discountRate - 0.005);
  if (g >= discountRate) return undefined;
  return round2((dividendPerShare * (1 + g)) / (discountRate - g));
}

/** 5-year FCF DCF with a Gordon terminal value. */
export function fcfDCF(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number,
  discountRate = 0.1,
  terminalGrowth = 0.025,
  years = 5
): number | undefined {
  if (freeCashflow <= 0 || sharesOutstanding <= 0) return undefined;
  if (discountRate <= terminalGrowth) return undefined;
  const g = Math.max(-0.1, Math.min(growthRate, 0.3));
  let totalPV = 0;
  let lastFCF = freeCashflow;
  for (let y = 1; y <= years; y++) {
    lastFCF *= 1 + g;
    totalPV += lastFCF / Math.pow(1 + discountRate, y);
  }
  totalPV += (lastFCF * (1 + terminalGrowth)) / (discountRate - terminalGrowth) / Math.pow(1 + discountRate, years);
  return round2(totalPV / sharesOutstanding);
}

/**
 * Conservative FCF DCF — a deliberately pessimistic corner of the assumption
 * space: the normalized discount rate plus 200bp, growth cut 30%, terminal 2%.
 * It is the downside case, which is why it carries a modest weight rather than
 * anchoring the blend.
 */
export function conservativeFcfDCF(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number,
  baseDiscountRate = 0.1
): number | undefined {
  if (freeCashflow <= 0 || sharesOutstanding <= 0) return undefined;
  const g = Math.max(-0.1, Math.min(growthRate * 0.7, 0.2));
  const discountRate = Math.min(baseDiscountRate + 0.02, 0.15);
  return fcfDCF(freeCashflow, g, sharesOutstanding, discountRate, 0.02, 5);
}

/** Earnings Power Value (Greenwald) — zero-growth capitalised earnings. */
export function earningsPowerValue(eps: number, costOfCapital = 0.09): number | undefined {
  if (eps <= 0 || costOfCapital <= 0) return undefined;
  return round2(eps / costOfCapital);
}

/**
 * Residual income model with an explicit fade.
 * Excess returns attract competition, so the spread over the required return
 * decays instead of persisting flat for five years and then vanishing.
 */
export function residualIncomeValue(
  bvps: number,
  eps: number,
  growthRate: number,
  requiredReturn = 0.1,
  fadeYears = 8
): number | undefined {
  if (bvps <= 0 || eps <= 0) return undefined;
  const roe = eps / bvps;
  if (roe <= requiredReturn) return round2(bvps);
  const g = Math.max(0, Math.min(growthRate, 0.15));
  let pv = bvps;
  let book = bvps;
  let spread = roe - requiredReturn;
  for (let t = 1; t <= fadeYears; t++) {
    pv += (spread * book) / Math.pow(1 + requiredReturn, t);
    book *= 1 + g;
    spread *= 1 - 1 / fadeYears; // linear decay of the excess return
  }
  return round2(pv);
}

/** 10-year FCF DCF with a growth fade over the back half. */
export function fcfDCF10Year(
  freeCashflow: number,
  growthRate: number,
  sharesOutstanding: number,
  discountRate = 0.1,
  terminalGrowth = 0.025
): number | undefined {
  if (!(sharesOutstanding > 0)) return undefined;
  const g = Math.max(-0.1, Math.min(growthRate * 0.9, 0.3));
  const result = fadingDcfPV(freeCashflow, g, discountRate, terminalGrowth, 5, 10);
  if (!result) return undefined;
  return round2(result.pv / sharesOutstanding);
}

/**
 * Earnings-based DCF — the same fade structure, with normalized EPS standing in
 * for cash flow.
 *
 * This exists because free cash flow is not always usable: a company deep in a
 * capex cycle can report FCF near zero or negative, and every FCF model then
 * drops out. Without an earnings-driven sibling in the same group, the fair
 * value falls through to whatever third-party DCFs happen to be available —
 * which is one vendor's opinion, not a valuation, and in practice produced fair
 * values a fraction of the share price for profitable, growing companies.
 *
 * Earnings are a weaker proxy for owner cash than FCF (they ignore working
 * capital and capitalise nothing), so this carries less weight than the cash
 * models and is not the anchor when they are available.
 */
export function earningsDCF(
  eps: number,
  growthRate: number,
  opts: { discountRate?: number; terminalGrowthRate?: number } = {}
): number | undefined {
  const { discountRate = 0.1, terminalGrowthRate = 0.025 } = opts;
  if (!(eps > 0)) return undefined;
  const g = Math.max(-0.1, Math.min(growthRate, 0.3));
  const result = fadingDcfPV(eps, g, discountRate, terminalGrowthRate, 5, 10);
  if (!result) return undefined;
  return round2(result.pv);
}

/**
 * The EV/EBITDA multiple to value the business at.
 *
 * Preference order:
 *  1. The median multiple the market has paid for THIS business over the past
 *     decade. That is an observation, not an assumption, and it is what makes
 *     the model an independent cross-check rather than a restatement of the DCF.
 *  2. Failing that, a growth-scaled multiple. A flat multiple for every company
 *     is not neutral — it is a large haircut on anything growing faster than
 *     the average constituent of whatever set the flat number came from.
 *
 * Bounded either way, so one bad year or an extreme growth input cannot carry
 * the valuation.
 */
export function fairEvEbitdaMultiple(opts: {
  historicalMedian?: number;
  growthRate?: number;
  volatility?: number;
}): number {
  const { historicalMedian, growthRate, volatility } = opts;
  if (historicalMedian != null && isFinite(historicalMedian) && historicalMedian > 0) {
    // Trim the historical median slightly so a decade-long re-rating does not
    // get extrapolated forever.
    return Math.min(25, Math.max(5, historicalMedian * 0.9));
  }
  const g = Math.max(0, Math.min(growthRate ?? 0, 0.3));
  let multiple = 8 + 40 * g; // 0% growth -> 8x, 15% -> 14x, 30% -> 20x
  if (volatility != null && volatility > 0.5) multiple *= 0.85;
  return Math.min(20, Math.max(6, multiple));
}

/** EV/EBITDA multiple fair value. */
export function evEbitdaFairValue(
  ebitda: number,
  sharesOutstanding: number,
  netDebt = 0,
  multiple = 12
): number | undefined {
  if (ebitda <= 0 || sharesOutstanding <= 0) return undefined;
  const equity = ebitda * multiple - netDebt;
  if (equity <= 0) return undefined;
  return round2(equity / sharesOutstanding);
}

export interface BuildDCFParams {
  /** Normalized (through-cycle) free cash flow, in trading currency terms. */
  freeCashflow?: number;
  /** Normalized EPS. */
  eps?: number;
  bvps?: number;
  /** Normalized growth rate, decimal. */
  earningsGrowthRate?: number;
  sharesOutstanding?: number;
  dividendPerShare?: number;
  ebitda?: number;
  netDebt?: number;
  /** Volatility-adjusted discount rate from normalizeInputs(). */
  discountRate?: number;
  terminalGrowth?: number;
  /** Median EV/EBITDA the market has paid for this business historically. */
  historicalEvEbitda?: number;
  /** Business volatility (coefficient of variation), for the multiple haircut. */
  volatility?: number;
}

export function buildDCFModels(params: BuildDCFParams): ComputedDCF[] {
  const results: ComputedDCF[] = [];
  const discountRate = params.discountRate ?? 0.1;
  const terminalGrowth = params.terminalGrowth ?? 0.025;
  const growthRate = params.earningsGrowthRate;
  const growthPct = growthRate != null ? growthRate * 100 : undefined;
  const rateNote = `折现率 ${(discountRate * 100).toFixed(2)}%（按历史经营现金流波动率调整）`;

  const push = (m: ComputedDCF | null) => {
    if (m && m.value > 0) results.push(m);
  };

  const hasFcf = params.freeCashflow != null && params.freeCashflow > 0;
  const hasShares = params.sharesOutstanding != null && params.sharesOutstanding > 0;

  // ===================== value group =====================

  // Primary — two-stage fading DCF on normalized FCF.
  if (hasFcf && hasShares && growthRate != null) {
    const out = twoStageDCF(params.freeCashflow!, growthRate, params.sharesOutstanding!, {
      discountRate,
      terminalGrowthRate: terminalGrowth,
      netDebt: params.netDebt,
    });
    if (out) {
      push({
        source: "ValueInvest",
        model: "两阶段 DCF (归一化)",
        methodology: `归一化 FCF 起步，1–5 年 ${(growthRate * 100).toFixed(1)}% 增长，6–10 年线性衰减至 ${(
          terminalGrowth * 100
        ).toFixed(1)}% 永续增长 | ${rateNote} | 终值占比 ${(out.terminalShare * 100).toFixed(0)}%${
          params.netDebt != null && params.netDebt < 0 ? " | 已加回净现金（上限为经营现值20%）" : ""
        }`,
        value: out.value,
        annotation: "primary",
        role: "value",
        terminalShare: Math.round(out.terminalShare * 1000) / 1000,
        weight: MODEL_WEIGHTS.twoStage,
      });
    }
  }

  // 10-year fade DCF — same shape, growth haircut 10%, no net-cash bridge.
  if (hasFcf && hasShares && growthRate != null) {
    const val = fcfDCF10Year(
      params.freeCashflow!,
      growthRate,
      params.sharesOutstanding!,
      discountRate,
      terminalGrowth
    );
    if (val) {
      push({
        source: "ValueInvest",
        model: "10年 FCF DCF (增长衰减)",
        methodology: `10年现金流折现，增速打9折，后5年线性衰减至 ${(terminalGrowth * 100).toFixed(1)}% | ${rateNote}`,
        value: val,
        annotation: "authoritative",
        role: "value",
        weight: MODEL_WEIGHTS.tenYearFade,
      });
    }
  }

  // 5-year FCF DCF — shortest explicit horizon in the value group.
  if (hasFcf && hasShares && growthRate != null) {
    const val = fcfDCF(
      params.freeCashflow!,
      growthRate,
      params.sharesOutstanding!,
      discountRate,
      terminalGrowth
    );
    if (val) {
      push({
        source: "ValueInvest",
        model: "5年 FCF DCF",
        methodology: `5年现金流折现 + Gordon 终值 | ${rateNote}，终值增长 ${(terminalGrowth * 100).toFixed(1)}%`,
        value: val,
        annotation: "authoritative",
        role: "value",
        weight: MODEL_WEIGHTS.fiveYearFcf,
      });
    }
  }

  // Earnings-based DCF — always available for a profitable company, so the
  // value group can never collapse to third-party DCFs alone.
  if (params.eps && params.eps > 0 && growthRate != null) {
    const val = earningsDCF(params.eps, growthRate, {
      discountRate,
      terminalGrowthRate: terminalGrowth,
    });
    if (val) {
      push({
        source: "ValueInvest",
        model: "盈利折现 DCF (归一化EPS)",
        methodology: `与现金流模型同结构，以归一化 EPS 为现金代理：1–5 年 ${(growthRate * 100).toFixed(
          1
        )}% 增长，6–10 年衰减至 ${(terminalGrowth * 100).toFixed(
          1
        )}% | ${rateNote}。EPS 是比 FCF 更弱的所有者现金代理，故权重低于现金流模型`,
        value: val,
        annotation: "authoritative",
        role: "value",
        weight: MODEL_WEIGHTS.earningsDCF,
      });
    }
  }

  // Relative valuation cross-check.
  if (params.ebitda && hasShares) {
    const multiple = fairEvEbitdaMultiple({
      historicalMedian: params.historicalEvEbitda,
      growthRate,
      volatility: params.volatility,
    });
    const val = evEbitdaFairValue(
      params.ebitda,
      params.sharesOutstanding!,
      params.netDebt ?? 0,
      multiple
    );
    if (val) {
      push({
        source: "EV/EBITDA",
        model: "EV/EBITDA 乘数估值",
        methodology:
          params.historicalEvEbitda != null
            ? `归一化 EBITDA × ${multiple.toFixed(1)}×（该公司自身近十年 EV/EBITDA 中位数 ${params.historicalEvEbitda.toFixed(
                1
              )}× 打9折），扣减净负债`
            : `归一化 EBITDA × ${multiple.toFixed(1)}×（按增长率推算，无历史乘数可用），扣减净负债`,
        value: val,
        annotation: "classic",
        role: "value",
        weight: MODEL_WEIGHTS.evEbitda,
      });
    }
  }

  // Dividend discount — a genuine value estimate where the dividend is the return.
  if (params.dividendPerShare && params.dividendPerShare > 0.5 && growthRate != null) {
    const val = ddmValue(params.dividendPerShare, growthRate, discountRate);
    if (val) {
      push({
        source: "Dividend Model",
        model: "股息折现模型 DDM",
        methodology: `D₁/(r−g)，r = ${(discountRate * 100).toFixed(2)}% — 适用于稳定分红股票`,
        value: val,
        annotation: "supplemental",
        role: "value",
        weight: MODEL_WEIGHTS.ddm,
      });
    }
  }

  // ===================== floor group =====================
  // These answer "what is it worth if growth stops", not "what is it worth".
  // They set the margin-of-safety band; they never enter the fair value.

  if (hasFcf && hasShares && growthRate != null) {
    const val = conservativeFcfDCF(
      params.freeCashflow!,
      growthRate,
      params.sharesOutstanding!,
      discountRate
    );
    if (val) {
      push({
        source: "ValueInvest",
        model: "保守 FCF DCF (下行情景)",
        methodology: `折现率 +200bp 至 ${(Math.min(discountRate + 0.02, 0.15) * 100).toFixed(
          2
        )}%，增速打7折，终值增长 2% — 假设空间的悲观一角，计入安全边际下限`,
        value: val,
        annotation: "conservative",
        role: "floor",
        weight: MODEL_WEIGHTS.conservativeFcf,
      });
    }
  }

  if (params.eps && params.eps > 0) {
    const val = earningsPowerValue(params.eps, discountRate);
    if (val) {
      push({
        source: "Bruce Greenwald",
        model: "盈利能力价值 EPV",
        methodology: `归一化 EPS / 资本成本 ${(discountRate * 100).toFixed(
          2
        )}% — 零增长假设下的价值，是下限而非估值`,
        value: val,
        annotation: "conservative",
        role: "floor",
        weight: MODEL_WEIGHTS.earningsPower,
      });
    }
  }

  if (params.eps && params.bvps && growthRate != null) {
    const val = residualIncomeValue(params.bvps, params.eps, growthRate, discountRate);
    if (val) {
      push({
        source: "Residual Income",
        model: "剩余收益模型 RIM",
        methodology: `每股净资产 + 超额收益(ROE−r)折现，8年线性衰减 — 以账面价值为锚，对轻资产公司系统性偏低，计入下限`,
        value: val,
        annotation: "conservative",
        role: "floor",
        weight: MODEL_WEIGHTS.residualIncome,
      });
    }
  }

  if (params.eps && params.bvps) {
    const val = grahamNumber(params.eps, params.bvps);
    if (val) {
      push({
        source: "Benjamin Graham",
        model: "格雷厄姆数字 Graham Number",
        methodology: "√(22.5 × EPS × 每股净资产) — 1930年代防御型选股筛选线，最严格的下限",
        value: val,
        annotation: "pessimistic",
        role: "floor",
        weight: MODEL_WEIGHTS.grahamNumber,
      });
    }
  }

  // ===================== reference only =====================
  // Displayed for context. Excluded from both the fair value and the floor
  // band because neither is a bounded estimate: Graham's formula multiplies
  // EPS by (8.5 + 2g), so at 20% growth it pays 48x earnings, and Lynch's
  // PEG=1 rule was written as a screen, not a valuation.

  if (params.eps && growthPct != null) {
    const val = grahamFormula(params.eps, growthPct);
    if (val) {
      push({
        source: "Benjamin Graham",
        model: "格雷厄姆内在价值公式",
        methodology: "EPS × (8.5 + 2g) × 4.4 / 债券收益率 — 高增长下会给出 40 倍以上市盈率，仅作参考，不计入加权",
        value: val,
        annotation: "classic",
        role: "reference",
        weight: MODEL_WEIGHTS.grahamFormula,
      });
    }
  }

  if (params.eps && growthPct != null && growthPct > 0) {
    const val = lynchFairValue(params.eps, growthPct);
    if (val) {
      push({
        source: "Peter Lynch",
        model: "Lynch 公允价值 (PEG=1)",
        methodology: "归一化 EPS × 增长率% — 快速筛选标尺，仅作参考，不计入加权",
        value: val,
        annotation: "optimistic",
        role: "reference",
        weight: MODEL_WEIGHTS.lynch,
      });
    }
  }

  return results;
}
