"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import StockSearch from "@/components/StockSearch";
import ValuationTable from "@/components/ValuationTable";
import DCFDetailTable from "@/components/DCFDetailTable";
import TargetPriceDetailTable from "@/components/TargetPriceDetailTable";
import DeviationBarChart from "@/components/DeviationBarChart";
import ScatterPlot from "@/components/ScatterPlot";
import GaugeChart from "@/components/GaugeChart";
import BullBearChart from "@/components/BullBearChart";
import MarginOfSafetyChart from "@/components/MarginOfSafetyChart";
import ComparisonBarCharts from "@/components/ComparisonBarCharts";
import { StockValuation } from "@/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { LockIcon, SparklesIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";

// For now, show all features (tier gating will be enforced when auth is fully wired)
const USER_TIER: "free" | "pro" = "pro";

function TierGate({
  upgradeText,
  children,
}: {
  upgradeText: string;
  children: React.ReactNode;
}) {
  const hasAccess = USER_TIER === "pro";

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/95 border rounded-xl px-6 py-4 text-center shadow-lg max-w-sm">
          <LockIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-3">{upgradeText}</p>
          <Link href="/pricing">
            <Button size="sm" variant="default">
              Pro S$1.99/mo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const [stocks, setStocks] = useState<StockValuation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStock, setActiveStock] = useState<string | null>(null);

  const handleSearch = async (symbols: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch");
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      setStocks(arr);
      if (arr.length > 0) setActiveStock(arr[0].ticker);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const currentStock = stocks.find((s) => s.ticker === activeStock);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("dashboard.subtitle")}</p>
      </div>

      <StockSearch onSearch={handleSearch} loading={loading} />

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">{t("dashboard.loading")}</span>
        </div>
      )}

      {!loading && stocks.length > 0 && (
        <>
          {/* ============ SECTION 1: Summary Table (free, column-gated for DCF) ============ */}
          <ValuationTable data={stocks} userTier={USER_TIER} />

          {/* ============ SECTION 2: PRO — Top of paid area ============ */}
          {/* 2a: Multi-stock gauge matrix — see all scores at a glance */}
          <TierGate
            upgradeText={
              zh
                ? "升级 Pro 查看多股仪表盘矩阵"
                : "Upgrade to Pro for the multi-stock gauge matrix"
            }
          >
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-primary" />
                      {zh ? "多股仪表盘矩阵" : "Multi-Stock Gauge Matrix"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {zh
                        ? "一眼看清所有股票的买入/持有/卖出综合得分"
                        : "See all stocks' buy/hold/sell scores at a glance"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    Pro
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <GaugeChart data={stocks} hideHeader />
              </CardContent>
            </Card>
          </TierGate>

          {/* 2b: Ratio scatter — moved to top of paid area */}
          {stocks.length > 1 && (
            <TierGate
              upgradeText={
                zh
                  ? "升级 Pro 查看比率散点图"
                  : "Upgrade to Pro for the ratio scatter chart"
              }
            >
              <div className="relative">
                <Badge
                  variant="outline"
                  className="absolute top-4 right-4 z-10 text-xs bg-primary/10 text-primary border-primary/30"
                >
                  Pro
                </Badge>
                <ScatterPlot data={stocks} />
              </div>
            </TierGate>
          )}

          {/* ============ SECTION 3: Multi-stock comparison bar charts ============ */}
          <TierGate
            upgradeText={
              zh
                ? "升级 Pro 查看多股对比柱状图"
                : "Upgrade to Pro for comparison bar charts"
            }
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">
                  {zh ? "多股指标对比" : "Multi-Stock Comparison"}
                </h2>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  Pro
                </Badge>
              </div>
              <ComparisonBarCharts data={stocks} />
            </div>
          </TierGate>

          {/* ============ SECTION 4: Per-stock analysis with BIG prominent selector ============ */}
          {stocks.length > 0 && currentStock && (
            <div className="space-y-5">
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-1">
                  {zh ? "个股深度分析" : "Per-Stock Deep Dive"}
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  {zh ? "点击下方股票卡片查看详细估值" : "Click a stock card below to see full details"}
                </p>

                {/* Prominent stock selector — card grid instead of tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {stocks.map((s) => {
                    const active = s.ticker === activeStock;
                    const dev = s.deviations.vs_avg_target;
                    const Arrow =
                      dev == null
                        ? MinusIcon
                        : dev < -5
                        ? TrendingUpIcon
                        : dev > 5
                        ? TrendingDownIcon
                        : MinusIcon;
                    const devColor =
                      dev == null
                        ? "text-muted-foreground"
                        : dev < -5
                        ? "text-emerald-500"
                        : dev > 5
                        ? "text-red-500"
                        : "text-yellow-500";
                    return (
                      <button
                        key={s.ticker}
                        onClick={() => setActiveStock(s.ticker)}
                        className={`text-left rounded-xl border-2 p-4 transition-all ${
                          active
                            ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                            : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-bold text-base">{s.ticker}</div>
                          <Arrow className={`h-4 w-4 ${devColor}`} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-2">
                          {s.company_name || ""}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold">
                            ${s.current_price?.toFixed(2) ?? "N/A"}
                          </span>
                          {dev != null && (
                            <span className={`text-xs font-medium ${devColor}`}>
                              {dev > 0 ? "+" : ""}
                              {dev.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        {active && (
                          <div className="mt-2 pt-2 border-t border-primary/20">
                            <Badge className="text-[10px] bg-primary text-primary-foreground">
                              {zh ? "查看中" : "VIEWING"}
                            </Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Per-stock details */}
              <div className="space-y-5">
                {/* Target Price Detail (Pro) */}
                <TierGate upgradeText={t("target.upgrade")}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {currentStock.ticker} — {t("target.title")}
                            <Badge variant="outline" className="text-xs">
                              {currentStock.target_price.sources.length}{" "}
                              {zh ? "个来源" : "sources"}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("target.subtitle")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                          Pro
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <TargetPriceDetailTable stock={currentStock} />
                    </CardContent>
                  </Card>
                </TierGate>

                {/* DCF Detail Table (Pro) */}
                <TierGate upgradeText={t("dcf.upgrade")}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {currentStock.ticker} — {t("dcf.title")}
                            <Badge variant="outline" className="text-xs">
                              {currentStock.dcf_fair_value.sources.length}{" "}
                              {zh ? "个模型" : "models"}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("dcf.subtitle")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                          Pro
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DCFDetailTable stock={currentStock} />
                    </CardContent>
                  </Card>
                </TierGate>

                {/* Visualizations grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Deviation Bar (Free) */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{t("chart.deviation.title")}</CardTitle>
                      <p className="text-xs text-muted-foreground">{t("chart.deviation.subtitle")}</p>
                    </CardHeader>
                    <CardContent>
                      <DeviationBarChart data={[currentStock]} />
                    </CardContent>
                  </Card>

                  {/* Bull/Bear Range (Pro) */}
                  <TierGate
                    upgradeText={
                      zh ? "升级 Pro 查看牛熊区间图" : "Upgrade to Pro for bull/bear chart"
                    }
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{t("chart.bullbear.title")}</CardTitle>
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            Pro
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("chart.bullbear.subtitle")}</p>
                      </CardHeader>
                      <CardContent>
                        <BullBearChart data={[currentStock]} />
                      </CardContent>
                    </Card>
                  </TierGate>

                  {/* Margin of Safety Radar (Pro) */}
                  <TierGate
                    upgradeText={
                      zh ? "升级 Pro 查看安全边际雷达" : "Upgrade to Pro for MoS radar"
                    }
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{t("chart.mos.title")}</CardTitle>
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            Pro
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("chart.mos.subtitle")}</p>
                      </CardHeader>
                      <CardContent>
                        <MarginOfSafetyChart stock={currentStock} />
                      </CardContent>
                    </Card>
                  </TierGate>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
