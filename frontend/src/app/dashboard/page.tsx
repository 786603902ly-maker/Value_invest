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
import { StockValuation } from "@/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { LockIcon } from "lucide-react";

// For now, show all features (tier gating will be enforced when auth is fully wired)
// Change this to read from session.user.tier when ready
const USER_TIER: "free" | "pro" | "premium" = "premium";

function TierGate({
  requiredTier,
  upgradeText,
  children,
}: {
  requiredTier: "pro" | "premium";
  upgradeText: string;
  children: React.ReactNode;
}) {
  const tierOrder = { free: 0, pro: 1, premium: 2 };
  const hasAccess = tierOrder[USER_TIER] >= tierOrder[requiredTier];

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-background/90 border rounded-xl px-6 py-4 text-center shadow-lg max-w-sm">
          <LockIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-3">{upgradeText}</p>
          <Link href="/pricing">
            <Button size="sm" variant="default">
              {requiredTier === "pro" ? "Pro S$1.99/mo" : "Premium S$5.99/mo"}
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
          {/* Section 1: Summary Table (Free) */}
          <ValuationTable data={stocks} />

          {/* Stock selector tabs for detail views */}
          {stocks.length > 0 && (
            <Tabs
              value={activeStock || stocks[0].ticker}
              onValueChange={setActiveStock}
            >
              <TabsList className="flex-wrap h-auto gap-1">
                {stocks.map((s) => (
                  <TabsTrigger key={s.ticker} value={s.ticker} className="text-sm">
                    {s.ticker}
                    {s.company_name && (
                      <span className="hidden sm:inline ml-1 text-muted-foreground text-xs">
                        {s.company_name.length > 15
                          ? s.company_name.slice(0, 15) + "..."
                          : s.company_name}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {stocks.map((stock) => (
                <TabsContent key={stock.ticker} value={stock.ticker} className="space-y-6 mt-4">
                  {/* Section 2: DCF Detail Table (Pro) */}
                  <TierGate
                    requiredTier="pro"
                    upgradeText={t("dcf.upgrade")}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {t("dcf.title")}
                              <Badge variant="outline" className="text-xs">
                                {stock.dcf_fair_value.sources.length}{" "}
                                {zh ? "个模型" : "models"}
                              </Badge>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("dcf.subtitle")}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Pro
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <DCFDetailTable stock={stock} />
                      </CardContent>
                    </Card>
                  </TierGate>

                  {/* Section 3: Target Price Detail Table (Premium) */}
                  <TierGate
                    requiredTier="premium"
                    upgradeText={t("target.upgrade")}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {t("target.title")}
                              <Badge variant="outline" className="text-xs">
                                {stock.target_price.sources.length}{" "}
                                {zh ? "个来源" : "sources"}
                              </Badge>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("target.subtitle")}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                            Premium
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <TargetPriceDetailTable stock={stock} />
                      </CardContent>
                    </Card>
                  </TierGate>

                  {/* Section 4: Visualizations */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Deviation Bar (Free) */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{t("chart.deviation.title")}</CardTitle>
                        <p className="text-xs text-muted-foreground">{t("chart.deviation.subtitle")}</p>
                      </CardHeader>
                      <CardContent>
                        <DeviationBarChart data={[stock]} />
                      </CardContent>
                    </Card>

                    {/* Gauge (Free) */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{t("chart.gauge.title")}</CardTitle>
                        <p className="text-xs text-muted-foreground">{t("chart.gauge.subtitle")}</p>
                      </CardHeader>
                      <CardContent>
                        <GaugeChart data={[stock]} />
                      </CardContent>
                    </Card>

                    {/* Bull/Bear Range (Premium) */}
                    <TierGate
                      requiredTier="premium"
                      upgradeText={zh ? "升级旗舰版查看牛熊区间图" : "Upgrade to Premium for bull/bear chart"}
                    >
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{t("chart.bullbear.title")}</CardTitle>
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              Premium
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t("chart.bullbear.subtitle")}</p>
                        </CardHeader>
                        <CardContent>
                          <BullBearChart data={[stock]} />
                        </CardContent>
                      </Card>
                    </TierGate>

                    {/* Margin of Safety Radar (Premium) */}
                    <TierGate
                      requiredTier="premium"
                      upgradeText={zh ? "升级旗舰版查看安全边际雷达" : "Upgrade to Premium for MoS radar"}
                    >
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{t("chart.mos.title")}</CardTitle>
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              Premium
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{t("chart.mos.subtitle")}</p>
                        </CardHeader>
                        <CardContent>
                          <MarginOfSafetyChart stock={stock} />
                        </CardContent>
                      </Card>
                    </TierGate>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* Multi-stock comparison charts (when >1 stock) */}
          {stocks.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("chart.scatter.title")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("chart.scatter.subtitle")}</p>
              </CardHeader>
              <CardContent>
                <ScatterPlot data={stocks} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
