/**
 * Valuation self-test.
 *
 * The fixtures below are SYNTHETIC. They are hand-built shapes of financial
 * history — not any real company's reported figures — used to check that the
 * normalization layer behaves correctly on each shape. No number here should be
 * read as data about any listed company.
 *
 * Run: npx tsx scripts/valuation-selftest.ts
 */
import { normalizeInputs } from "../src/lib/data/normalize";
import { buildDCFModels } from "../src/lib/data/dcf-models";
import { markReliability, weightedFairValue } from "../src/lib/data/aggregator";
import type { AnnualFinancials, FinancialHistory } from "../src/lib/data/history";
import type { SourceValue } from "../src/types/stock";

const B = 1e9;
const SHARES = 2.5e9;

interface YearSpec {
  year: number;
  revenue: number; // in $B
  ocfMargin: number;
  capexIntensity: number;
  netMargin: number;
  /** Reported net income margin, if a one-off charge made it differ from normalized. */
  reportedNetMargin?: number;
}

function buildHistory(spec: YearSpec[]): FinancialHistory {
  const annual: AnnualFinancials[] = spec.map((y) => {
    const revenue = y.revenue * B;
    const ocf = revenue * y.ocfMargin;
    const capex = revenue * y.capexIntensity;
    const normalizedIncome = revenue * y.netMargin;
    const netIncome = revenue * (y.reportedNetMargin ?? y.netMargin);
    return {
      fiscalYear: y.year,
      date: `${y.year}-12-31`,
      revenue,
      netIncome,
      normalizedIncome,
      ebitda: revenue * (y.netMargin + 0.12),
      normalizedEbitda: revenue * (y.netMargin + 0.12),
      operatingCashFlow: ocf,
      capex,
      freeCashFlow: ocf - capex,
      depreciation: revenue * 0.1,
      dilutedEPS: netIncome / SHARES,
      dilutedShares: SHARES,
      stockholdersEquity: revenue * 1.2,
      totalDebt: 30 * B,
      cash: 45 * B,
      netDebt: -15 * B,
    };
  });
  return { annual, provider: "yahoo" };
}

interface Scenario {
  name: string;
  expectation: string;
  years: YearSpec[];
  ttm: {
    revenue: number;
    ocfMargin: number;
    capexIntensity: number;
    netMargin: number;
    reportedNetMargin?: number;
  };
  earningsGrowthTTM: number;
  revenueGrowthTTM: number;
  analystLongTermGrowth?: number;
  price: number;
}

