"use client";

import { StockValuation } from "@/types/stock";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

function fmt(v?: number, currency = "USD") {
  if (v == null) return "—";
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

function deviationColor(pct?: number) {
  if (pct == null) return "text-muted-foreground";
  if (pct > 10) return "text-red-600";
  if (pct < -10) return "text-green-600";
  return "text-yellow-600";
}

interface Props {
  stock: StockValuation;
}

export default function TargetPriceDetailTable({ stock }: Props) {
  const { locale } = useI18n();
  const sources = stock.target_price.sources;
  const currentPrice = stock.current_price;

  if (!sources.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {locale === "zh" ? "暂无分析师目标价数据" : "No analyst target price data available"}
      </div>
    );
  }

  const avg = stock.target_price.avg;
  const min = stock.target_price.min;
  const max = stock.target_price.max;

  const avgDeviation =
    currentPrice != null && avg != null
      ? ((currentPrice - avg) / avg) * 100
      : undefined;
  const minDeviation =
    currentPrice != null && min != null
      ? ((currentPrice - min) / min) * 100
      : undefined;
  const maxDeviation =
    currentPrice != null && max != null
      ? ((currentPrice - max) / max) * 100
      : undefined;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "目标价均值" : "Average Target"}
          </div>
          <div className="text-lg font-bold">{fmt(avg, stock.currency)}</div>
          {avgDeviation != null && (
            <div className={`text-xs font-medium mt-1 ${deviationColor(avgDeviation)}`}>
              {fmtPct(avgDeviation)}
              {locale === "zh" ? " 偏离" : " deviation"}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "空头目标 (最低)" : "Bear Target"}
          </div>
          <div className="text-lg font-bold text-orange-600">{fmt(min, stock.currency)}</div>
          {minDeviation != null && (
            <div className={`text-xs font-medium mt-1 ${deviationColor(minDeviation)}`}>
              {fmtPct(minDeviation)}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">
            {locale === "zh" ? "多头目标 (最高)" : "Bull Target"}
          </div>
          <div className="text-lg font-bold text-green-600">{fmt(max, stock.currency)}</div>
          {maxDeviation != null && (
            <div className={`text-xs font-medium mt-1 ${deviationColor(maxDeviation)}`}>
              {fmtPct(maxDeviation)}
            </div>
          )}
        </div>
      </div>

      {/* Source detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 pr-4 font-medium">
                {locale === "zh" ? "数据来源" : "Source"}
              </th>
              <th className="text-right py-2 pr-3 font-medium">
                {locale === "zh" ? "最低目标" : "Low Target"}
              </th>
              <th className="text-right py-2 pr-3 font-medium">
                {locale === "zh" ? "中位数" : "Median"}
              </th>
              <th className="text-right py-2 pr-3 font-medium">
                {locale === "zh" ? "均值目标" : "Mean Target"}
              </th>
              <th className="text-right py-2 pr-4 font-medium">
                {locale === "zh" ? "最高目标" : "High Target"}
              </th>
              <th className="text-right py-2 pr-4 font-medium">
                {locale === "zh" ? "偏离均值" : "vs Current"}
              </th>
              <th className="text-center py-2 font-medium">
                {locale === "zh" ? "分析师数" : "Analysts"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => {
              const dev =
                currentPrice != null && s.mean != null
                  ? ((currentPrice - s.mean) / s.mean) * 100
                  : undefined;
              return (
                <tr
                  key={i}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-3 pr-4 font-medium">{s.source}</td>
                  <td className="py-3 pr-3 text-right font-mono text-orange-600">
                    {fmt(s.low, stock.currency)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono">
                    {fmt(s.median, stock.currency)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono font-medium">
                    {fmt(s.mean, stock.currency)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-green-600">
                    {fmt(s.high, stock.currency)}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className={`font-medium ${deviationColor(dev)}`}>
                      {fmtPct(dev)}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    {s.count != null ? (
                      <Badge variant="outline" className="text-xs">
                        {s.count} {locale === "zh" ? "位" : ""}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Consensus signal */}
      {avg != null && currentPrice != null && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {locale === "zh" ? "综合分析师共识：" : "Analyst Consensus Signal:"}
            </span>
            {avgDeviation != null && avgDeviation < -15 ? (
              <Badge className="bg-green-600 text-white">
                {locale === "zh" ? "强力买入区间" : "Strong Buy Zone"}
              </Badge>
            ) : avgDeviation != null && avgDeviation < -5 ? (
              <Badge className="bg-green-500 text-white">
                {locale === "zh" ? "买入区间" : "Buy Zone"}
              </Badge>
            ) : avgDeviation != null && avgDeviation < 5 ? (
              <Badge className="bg-yellow-500 text-white">
                {locale === "zh" ? "合理区间" : "Fair Zone"}
              </Badge>
            ) : (
              <Badge className="bg-red-500 text-white">
                {locale === "zh" ? "高于目标价" : "Above Target"}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
