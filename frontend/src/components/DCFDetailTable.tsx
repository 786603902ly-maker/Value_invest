"use client";

import { StockValuation, DCFAnnotation, DCFRole, ValuationQuality } from "@/types/stock";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon, AlertTriangleIcon } from "lucide-react";

function fmt(v?: number, currency = "USD") {
  if (v == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtPct(v?: number) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

const ANNOTATION_CONFIG: Record<
  DCFAnnotation,
  { label: string; labelEn: string; color: string; desc: string; descEn: string }
> = {
  primary: {
    label: "核心模型 ★",
    labelEn: "Primary ★",
    color: "bg-indigo-100 text-indigo-800 border-indigo-300",
    desc: "两阶段DCF：以归一化自由现金流为起点，5年增长后线性衰减至永续增长率，折现率按历史现金流波动率调整。加权均值中权重最高（26%）",
    descEn: "2-Stage DCF on normalized free cash flow: 5 growth years fading to perpetual growth, discount rate scaled to historical cash-flow volatility. Highest single weight in the blend (26%)",
  },
  authoritative: {
    label: "最权威",
    labelEn: "Most Authoritative",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "基于实际自由现金流的折现估值，最贴近企业基本面",
    descEn: "Based on actual free cash flow discounting — closest to fundamentals",
  },
  pessimistic: {
    label: "保守下限",
    labelEn: "Conservative Floor",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    desc: "格雷厄姆数字是1930年代的防御型选股筛选线，非估值模型。仅作下限标记，权重 2%",
    descEn: "The Graham Number is a 1930s defensive screening threshold, not a valuation model. Kept as a floor marker at 2% weight",
  },
  classic: {
    label: "经典公式",
    labelEn: "Classic Formula",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    desc: "本杰明·格雷厄姆经典内在价值公式，综合EPS与成长性",
    descEn: "Benjamin Graham's classic intrinsic value formula combining EPS and growth",
  },
  optimistic: {
    label: "成长乐观",
    labelEn: "Growth Optimistic",
    color: "bg-green-100 text-green-800 border-green-200",
    desc: "彼得·林奇公式：PEG=1时的理论价值。原为快速筛选标尺，权重 2%",
    descEn: "Peter Lynch formula: fair value at PEG=1. Designed as a quick screen, so 2% weight",
  },
  supplemental: {
    label: "补充参考",
    labelEn: "Supplemental",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    desc: "股息折现模型，适用于稳定分红的成熟企业",
    descEn: "Dividend Discount Model, best for mature dividend-paying companies",
  },
  external: {
    label: "外部来源",
    labelEn: "External Source",
    color: "bg-teal-100 text-teal-800 border-teal-200",
    desc: "来自第三方机构的DCF估值，提供独立视角",
    descEn: "DCF valuation from a third-party institution for an independent perspective",
  },
  conservative: {
    label: "保守基准",
    labelEn: "Conservative Base",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    desc: "下行情景：折现率 +200bp、增速打7折、终值增长2% — 代表假设空间的悲观一角，权重 10%",
    descEn: "Downside case: +200bp discount rate, growth cut 30%, 2% terminal growth — the pessimistic corner of the assumption space, 10% weight",
  },
};


const ROLE_CONFIG: Record<DCFRole, { label: string; labelEn: string; color: string }> = {
  value: {
    label: "计入估值",
    labelEn: "In fair value",
    color: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  floor: {
    label: "安全边际下限",
    labelEn: "Floor",
    color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300",
  },
  reference: {
    label: "仅参考",
    labelEn: "Reference",
    color: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
  },
};

const CONFIDENCE_CONFIG = {
  high: {
    label: "高置信度",
    labelEn: "High confidence",
    color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300",
  },
  medium: {
    label: "中等置信度",
    labelEn: "Medium confidence",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  low: {
    label: "低置信度",
    labelEn: "Low confidence",
    color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  },
} as const;

function bn(v?: number): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toFixed(0);
}

function rate(v?: number): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * Shows what the fair value was actually built from. The point estimate alone
 * hides the two things that decide whether it means anything: which inputs were
 * normalized away from the trailing snapshot, and how much the models agree.
 */
function QualityPanel({ q, locale }: { q: ValuationQuality; locale: string }) {
  const zh = locale === "zh";
  const cfg = CONFIDENCE_CONFIG[q.confidence];

  const rows: { label: string; labelEn: string; ttm: string; used: string }[] = [];
  if (q.ttm_fcf != null || q.normalized_fcf != null) {
    rows.push({
      label: "自由现金流",
      labelEn: "Free cash flow",
      ttm: bn(q.ttm_fcf),
      used: bn(q.normalized_fcf),
    });
  }
  if (q.ttm_eps != null || q.normalized_eps != null) {
    rows.push({
      label: "每股收益 EPS",
      labelEn: "EPS",
      ttm: q.ttm_eps != null ? q.ttm_eps.toFixed(2) : "—",
      used: q.normalized_eps != null ? q.normalized_eps.toFixed(2) : "—",
    });
  }
  if (q.growth_rate_raw != null || q.growth_rate_used != null) {
    rows.push({
      label: "增长率",
      labelEn: "Growth rate",
      ttm: rate(q.growth_rate_raw),
      used: rate(q.growth_rate_used),
    });
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/20">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {zh ? "估值输入归一化" : "Input normalization"}
        </span>
        <Badge variant="outline" className={`text-xs ${cfg.color}`}>
          {zh ? cfg.label : cfg.labelEn}
        </Badge>
        {q.capex_spike && (
          <Badge
            variant="outline"
            className="text-xs bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {zh ? "资本开支高峰期" : "Capex build-out"}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {zh
            ? `${q.years_of_data ?? 0} 年历史 · ${q.model_count ?? 0} 个模型入选`
            : `${q.years_of_data ?? 0} yrs of history · ${q.model_count ?? 0} models used`}
        </span>
      </div>

      {rows.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium py-1">{zh ? "输入项" : "Input"}</th>
              <th className="text-right font-medium py-1">
                {zh ? "最近12个月报告值" : "Trailing 12M reported"}
              </th>
              <th className="text-right font-medium py-1">
                {zh ? "模型采用值（归一化）" : "Used by models (normalized)"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{zh ? r.label : r.labelEn}</td>
                <td className="py-1 text-right font-mono text-muted-foreground">{r.ttm}</td>
                <td className="py-1 text-right font-mono font-medium">{r.used}</td>
              </tr>
            ))}
            <tr className="border-t">
              <td className="py-1">{zh ? "折现率 / 终值增长" : "Discount / terminal growth"}</td>
              <td className="py-1 text-right font-mono text-muted-foreground">
                {zh ? "固定 10% / 2.5%" : "was fixed 10% / 2.5%"}
              </td>
              <td className="py-1 text-right font-mono font-medium">
                {rate(q.discount_rate_used)} / {rate(q.terminal_growth_used)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {(q.fcf_volatility != null || q.earnings_volatility != null) && (
        <div className="text-xs text-muted-foreground">
          {zh ? "历史波动系数（变异系数）：" : "Historical volatility (coeff. of variation): "}
          {q.fcf_volatility != null && `FCF ${q.fcf_volatility.toFixed(2)}`}
          {q.fcf_volatility != null && q.earnings_volatility != null && " · "}
          {q.earnings_volatility != null &&
            `${zh ? "盈利" : "earnings"} ${q.earnings_volatility.toFixed(2)}`}
          {zh ? " — 波动越大，折现率越高" : " — higher volatility raises the discount rate"}
        </div>
      )}

      {!!q.adjustments?.length && (
        <ul className="space-y-1">
          {q.adjustments.map((a, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
              <span className="text-primary/60">·</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  stock: StockValuation;
}

export default function DCFDetailTable({ stock }: Props) {
  const { locale } = useI18n();
  const sources = stock.dcf_fair_value.sources;
  const currentPrice = stock.current_price;

  if (!sources.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {locale === "zh"
          ? "暂无DCF数据 — 需要EPS、自由现金流或账面价值数据"
          : "No DCF data — EPS, free cash flow, or book value data required"}
      </div>
    );
  }

  const avg = stock.dcf_fair_value.avg;
  const quality = stock.valuation_quality;
  // Weights are renormalized over the VALUE models that passed the outlier
  // guard, so the column adds up to 100% of what actually drove the number.
  const totalReliableWeight =
    sources.reduce(
      (sum, s) => ((s.role ?? "value") === "value" && s.reliable !== false ? sum + (s.weight ?? 0) : sum),
      0
    ) || 1;
  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "DCF 加权均值" : "DCF Weighted Avg"}
          </div>
          <div className="text-lg font-bold">{fmt(avg, stock.currency)}</div>
          {currentPrice != null && avg != null && (
            <div
              className={`text-xs font-medium mt-1 ${
                currentPrice > avg ? "text-red-600" : "text-green-600"
              }`}
            >
              {fmtPct(((currentPrice - avg) / avg) * 100)}
              {locale === "zh" ? " 偏离" : " deviation"}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "模型集中区间 (P25–P75)" : "Model core range (P25–P75)"}
          </div>
          <div className="text-lg font-bold">
            {quality?.fair_value_low != null && quality?.fair_value_high != null
              ? `${fmt(quality.fair_value_low, stock.currency)} – ${fmt(
                  quality.fair_value_high,
                  stock.currency
                )}`
              : "N/A"}
          </div>
          {quality?.dispersion != null && (
            <div className="text-xs text-muted-foreground mt-1">
              {locale === "zh" ? "模型离散度 " : "dispersion "}
              {(quality.dispersion * 100).toFixed(0)}%
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "安全边际下限" : "Margin-of-safety floor"}
          </div>
          <div className="text-lg font-bold text-orange-600">
            {fmt(quality?.floor_value, stock.currency)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {locale === "zh" ? "零增长/账面类模型中位数" : "median of no-growth models"}
          </div>
        </div>
      </div>

      {quality && <QualityPanel q={quality} locale={locale} />}

      {/* Detail rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 pr-4 font-medium">
                {locale === "zh" ? "模型" : "Model"}
              </th>
              <th className="text-left py-2 pr-4 font-medium">
                {locale === "zh" ? "来源" : "Source"}
              </th>
              <th className="text-right py-2 pr-4 font-medium">
                {locale === "zh" ? "公允价值" : "Fair Value"}
              </th>
              <th className="text-right py-2 pr-4 font-medium">
                {locale === "zh" ? "与现价偏离" : "vs Current"}
              </th>
              <th className="text-center py-2 pr-4 font-medium">
                {locale === "zh" ? "作用" : "Role"}
              </th>
              <th className="text-right py-2 pr-4 font-medium">
                {locale === "zh" ? "权重" : "Weight"}
              </th>
              <th className="text-center py-2 font-medium">
                {locale === "zh" ? "参考类型" : "Type"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => {
              const role: DCFRole = s.role ?? "value";
              const annotation = s.annotation ?? "supplemental";
              const cfg = ANNOTATION_CONFIG[annotation];
              const isPrimary = annotation === "primary";
              const deviation =
                currentPrice != null
                  ? ((currentPrice - s.value) / s.value) * 100
                  : undefined;

              return (
                <tr
                  key={i}
                  className={`border-b last:border-0 transition-colors ${
                    isPrimary
                      ? "bg-indigo-50/60 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      : "hover:bg-muted/20"
                  }`}
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium">{s.model || "DCF"}</div>
                    {s.methodology && (
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-[280px] leading-relaxed">
                        {s.methodology}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{s.source}</td>
                  <td className="py-3 pr-4 text-right font-mono font-medium">
                    <div className="flex items-center justify-end gap-1.5">
                      {s.reliable === false && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px]">
                            {locale === "zh"
                              ? "此值显著偏离分析师目标区间，可能是模型假设与该股票特性不匹配，不计入平均值。"
                              : "This value deviates significantly from the analyst target range. Excluded from the average."}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span className={s.reliable === false ? "text-muted-foreground line-through" : ""}>
                        {fmt(s.value, stock.currency)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {deviation != null ? (
                      <span
                        className={`font-medium ${
                          deviation > 10
                            ? "text-red-600"
                            : deviation < -10
                            ? "text-green-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {fmtPct(deviation)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <Badge variant="outline" className={`text-xs ${ROLE_CONFIG[role].color}`}>
                      {locale === "zh" ? ROLE_CONFIG[role].label : ROLE_CONFIG[role].labelEn}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-xs text-muted-foreground">
                    {role === "value"
                      ? s.reliable === false
                        ? "0%"
                        : `${(((s.weight ?? 0) / totalReliableWeight) * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="py-3 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-1 cursor-help">
                          <Badge
                            variant="outline"
                            className={`text-xs ${cfg.color}`}
                          >
                            {locale === "zh" ? cfg.label : cfg.labelEn}
                          </Badge>
                          <InfoIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px]">
                        {locale === "zh" ? cfg.desc : cfg.descEn}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="pt-2 border-t space-y-2">
        <p className="text-xs text-muted-foreground">
          {locale === "zh"
            ? `💡 只有「计入估值」的模型参与加权——它们估的是同一个量：持续经营企业的内在价值。「安全边际下限」类模型（EPV零增长、剩余收益、格雷厄姆数字、保守下行）估的是另一个量：增长停止时值多少，因此单列为下限而不混入均值——把估值和下限平均，得到的既不是估值也不是下限。「仅参考」类（格雷厄姆公式、Lynch）不是有界估计，只作标尺。`
            : `💡 Only "In fair value" models are averaged — they estimate the same quantity: the intrinsic value of a going concern. "Floor" models (zero-growth EPV, residual income, Graham Number, the downside DCF) estimate a different one: what it is worth if growth stops, so they set the margin-of-safety band instead of being averaged in — blending a valuation with a floor gives neither. "Reference" models are unbounded rules of thumb, shown as context only.`}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {locale === "zh"
            ? "⚠️ DCF 估值高度依赖增长率、折现率等假设参数，不同模型间可能存在非常大的偏差。置信度标签与模型离散度反映的是模型之间的一致程度，不代表估值正确。请仅将其作为众多估值指标中的一个参考维度，结合分析师目标价、PEG、远期 P/E 等综合判断。"
            : "⚠️ DCF valuations are highly sensitive to assumptions (growth rate, discount rate, etc.) and can vary significantly across models. The confidence label and dispersion measure how much the models agree with each other, not whether they are right. Use them as just one reference among many — combine with analyst targets, PEG, forward P/E, and other metrics."}
        </p>
      </div>
    </div>
  );
}