const SCENARIOS: Scenario[] = [
  {
    name: "A 资本开支高峰 (capex build-out)",
    expectation: "归一化 FCF 应显著高于 TTM FCF；capexSpike=true；公允价值不被低谷 FCF 永续化",
    years: [
      { year: 2019, revenue: 86, ocfMargin: 0.45, capexIntensity: 0.12, netMargin: 0.3 },
      { year: 2020, revenue: 100, ocfMargin: 0.45, capexIntensity: 0.12, netMargin: 0.3 },
      { year: 2021, revenue: 118, ocfMargin: 0.45, capexIntensity: 0.13, netMargin: 0.31 },
      { year: 2022, revenue: 130, ocfMargin: 0.44, capexIntensity: 0.12, netMargin: 0.29 },
      { year: 2023, revenue: 160, ocfMargin: 0.46, capexIntensity: 0.12, netMargin: 0.31 },
      { year: 2024, revenue: 195, ocfMargin: 0.45, capexIntensity: 0.15, netMargin: 0.3 },
    ],
    ttm: { revenue: 230, ocfMargin: 0.45, capexIntensity: 0.28, netMargin: 0.3 },
    earningsGrowthTTM: 0.18,
    revenueGrowthTTM: 0.2,
    analystLongTermGrowth: 0.16,
    price: 650,
  },
  {
    name: "B 一次性费用 (one-off charge)",
    expectation: "归一化 EPS 应高于 TTM EPS；负增长的单季同比不应主导十年增长假设",
    years: [
      { year: 2019, revenue: 86, ocfMargin: 0.44, capexIntensity: 0.13, netMargin: 0.3 },
      { year: 2020, revenue: 100, ocfMargin: 0.45, capexIntensity: 0.13, netMargin: 0.31 },
      { year: 2021, revenue: 118, ocfMargin: 0.45, capexIntensity: 0.14, netMargin: 0.3 },
      { year: 2022, revenue: 130, ocfMargin: 0.44, capexIntensity: 0.13, netMargin: 0.3 },
      { year: 2023, revenue: 160, ocfMargin: 0.45, capexIntensity: 0.13, netMargin: 0.31 },
      { year: 2024, revenue: 195, ocfMargin: 0.45, capexIntensity: 0.14, netMargin: 0.3 },
    ],
    // Reported margin halved by a one-time charge; normalized margin unaffected.
    ttm: { revenue: 230, ocfMargin: 0.45, capexIntensity: 0.14, netMargin: 0.3, reportedNetMargin: 0.15 },
    earningsGrowthTTM: -0.42,
    revenueGrowthTTM: 0.2,
    analystLongTermGrowth: 0.15,
    price: 650,
  },
  {
    name: "C 真实经营恶化 (structural decline) — 负向对照",
    expectation: "归一化不得把持续恶化的业务拉回历史中位数；公允价值应保持在低位",
    years: [
      { year: 2019, revenue: 100, ocfMargin: 0.42, capexIntensity: 0.08, netMargin: 0.28 },
      { year: 2020, revenue: 102, ocfMargin: 0.38, capexIntensity: 0.08, netMargin: 0.24 },
      { year: 2021, revenue: 104, ocfMargin: 0.33, capexIntensity: 0.08, netMargin: 0.2 },
      { year: 2022, revenue: 103, ocfMargin: 0.28, capexIntensity: 0.08, netMargin: 0.16 },
      { year: 2023, revenue: 101, ocfMargin: 0.23, capexIntensity: 0.08, netMargin: 0.12 },
      { year: 2024, revenue: 98, ocfMargin: 0.2, capexIntensity: 0.08, netMargin: 0.09 },
    ],
    ttm: { revenue: 96, ocfMargin: 0.18, capexIntensity: 0.08, netMargin: 0.07 },
    earningsGrowthTTM: -0.2,
    revenueGrowthTTM: -0.03,
    price: 60,
  },
  {
    name: "D 稳定复利机 (stable compounder)",
    expectation: "低波动 → 折现率接近下限；confidence 应为 high",
    years: [
      { year: 2019, revenue: 100, ocfMargin: 0.34, capexIntensity: 0.05, netMargin: 0.25 },
      { year: 2020, revenue: 108, ocfMargin: 0.34, capexIntensity: 0.05, netMargin: 0.25 },
      { year: 2021, revenue: 117, ocfMargin: 0.35, capexIntensity: 0.05, netMargin: 0.26 },
      { year: 2022, revenue: 126, ocfMargin: 0.34, capexIntensity: 0.05, netMargin: 0.25 },
      { year: 2023, revenue: 136, ocfMargin: 0.35, capexIntensity: 0.05, netMargin: 0.25 },
      { year: 2024, revenue: 147, ocfMargin: 0.34, capexIntensity: 0.05, netMargin: 0.25 },
    ],
    ttm: { revenue: 158, ocfMargin: 0.34, capexIntensity: 0.05, netMargin: 0.25 },
    earningsGrowthTTM: 0.08,
    revenueGrowthTTM: 0.08,
    analystLongTermGrowth: 0.08,
    price: 200,
  },
  {
    name: "E 强周期股 (volatile cyclical)",
    expectation: "高波动 → 折现率上浮；confidence 不应为 high",
    years: [
      { year: 2019, revenue: 100, ocfMargin: 0.3, capexIntensity: 0.15, netMargin: 0.18 },
      { year: 2020, revenue: 70, ocfMargin: 0.12, capexIntensity: 0.14, netMargin: 0.02 },
      { year: 2021, revenue: 130, ocfMargin: 0.38, capexIntensity: 0.16, netMargin: 0.26 },
      { year: 2022, revenue: 145, ocfMargin: 0.4, capexIntensity: 0.18, netMargin: 0.28 },
      { year: 2023, revenue: 85, ocfMargin: 0.15, capexIntensity: 0.16, netMargin: 0.04 },
      { year: 2024, revenue: 120, ocfMargin: 0.33, capexIntensity: 0.15, netMargin: 0.22 },
    ],
    ttm: { revenue: 132, ocfMargin: 0.35, capexIntensity: 0.15, netMargin: 0.24 },
    earningsGrowthTTM: 0.9,
    revenueGrowthTTM: 0.1,
    analystLongTermGrowth: 0.12,
    price: 110,
  },
];

