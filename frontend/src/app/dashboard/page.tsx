"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useDashboard } from "@/contexts/DashboardContext";
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
import { Tier, Portfolio } from "@/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  LockIcon, SparklesIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon,
  FolderOpenIcon, SaveIcon, PlusIcon, CheckIcon,
} from "lucide-react";

function TierGate({
  upgradeText,
  userTier,
  children,
}: {
  upgradeText: string;
  userTier: Tier;
  children: React.ReactNode;
}) {
  const hasAccess = userTier === "pro" || userTier === "premium";
  if (hasAccess) return <>{children}</>;
  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/95 border rounded-xl px-6 py-4 text-center shadow-lg max-w-sm">
          <LockIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-3">{upgradeText}</p>
          <Link href="/pricing">
            <Button size="sm" variant="default">Pro S$1.99/mo</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const userTier = ((session?.user as { tier?: string })?.tier ?? "free") as Tier;
  const { t, locale } = useI18n();
  const zh = locale === "zh";

  const { stocks, setStocks, activeStock, setActiveStock, searchTags, setSearchTags } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  // Portfolio quick-access
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfoliosLoaded, setPortfoliosLoaded] = useState(false);

  // Save as portfolio dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load portfolios for quick-access
  const loadPortfolios = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/portfolio");
      if (res.ok) {
        const data: Portfolio[] = await res.json();
        setPortfolios(data);
      }
    } catch { /* ignore */ }
    setPortfoliosLoaded(true);
  }, [session?.user]);

  useEffect(() => {
    if (session?.user && !portfoliosLoaded) loadPortfolios();
  }, [session?.user, portfoliosLoaded, loadPortfolios]);

  useEffect(() => {
    if (searchParams?.get("upgraded") === "true" && session?.user) {
      setUpgradeSuccess(true);
      updateSession();
    }
  }, [searchParams, session?.user, updateSession]);

  // Load portfolio stocks into dashboard
  const loadPortfolioStocks = async (portfolio: Portfolio) => {
    const tickers = portfolio.items.map((i) => i.ticker);
    if (tickers.length === 0) return;
    setSearchTags(tickers);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks?symbols=${tickers.join(",")}`);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (symbols: string[]) => {
    setLoading(true);
    setError(null);
    setSearchTags(symbols);
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

  const handleSaveAsPortfolio = async () => {
    if (!saveName.trim() || stocks.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createWithTickers",
          name: saveName.trim(),
          tickers: stocks.map((s) => s.ticker),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setSaveSuccess(true);
      setShowSaveDialog(false);
      setSaveName("");
      loadPortfolios();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const currentStock = stocks.find((s) => s.ticker === activeStock);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("dashboard.subtitle")}</p>
      </div>

      {/* Portfolio quick-access */}
      {session?.user && portfolios.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FolderOpenIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {zh ? "我的投资组合" : "My Portfolios"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPortfolioStocks(p)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:border-primary/50 hover:bg-accent transition-colors"
              >
                <span className="font-medium">{p.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {p.items.length}
                </Badge>
              </button>
            ))}
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <PlusIcon className="h-3 w-3" />
              {zh ? "管理" : "Manage"}
            </Link>
          </div>
        </div>
      )}

      <StockSearch
        onSearch={handleSearch}
        loading={loading}
        externalTags={searchTags}
        onTagsChange={setSearchTags}
      />

      {/* Save as portfolio + success */}
      {!loading && stocks.length > 0 && session?.user && (
        <div className="flex items-center gap-3">
          {showSaveDialog ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                placeholder={zh ? "输入组合名称..." : "Portfolio name..."}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-8 max-w-[200px]"
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsPortfolio()}
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleSaveAsPortfolio} disabled={saving || !saveName.trim()}>
                {saving ? "..." : zh ? "保存" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowSaveDialog(false)}>
                {zh ? "取消" : "Cancel"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setShowSaveDialog(true)}
            >
              <SaveIcon className="h-3.5 w-3.5" />
              {zh ? "保存为投资组合" : "Save as Portfolio"}
            </Button>
          )}
          {saveSuccess && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckIcon className="h-3 w-3" /> {zh ? "已保存" : "Saved!"}
            </span>
          )}
        </div>
      )}

      {upgradeSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <span className="text-lg">🎉</span>
            <span className="text-sm font-medium">
              {zh ? "欢迎加入 Pro！所有专属功能已解锁。" : "Welcome to Pro! All exclusive features are now unlocked."}
            </span>
          </div>
          <button onClick={() => setUpgradeSuccess(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
      )}

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
          {/* ======= SECTION 1: Overview Table (free, CSV for Pro) ======= */}
          <ValuationTable data={stocks} userTier={userTier} />

          {/* ======= SECTION 2: Multi-stock Gauge Matrix (FREE) ======= */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-primary" />
                  {zh ? "多股仪表盘矩阵" : "Multi-Stock Gauge Matrix"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {zh ? "一眼看清所有股票的买入/持有/卖出综合得分" : "See all stocks' buy/hold/sell scores at a glance"}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <GaugeChart data={stocks} hideHeader />
            </CardContent>
          </Card>

          {/* ======= SECTION 3: Scatter Plot (Pro) ======= */}
          {stocks.length > 1 && (
            <TierGate
              userTier={userTier}
              upgradeText={zh ? "升级 Pro 查看比率散点图" : "Upgrade to Pro for the ratio scatter chart"}
            >
              <div className="relative">
                <Badge variant="outline" className="absolute top-4 right-4 z-10 text-xs bg-primary/10 text-primary border-primary/30">Pro</Badge>
                <ScatterPlot data={stocks} />
              </div>
            </TierGate>
          )}

          {/* ======= SECTION 4: Per-stock deep dive ======= */}
          {stocks.length > 0 && currentStock && (
            <div className="space-y-5">
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-1">{zh ? "个股深度分析" : "Per-Stock Deep Dive"}</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  {zh ? "点击下方股票卡片查看详细估值" : "Click a stock card below to see full details"}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {stocks.map((s) => {
                    const active = s.ticker === activeStock;
                    const dev = s.deviations.vs_avg_target;
                    const Arrow = dev == null ? MinusIcon : dev < -5 ? TrendingUpIcon : dev > 5 ? TrendingDownIcon : MinusIcon;
                    const devColor = dev == null ? "text-muted-foreground" : dev < -5 ? "text-emerald-500" : dev > 5 ? "text-red-500" : "text-yellow-500";
                    return (
                      <button
                        key={s.ticker}
                        onClick={() => setActiveStock(s.ticker)}
                        className={`text-left rounded-xl border-2 p-4 transition-all ${
                          active ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-bold text-base">{s.ticker}</div>
                          <Arrow className={`h-4 w-4 ${devColor}`} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-2">{s.company_name || ""}</div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold">${s.current_price?.toFixed(2) ?? "N/A"}</span>
                          {dev != null && (
                            <span className={`text-xs font-medium ${devColor}`}>
                              {dev > 0 ? "+" : ""}{dev.toFixed(1)}%
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

              {/* Per-stock visualizations FIRST, then tables */}
              <div className="space-y-5">
                {/* Visualization grid: Deviation (free), BullBear (Pro), Radar (Pro) */}
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
                  <TierGate userTier={userTier} upgradeText={zh ? "升级 Pro 查看牛熊区间图" : "Upgrade to Pro for bull/bear chart"}>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{t("chart.bullbear.title")}</CardTitle>
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Pro</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("chart.bullbear.subtitle")}</p>
                      </CardHeader>
                      <CardContent>
                        <BullBearChart data={[currentStock]} />
                      </CardContent>
                    </Card>
                  </TierGate>

                  {/* Margin of Safety Radar (Pro) */}
                  <TierGate userTier={userTier} upgradeText={zh ? "升级 Pro 查看安全边际雷达" : "Upgrade to Pro for MoS radar"}>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{t("chart.mos.title")}</CardTitle>
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Pro</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("chart.mos.subtitle")}</p>
                      </CardHeader>
                      <CardContent>
                        <MarginOfSafetyChart stock={currentStock} />
                      </CardContent>
                    </Card>
                  </TierGate>
                </div>

                {/* Multi-stock comparison bar charts (Pro) */}
                <TierGate
                  userTier={userTier}
                  upgradeText={zh ? "升级 Pro 查看多股对比柱状图" : "Upgrade to Pro for comparison bar charts"}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold">{zh ? "多股指标对比" : "Multi-Stock Comparison"}</h2>
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Pro</Badge>
                    </div>
                    <ComparisonBarCharts data={stocks} />
                  </div>
                </TierGate>

                {/* Detail tables AFTER visualizations */}
                {/* Target Price Detail (Pro) */}
                <TierGate userTier={userTier} upgradeText={t("target.upgrade")}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {currentStock.ticker} — {t("target.title")}
                            <Badge variant="outline" className="text-xs">
                              {currentStock.target_price.sources.length} {zh ? "个来源" : "sources"}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{t("target.subtitle")}</p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Pro</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <TargetPriceDetailTable stock={currentStock} />
                    </CardContent>
                  </Card>
                </TierGate>

                {/* DCF Detail Table (Pro) */}
                <TierGate userTier={userTier} upgradeText={t("dcf.upgrade")}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {currentStock.ticker} — {t("dcf.title")}
                            <Badge variant="outline" className="text-xs">
                              {currentStock.dcf_fair_value.sources.length} {zh ? "个模型" : "models"}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{t("dcf.subtitle")}</p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Pro</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DCFDetailTable stock={currentStock} />
                    </CardContent>
                  </Card>
                </TierGate>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
