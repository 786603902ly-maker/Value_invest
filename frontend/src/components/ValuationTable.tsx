"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockValuation, Tier } from "@/types/stock";
import { ArrowUpDown, ArrowUp, ArrowDown, LockIcon } from "lucide-react";

interface Props {
  data: StockValuation[];
  userTier?: Tier;
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
  if (val < -20) return "text-emerald-500";
  if (val < -5) return "text-emerald-400";
  if (val <= 5) return "text-yellow-500";
  if (val <= 20) return "text-orange-400";
  return "text-red-500";
}

/**
 * Compute composite signal based on target price, PEG, forward PE.
 * Returns: strong_buy | buy | hold | sell | strong_sell
 */
function computeSignal(stock: StockValuation): {
  signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  score: number;
} {
  let score = 0;
  let weight = 0;

  // Target price deviation: more negative = more upside = bullish
  const targetDev = stock.deviations.vs_avg_target;
  if (targetDev != null) {
    if (targetDev < -20) score += 2;
    else if (targetDev < -8) score += 1;
    else if (targetDev <= 8) score += 0;
    else if (targetDev <= 20) score -= 1;
    else score -= 2;
    weight += 2;
  }

  // PEG: <1 bullish, 1-2 fair, >2 bearish
  const peg = stock.peg_ratio.value;
  if (peg != null && peg > 0) {
    if (peg < 1) score += 1.5;
    else if (peg <= 1.5) score += 0.5;
    else if (peg <= 2.5) score += 0;
    else if (peg <= 4) score -= 1;
    else score -= 1.5;
    weight += 1.5;
  }

  // Forward PE: relative to growth — too high vs 25 = bearish
  const fpe = stock.forward_pe.value;
  if (fpe != null && fpe > 0) {
    if (fpe < 12) score += 1;
    else if (fpe <= 20) score += 0.3;
    else if (fpe <= 30) score += 0;
    else if (fpe <= 45) score -= 0.5;
    else score -= 1;
    weight += 1;
  }

  if (weight === 0) return { signal: "hold", score: 0 };

  const norm = score / weight; // ~ -1 to +1
  if (norm >= 0.6) return { signal: "strong_buy", score: norm };
  if (norm >= 0.2) return { signal: "buy", score: norm };
  if (norm > -0.2) return { signal: "hold", score: norm };
  if (norm > -0.6) return { signal: "sell", score: norm };
  return { signal: "strong_sell", score: norm };
}

type SortKey =
  | "ticker"
  | "price"
  | "target"
  | "vsTarget"
  | "fpe"
  | "peg"
  | "dcf"
  | "vsDcf"
  | "signal";
type SortDir = "asc" | "desc" | null;