function runPipeline(sc: Scenario, useHistory: boolean) {
  const history: FinancialHistory = useHistory
    ? buildHistory(sc.years)
    : { annual: [], provider: "none" };

  const revenueTTM = sc.ttm.revenue * B;
  const ocfTTM = revenueTTM * sc.ttm.ocfMargin;
  const fcfTTM = ocfTTM - revenueTTM * sc.ttm.capexIntensity;
  const epsTTM = (revenueTTM * (sc.ttm.reportedNetMargin ?? sc.ttm.netMargin)) / SHARES;

  const hist: FinancialHistory = {
    ...history,
    trailing: useHistory
      ? {
          revenue: revenueTTM,
          netIncome: revenueTTM * (sc.ttm.reportedNetMargin ?? sc.ttm.netMargin),
          normalizedIncome: revenueTTM * sc.ttm.netMargin,
          ebitda: revenueTTM * (sc.ttm.netMargin + 0.12),
        }
      : undefined,
  };

  const norm = normalizeInputs({
    history: hist,
    revenueTTM,
    freeCashflowTTM: fcfTTM,
    operatingCashflowTTM: ocfTTM,
    ebitdaTTM: revenueTTM * (sc.ttm.netMargin + 0.12),
    epsTTM,
    bvps: (sc.ttm.revenue * 1.2 * B) / SHARES,
    sharesOutstanding: SHARES,
    netDebt: -15 * B,
    earningsGrowthTTM: sc.earningsGrowthTTM,
    revenueGrowthTTM: sc.revenueGrowthTTM,
    analystLongTermGrowth: sc.analystLongTermGrowth,
  });

  const models = buildDCFModels({
    freeCashflow: norm.freeCashflow,
    eps: norm.eps,
    bvps: norm.bvps,
    earningsGrowthRate: norm.growthRate,
    sharesOutstanding: SHARES,
    ebitda: norm.ebitda,
    netDebt: norm.netDebt,
    discountRate: norm.discountRate,
    terminalGrowth: norm.terminalGrowth,
  });

  const sources: SourceValue[] = models.map((m) => ({
    source: m.source,
    value: m.value,
    model: m.model,
    annotation: m.annotation,
    weight: m.weight,
  }));
  const flags = markReliability(sources.map((s) => s.value), sc.price);
  sources.forEach((s, i) => (s.reliable = flags[i]));

  return { norm, sources, fair: weightedFairValue(sources), fcfTTM, epsTTM };
}

