export type DCFAnnotation =
  | "primary"
  | "authoritative"
  | "optimistic"
  | "pessimistic"
  | "classic"
  | "supplemental"
  | "conservative";

export interface ComputedDCF {
  source: string;
  model: string;
  methodology: string;
  value: number;
  annotation: DCFAnnotation;
  /** Base weight in the blended fair value, before renormalization. */
  weight: number;
}

/**
 * Base weights. They express how much evidence each model carries about the
 * value of a going concern, not how conservative it is:
 *  - cash-flow models dominate, because they value the actual cash the business
 *    produces;
 *  - single-ratio rules of thumb (Graham Number, Lynch) are kept as context
 *    markers at low weight — they were designed as screens, not as valuations,
 *    and giving them equal weight was pulling the blend toward a floor.
 * Weights are renormalized over whichever models are available and pass the
 * outlier guard, so a missing model never silently reweights the rest.
 */
export const MODEL_WEIGHTS = {
  twoStage: 0.26,
  tenYearFade: 0.13,
  conservativeFcf: 0.1,
  fiveYearFcf: 0.08,
  external: 0.1, // shared across all third-party DCF values
  evEbitda: 0.09,
  residualIncome: 0.08,
  earningsPower: 0.07,
  grahamFormula: 0.05,
  ddm: 0.05,
  lynch: 0.02,
  grahamNumber: 0.02,
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
}

export function buildDCFModels(params: BuildDCFParams): ComputedDCF[] {
  const results: ComputedDCF[] = [];
  const discountRate = params.discountRate ?? 0.1;
  const terminalGrowth = params.terminalGrowth ?? 0.025;
  const growthRate = params.earningsGrowthRate;
  const growthPct = growthRate != null ? growthRate * 100 : undefined;
  const rateNote = `折现率 ${(discountRate * 100).toFixed(2)}%（按历史现金流波动率调整）`;

  const push = (m: ComputedDCF | null) => {
    if (m && m.value > 0) results.push(m);
  };

  const hasFcf = params.freeCashflow != null && params.freeCashflow > 0;
  const hasShares = params.sharesOutstanding != null && params.sharesOutstanding > 0;

  // 0. Primary — two-stage fading DCF on normalized FCF.
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
        weight: MODEL_WEIGHTS.twoStage,
      });
    }
  }

  // 1. 10-year fade DCF — same shape, growth haircut 10%, no net-cash bridge.
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
        weight: MODEL_WEIGHTS.tenYearFade,
      });
    }
  }

  // 2. 5-year FCF DCF.
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
        weight: MODEL_WEIGHTS.fiveYearFcf,
      });
    }
  }

  // 3. Conservative downside case.
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
        )}%，增速打7折，终值增长 2% — 下行情景参考`,
        value: val,
        annotation: "conservative",
        weight: MODEL_WEIGHTS.conservativeFcf,
      });
    }
  }

  // 4. EV/EBITDA multiple.
  if (params.ebitda && hasShares) {
    const val = evEbitdaFairValue(params.ebitda, params.sharesOutstanding!, params.netDebt ?? 0);
    if (val) {
      push({
        source: "EV/EBITDA",
        model: "EV/EBITDA 乘数估值",
        methodology: "归一化 EBITDA × 12× 保守乘数，扣减净负债 — 相对估值法",
        value: val,
        annotation: "classic",
        weight: MODEL_WEIGHTS.evEbitda,
      });
    }
  }

  // 5. Residual income.
  if (params.eps && params.bvps && growthRate != null) {
    const val = residualIncomeValue(params.bvps, params.eps, growthRate, discountRate);
    if (val) {
      push({
        source: "Residual Income",
        model: "剩余收益模型 RIM",
        methodology: `每股净资产 + 超额收益(ROE−r)折现，超额收益按8年线性衰减 | 要求回报率 ${(
          discountRate * 100
        ).toFixed(2)}%`,
        value: val,
        annotation: "classic",
        weight: MODEL_WEIGHTS.residualIncome,
      });
    }
  }

  // 6. Earnings power value — zero-growth floor on normalized EPS.
  if (params.eps && params.eps > 0) {
    const val = earningsPowerValue(params.eps, discountRate);
    if (val) {
      push({
        source: "Bruce Greenwald",
        model: "盈利能力价值 EPV",
        methodology: `归一化 EPS / 资本成本 ${(discountRate * 100).toFixed(2)}% — 零增长假设下的价值`,
        value: val,
        annotation: "conservative",
        weight: MODEL_WEIGHTS.earningsPower,
      });
    }
  }

  // 7. Graham intrinsic value formula.
  if (params.eps && growthPct != null) {
    const val = grahamFormula(params.eps, growthPct);
    if (val) {
      push({
        source: "Benjamin Graham",
        model: "格雷厄姆内在价值公式",
        methodology: "EPS × (8.5 + 2g) × 4.4 / 债券收益率，g 为归一化增长率",
        value: val,
        annotation: "classic",
        weight: MODEL_WEIGHTS.grahamFormula,
      });
    }
  }

  // 8. Lynch PEG=1 — context marker only.
  if (params.eps && growthPct != null && growthPct > 0) {
    const val = lynchFairValue(params.eps, growthPct);
    if (val) {
      push({
        source: "Peter Lynch",
        model: "Lynch 公允价值 (PEG=1)",
        methodology: "归一化 EPS × 增长率% — 参考标尺，权重 2%",
        value: val,
        annotation: "optimistic",
        weight: MODEL_WEIGHTS.lynch,
      });
    }
  }

  // 9. Graham Number — floor marker only.
  if (params.eps && params.bvps) {
    const val = grahamNumber(params.eps, params.bvps);
    if (val) {
      push({
        source: "Benjamin Graham",
        model: "格雷厄姆数字 Graham Number",
        methodology: "√(22.5 × EPS × 每股净资产) — 1930年代防御型选股筛选线，仅作下限标记，权重 2%",
        value: val,
        annotation: "pessimistic",
        weight: MODEL_WEIGHTS.grahamNumber,
      });
    }
  }

  // 10. DDM — only where the dividend is a meaningful part of the return.
  if (params.dividendPerShare && params.dividendPerShare > 0.5 && growthRate != null) {
    const val = ddmValue(params.dividendPerShare, growthRate, discountRate);
    if (val) {
      push({
        source: "Dividend Model",
        model: "股息折现模型 DDM",
        methodology: `D₁/(r−g)，r = ${(discountRate * 100).toFixed(2)}% — 适用于稳定分红股票`,
        value: val,
        annotation: "supplemental",
        weight: MODEL_WEIGHTS.ddm,
      });
    }
  }

  return results;
}
