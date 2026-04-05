"use client";

import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockValuation } from "@/types/stock";

interface Props {
  data: StockValuation[];
}

function formatPrice(val?: number) {
  if (val == null) return "N/A";
  return `$${val.toFixed(2)}`;
}

function formatPct(val?: number) {
  if (val == null) return "N/A";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function deviationColor(val?: number) {
  if (val == null) return "text-muted-foreground";
  if (val < -20) return "text-emerald-400";
  if (val < -5) return "text-emerald-300";
  if (val <= 5) return "text-yellow-400";
  if (val <= 20) return "text-orange-400";
  return "text-red-400";
}

export default function ValuationTable({ data }: Props) {
  const { t } = useI18n();

  if (!data.length) return null;

  const signalBadge = (signal?: string) => {
    if (!signal) return null;
    const variants: Record<string, "success" | "warning" | "danger"> = {
      undervalued: "success",
      fair: "warning",
      overvalued: "danger",
    };
    const labels: Record<string, string> = {
      undervalued: t("signal.undervalued"),
      fair: t("signal.fair"),
      overvalued: t("signal.overvalued"),
    };
    return <Badge variant={variants[signal] || "secondary"}>{labels[signal] || signal}</Badge>;
  };

  const recBadge = (rec?: string) => {
    if (!rec) return null;
    const variants: Record<string, "success" | "warning" | "danger"> = {
      buy: "success", strong_buy: "success",
      hold: "warning",
      sell: "danger", strong_sell: "danger",
    };
    const labels: Record<string, string> = {
      buy: t("signal.buy"), strong_buy: t("signal.strongBuy"),
      hold: t("signal.hold"),
      sell: t("signal.sell"), strong_sell: t("signal.strongSell"),
    };
    return <Badge variant={variants[rec] || "secondary"}>{labels[rec] || rec}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("table.title")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b">
                <th className="text-left px-6 py-3">{t("table.stock")}</th>
                <th className="text-right px-4 py-3">{t("table.price")}</th>
                <th className="text-right px-4 py-3">DCF</th>
                <th className="text-right px-4 py-3">{t("table.vsDcf")}</th>
                <th className="text-right px-4 py-3">{t("table.target")}</th>
                <th className="text-right px-4 py-3">{t("table.targetRange")}</th>
                <th className="text-right px-4 py-3">{t("table.vsTarget")}</th>
                <th className="text-right px-4 py-3">Fwd P/E</th>
                <th className="text-right px-4 py-3">PEG</th>
                <th className="text-center px-4 py-3">{t("table.signal")}</th>
                <th className="text-center px-4 py-3">{t("table.rec")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((stock) => (
                <tr key={stock.ticker} className="hover:bg-accent/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold">{stock.ticker}</div>
                    <div className="text-xs text-muted-foreground max-w-[150px] truncate">{stock.company_name}</div>
                  </td>
                  <td className="text-right px-4 py-4 font-medium">{formatPrice(stock.current_price)}</td>
                  <td className="text-right px-4 py-4 text-muted-foreground">
                    {formatPrice(stock.dcf_fair_value.avg)}
                    {stock.dcf_fair_value.sources.length > 0 && (
                      <div className="text-xs text-muted-foreground/70">
                        {stock.dcf_fair_value.sources.length} {t("table.sources")}
                      </div>
                    )}
                  </td>
                  <td className={`text-right px-4 py-4 font-medium ${deviationColor(stock.deviations.vs_avg_dcf)}`}>
                    {formatPct(stock.deviations.vs_avg_dcf)}
                  </td>
                  <td className="text-right px-4 py-4 text-muted-foreground">{formatPrice(stock.target_price.avg)}</td>
                  <td className="text-right px-4 py-4 text-xs text-muted-foreground">
                    {stock.target_price.min != null && stock.target_price.max != null
                      ? `${formatPrice(stock.target_price.min)} - ${formatPrice(stock.target_price.max)}`
                      : "N/A"}
                  </td>
                  <td className={`text-right px-4 py-4 font-medium ${deviationColor(stock.deviations.vs_avg_target)}`}>
                    {formatPct(stock.deviations.vs_avg_target)}
                  </td>
                  <td className="text-right px-4 py-4 text-muted-foreground">{stock.forward_pe.value?.toFixed(1) ?? "N/A"}</td>
                  <td className="text-right px-4 py-4 text-muted-foreground">{stock.peg_ratio.value?.toFixed(2) ?? "N/A"}</td>
                  <td className="text-center px-4 py-4">{signalBadge(stock.deviations.peg_signal)}</td>
                  <td className="text-center px-4 py-4">{recBadge(stock.recommendation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Source Details */}
        <div className="border-t px-6 py-4">
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("table.sourceDetails")}
            </summary>
            <div className="mt-4 space-y-4">
              {data.map((stock) => (
                <div key={stock.ticker}>
                  <h4 className="text-sm font-medium mb-2">{stock.ticker} - {t("table.sourceBreakdown")}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {stock.dcf_fair_value.sources.map((s, i) => (
                      <div key={`dcf-${i}`} className="border rounded-lg p-3">
                        <div className="text-muted-foreground">{s.source}</div>
                        <div className="font-medium">DCF: {formatPrice(s.value)}</div>
                        {s.model && <div className="text-muted-foreground/70">{s.model}</div>}
                      </div>
                    ))}
                    {stock.target_price.sources.map((s, i) => (
                      <div key={`target-${i}`} className="border rounded-lg p-3">
                        <div className="text-muted-foreground">{s.source}</div>
                        <div className="font-medium">{t("table.target")}: {formatPrice(s.mean)}</div>
                        <div className="text-muted-foreground/70">
                          {formatPrice(s.low)} - {formatPrice(s.high)}
                          {s.count != null && ` (${s.count} ${t("table.analysts")})`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