export default function ValuationTable({ data, userTier = "premium" }: Props) {
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const canSeeDcf = userTier === "pro" || userTier === "premium";

  // Pre-compute signals for all stocks
  const enriched = useMemo(
    () =>
      data.map((s) => ({
        stock: s,
        sig: computeSignal(s),
      })),
    [data]
  );

  // Sorting logic
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return enriched;
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (e: typeof enriched[number]): number | string => {
      const s = e.stock;
      switch (sortKey) {
        case "ticker":
          return s.ticker;
        case "price":
          return s.current_price ?? -Infinity;
        case "target":
          return s.target_price.avg ?? -Infinity;
        case "vsTarget":
          return s.deviations.vs_avg_target ?? -Infinity;
        case "fpe":
          return s.forward_pe.value ?? -Infinity;
        case "peg":
          return s.peg_ratio.value ?? -Infinity;
        case "dcf":
          return s.dcf_fair_value.avg ?? -Infinity;
        case "vsDcf":
          return s.deviations.vs_avg_dcf ?? -Infinity;
        case "signal":
          return e.sig.score;
        default:
          return 0;
      }
    };
    return [...enriched].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * dir;
      }
      return ((va as number) - (vb as number)) * dir;
    });
  }, [enriched, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") setSortDir("asc");
    else if (sortDir === "asc") {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir("desc");
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
    if (!active) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />;
    return dir === "asc" ? (
      <ArrowUp className="h-3 w-3 inline ml-1 text-primary" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1 text-primary" />
    );
  };

  const headerBtn = (key: SortKey, label: string, align: "left" | "right" | "center" = "right") => (
    <button
      onClick={() => toggleSort(key)}
      className={`w-full ${
        align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"
      } hover:text-foreground transition-colors uppercase tracking-wider text-xs font-medium`}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortKey === key ? sortDir : null} />
    </button>
  );

  if (!data.length) return null;

  const signalBadge = (sig: ReturnType<typeof computeSignal>["signal"]) => {
    const cfg: Record<typeof sig, { variant: "success" | "warning" | "danger" | "secondary"; label: string }> = {
      strong_buy: { variant: "success", label: t("signal.strongBuy") },
      buy: { variant: "success", label: t("signal.buy") },
      hold: { variant: "warning", label: t("signal.hold") },
      sell: { variant: "danger", label: t("signal.sell") },
      strong_sell: { variant: "danger", label: t("signal.strongSell") },
    };
    return <Badge variant={cfg[sig].variant}>{cfg[sig].label}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg">{t("table.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {zh ? "💡 点击表头可排序" : "💡 Click headers to sort"}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left px-4 py-3">{headerBtn("ticker", t("table.stock"), "left")}</th>
                <th className="text-right px-3 py-3">{headerBtn("price", t("table.price"))}</th>
                <th className="text-right px-3 py-3">{headerBtn("target", t("table.target"))}</th>
                <th className="text-right px-3 py-3 text-xs uppercase tracking-wider font-medium">
                  {t("table.targetRange")}
                </th>
                <th className="text-right px-3 py-3">{headerBtn("vsTarget", t("table.vsTarget"))}</th>
                <th className="text-right px-3 py-3">{headerBtn("fpe", "Fwd P/E")}</th>
                <th className="text-right px-3 py-3">{headerBtn("peg", "PEG")}</th>
                <th className="text-center px-3 py-3">{headerBtn("signal", t("table.signal"), "center")}</th>
                <th className="text-right px-3 py-3 bg-muted/30">
                  {canSeeDcf ? (
                    headerBtn("dcf", "DCF " + (zh ? "均值" : "Avg"))
                  ) : (
                    <span className="inline-flex items-center gap-1 uppercase tracking-wider text-xs font-medium">
                      <LockIcon className="h-3 w-3" /> DCF {zh ? "均值" : "Avg"}
                    </span>
                  )}
                </th>
                <th className="text-right px-3 py-3 bg-muted/30">
                  {canSeeDcf ? (
                    headerBtn("vsDcf", t("table.vsDcf"))
                  ) : (
                    <span className="inline-flex items-center gap-1 uppercase tracking-wider text-xs font-medium">
                      <LockIcon className="h-3 w-3" /> {t("table.vsDcf")}
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map(({ stock, sig }) => (
                <tr key={stock.ticker} className="hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-semibold">{stock.ticker}</div>
                    <div className="text-xs text-muted-foreground max-w-[180px] truncate">
                      {stock.company_name}
                    </div>
                  </td>
                  <td className="text-right px-3 py-4 font-medium">
                    {formatPrice(stock.current_price)}
                  </td>
                  <td className="text-right px-3 py-4 text-muted-foreground">
                    {formatPrice(stock.target_price.avg)}
                  </td>
                  <td className="text-right px-3 py-4 text-xs text-muted-foreground">
                    {stock.target_price.min != null && stock.target_price.max != null
                      ? `${formatPrice(stock.target_price.min)} – ${formatPrice(stock.target_price.max)}`
                      : "N/A"}
                  </td>
                  <td
                    className={`text-right px-3 py-4 font-medium ${deviationColor(
                      stock.deviations.vs_avg_target
                    )}`}
                  >
                    {formatPct(stock.deviations.vs_avg_target)}
                  </td>
                  <td className="text-right px-3 py-4 text-muted-foreground">
                    {stock.forward_pe.value?.toFixed(1) ?? "N/A"}
                  </td>
                  <td className="text-right px-3 py-4 text-muted-foreground">
                    {stock.peg_ratio.value?.toFixed(2) ?? "N/A"}
                  </td>
                  <td className="text-center px-3 py-4">{signalBadge(sig.signal)}</td>
                  <td className="text-right px-3 py-4 bg-muted/20">
                    {canSeeDcf ? (
                      <span className="text-muted-foreground">
                        {formatPrice(stock.dcf_fair_value.avg)}
                      </span>
                    ) : (
                      <Link
                        href="/pricing"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <LockIcon className="h-3 w-3" /> Pro
                      </Link>
                    )}
                  </td>
                  <td className="text-right px-3 py-4 bg-muted/20">
                    {canSeeDcf ? (
                      <span
                        className={`font-medium ${deviationColor(
                          stock.deviations.vs_avg_dcf
                        )}`}
                      >
                        {formatPct(stock.deviations.vs_avg_dcf)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!canSeeDcf && (
          <div className="border-t px-4 py-3 bg-muted/20 text-center">
            <Link href="/pricing" className="text-xs text-primary hover:underline">
              <LockIcon className="h-3 w-3 inline mr-1" />
              {zh
                ? "升级到 Pro (S$1.99/月) 即可查看 DCF 均值与偏离度"
                : "Upgrade to Pro (S$1.99/mo) to see DCF average and deviation"}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