const pct = (v?: number) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const bn = (v?: number) => (v == null ? "n/a" : `${(v / B).toFixed(1)}B`);

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`);
}

for (const sc of SCENARIOS) {
  const withHist = runPipeline(sc, true);
  const ttmOnly = runPipeline(sc, false);

  console.log(`\n=== ${sc.name} ===`);
  console.log(`   预期: ${sc.expectation}`);
  console.log(
    `   FCF   TTM ${bn(withHist.fcfTTM)} → 归一化 ${bn(withHist.norm.freeCashflow)}` +
      `   (股东盈余 ${bn(withHist.norm.ownerEarnings)})`
  );
  console.log(
    `   EPS   TTM ${withHist.epsTTM.toFixed(2)} → 归一化 ${withHist.norm.eps?.toFixed(2)}`
  );
  console.log(
    `   增长率 单季 ${pct(sc.earningsGrowthTTM)} → 多源中位数 ${pct(withHist.norm.growthRate)}` +
      `   [${withHist.norm.diagnostics.growthSources.map((g) => `${g.label} ${pct(g.value)}`).join(", ")}]`
  );
  console.log(
    `   折现率 ${pct(withHist.norm.discountRate)}  终值增长 ${pct(withHist.norm.terminalGrowth)}` +
      `  FCF波动 ${withHist.norm.diagnostics.fcfVolatility ?? "n/a"}` +
      `  盈利波动 ${withHist.norm.diagnostics.earningsVolatility ?? "n/a"}` +
      `  capexSpike=${withHist.norm.diagnostics.capexSpike}`
  );
  console.log(
    `   公允价值  仅TTM输入 $${ttmOnly.fair?.toFixed(2)}  →  归一化后 $${withHist.fair?.toFixed(2)}` +
      `   (相对现价 $${sc.price} 偏离 ${
        withHist.fair ? (((sc.price - withHist.fair) / withHist.fair) * 100).toFixed(1) : "n/a"
      }%)`
  );
  const reliable = withHist.sources.filter((s) => s.reliable !== false);
  console.log(`   模型数 ${withHist.sources.length}，通过离群检验 ${reliable.length}`);
  for (const s of withHist.sources) {
    console.log(
      `      ${s.reliable === false ? "x" : " "} ${(s.model || "").padEnd(28)} $${s.value
        .toFixed(2)
        .padStart(9)}  w=${((s.weight ?? 0) * 100).toFixed(0)}%`
    );
  }
  for (const a of withHist.norm.diagnostics.adjustments) console.log(`      · ${a}`);

  // ---- assertions
  if (sc.name.startsWith("A")) {
    check("capex 高峰被识别", withHist.norm.diagnostics.capexSpike, `capexSpike=${withHist.norm.diagnostics.capexSpike}`);
    check(
      "归一化 FCF 高于 TTM 低谷值",
      (withHist.norm.freeCashflow ?? 0) > withHist.fcfTTM * 1.3,
      `${bn(withHist.norm.freeCashflow)} vs TTM ${bn(withHist.fcfTTM)}`
    );
    check(
      "公允价值高于仅用 TTM 输入的结果",
      (withHist.fair ?? 0) > (ttmOnly.fair ?? 0) * 1.2,
      `$${withHist.fair} vs $${ttmOnly.fair}`
    );
  }
  if (sc.name.startsWith("B")) {
    check(
      "归一化 EPS 高于被一次性费用压低的 TTM EPS",
      (withHist.norm.eps ?? 0) > withHist.epsTTM * 1.2,
      `${withHist.norm.eps?.toFixed(2)} vs TTM ${withHist.epsTTM.toFixed(2)}`
    );
    check(
      "增长率未被 -42% 的单季同比主导",
      (withHist.norm.growthRate ?? -1) > 0,
      `${pct(withHist.norm.growthRate)}`
    );
  }
  if (sc.name.startsWith("C")) {
    check(
      "持续恶化的业务未被归一化拉高（FCF 上调 < 25%）",
      (withHist.norm.freeCashflow ?? 0) < withHist.fcfTTM * 1.25,
      `${bn(withHist.norm.freeCashflow)} vs TTM ${bn(withHist.fcfTTM)}`
    );
    check(
      "增长率为负",
      (withHist.norm.growthRate ?? 1) < 0,
      `${pct(withHist.norm.growthRate)}`
    );
  }
  if (sc.name.startsWith("D")) {
    check(
      "低波动 → 折现率 ≤ 9.5%",
      withHist.norm.discountRate <= 0.095,
      pct(withHist.norm.discountRate)
    );
  }
  if (sc.name.startsWith("E")) {
    check(
      "高波动 → 折现率 ≥ 10.5%",
      withHist.norm.discountRate >= 0.105,
      pct(withHist.norm.discountRate)
    );
    check(
      "增长率未被 +90% 的单季反弹主导",
      (withHist.norm.growthRate ?? 1) < 0.25,
      pct(withHist.norm.growthRate)
    );
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
