"use client";

import { StockValuation, DCFAnnotation } from "@/types/stock";
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
    desc: "两阶段DCF：10年高增长FCF折现 + Gordon增长终值，最核心的估值参考，在加权平均中占50%权重",
    descEn: "2-Stage DCF: 10-yr high-growth FCF discounting + Gordon Growth terminal value — primary anchor, 50% weight in the weighted average",
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
    desc: "格雷厄姆数字提供安全边际下限，适合极度保守的投资者参考",
    descEn: "Graham Number provides a margin-of-safety floor for very conservative investors",
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
    desc: "彼得·林奇公式：PEG=1时的理论价值，适合高成长股参考",
    descEn: "Peter Lynch formula: fair value when PEG=1, best for growth stocks",
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
    desc: "面向保守价值投资者的基准：更高折现率、更低增长假设，平均值权重 >50%",
    descEn: "Conservative benchmark with higher discount rate and lower growth assumption — gets >50% weight in the average",
  },
};

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
  const min = stock.dcf_fair_value.min;
  const max = stock.dcf_fair_value.max;
  const primarySource = sources.find((s) => s.annotation === "primary");

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
            {locale === "zh" ? "悲观下限" : "Pessimistic"}
          </div>
          <div className="text-lg font-bold text-orange-600">{fmt(min, stock.currency)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "乐观上限" : "Optimistic"}
          </div>
          <div className="text-lg font-bold text-green-600">{fmt(max, stock.currency)}</div>
        </div>
      </div>

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
              <th className="text-center py-2 font-medium">
                {locale === "zh" ? "参考类型" : "Type"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => {
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
            ? `💡 ★ 两阶段DCF为核心模型，在加权均值中占50%权重；其余模型均分剩余50%。偏差 >20% 通常具有投资意义。`
            : `💡 ★ The 2-Stage DCF is the primary model, contributing 50% of the weighted average; all other models share the remaining 50%. Deviations >20% are typically investment-relevant.`}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {locale === "zh"
            ? "⚠️ DCF 估值高度依赖增长率、折现率等假设参数，不同模型间可能存在非常大的偏差。请仅将其作为众多估值指标中的一个参考维度，结合分析师目标价、PEG、远期 P/E 等综合判断。"
            : "⚠️ DCF valuations are highly sensitive to assumptions (growth rate, discount rate, etc.) and can vary significantly across models. Please use them as just one reference among many — combine with analyst targets, PEG, forward P/E, and other metrics for a complete picture."}
        </p>
      </div>
    </div>
  );
}
