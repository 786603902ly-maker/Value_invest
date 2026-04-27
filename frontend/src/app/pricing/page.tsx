"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, XIcon, InfoIcon, CrownIcon } from "lucide-react";
import { Tier } from "@/types/stock";

interface FeatureItem {
  text: string;
  included: boolean;
}

const FEATURES: Record<string, { zh: FeatureItem[]; en: FeatureItem[] }> = {
  free: {
    zh: [
      { text: "估值概览表（DCF 均值 + 目标价均值）", included: true },
      { text: "基础偏离度图表", included: true },
      { text: "买入/持有/卖出 信号 + 仪表盘矩阵", included: true },
      { text: "3 个投资组合（最多 10 只股票）", included: true },
      { text: "Yahoo Finance 实时数据", included: true },
      { text: "DCF 多模型详情", included: false },
      { text: "分析师目标价多源对比", included: false },
      { text: "高级图表（雷达图、牛熊区间、比率散点）", included: false },
      { text: "Alpha Vantage + FMP 多源数据", included: false },
      { text: "CSV 数据导出 / 邮件提醒", included: false },
    ],
    en: [
      { text: "Valuation overview (DCF avg + target avg)", included: true },
      { text: "Basic deviation chart", included: true },
      { text: "Buy/Hold/Sell signal + gauge matrix", included: true },
      { text: "3 portfolios (up to 10 stocks)", included: true },
      { text: "Yahoo Finance real-time data", included: true },
      { text: "DCF multi-model details", included: false },
      { text: "Multi-source analyst target prices", included: false },
      { text: "Advanced charts (radar, bull/bear, scatter)", included: false },
      { text: "Alpha Vantage + FMP multi-source data", included: false },
      { text: "CSV export / email alerts", included: false },
    ],
  },
  pro: {
    zh: [
      { text: "估值概览（含 DCF 均值、偏离度、保守加权）+ CSV 导出", included: true },
      { text: "DCF 多模型详情（格雷厄姆、Lynch、FCF 等）", included: true },
      { text: "分析师目标价多源对比明细", included: true },
      { text: "全部高级图表（雷达、牛熊、比率散点、柱状对比）", included: true },
      { text: "10 个投资组合（最多 50 只股票）", included: true },
      { text: "Alpha Vantage + FMP 多源数据", included: true },
      { text: "无限邮件价格提醒", included: true },
      { text: "历史估值趋势图（持续更新加强中）", included: true },
      { text: "优先客服支持", included: true },
    ],
    en: [
      { text: "Overview with DCF avg, deviation & weighting + CSV export", included: true },
      { text: "DCF multi-model details (Graham, Lynch, FCF...)", included: true },
      { text: "Multi-source analyst target details", included: true },
      { text: "All advanced charts (radar, bull/bear, scatter, comparison)", included: true },
      { text: "10 portfolios (up to 50 stocks)", included: true },
      { text: "Alpha Vantage + FMP multi-source data", included: true },
      { text: "Unlimited email price alerts", included: true },
      { text: "Historical valuation trends (continuously improving)", included: true },
      { text: "Priority support", included: true },
    ],
  },
};

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const userTier = ((session?.user as { tier?: string })?.tier ?? "free") as Tier;
  const isPro = userTier === "pro" || userTier === "premium";

  const handleSubscribePro = async () => {
    if (status === "loading") return;

    if (!session?.user) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong");
      setCheckoutLoading(false);
    }
  };

  const faqs = [
    { q: t("pricing.faq.q1"), a: t("pricing.faq.a1") },
    { q: t("pricing.faq.q2"), a: t("pricing.faq.a2") },
    { q: t("pricing.faq.q3"), a: t("pricing.faq.a3") },
    { q: t("pricing.faq.q4"), a: t("pricing.faq.a4") },
  ];

  const comparisonRows: [string, boolean | string, boolean | string][] = [
    [zh ? "估值概览表" : "Overview table", true, true],
    [zh ? "买入/持有/卖出 信号" : "Buy/Hold/Sell signal", true, true],
    [zh ? "基础偏离度图表" : "Basic deviation chart", true, true],
    [zh ? "多股仪表盘矩阵" : "Multi-stock gauge matrix", true, true],
    [zh ? "CSV 数据导出" : "CSV data export", false, true],
    [zh ? "公允价值/目标价 比率散点" : "Fair value/Target ratio scatter", false, true],
    [zh ? "PEG / 远期 PE / 目标价 柱状对比" : "PEG / Fwd P/E / Target bars", false, true],
    [zh ? "DCF 多模型明细" : "DCF multi-model details", false, true],
    [zh ? "分析师目标价多源明细" : "Multi-source target details", false, true],
    [zh ? "安全边际雷达图" : "Margin of safety radar", false, true],
    [zh ? "牛熊估值区间图" : "Bull/bear range chart", false, true],
    [zh ? "投资组合" : "Portfolios", "3", "10"],
    [zh ? "每组合最多股票" : "Stocks per portfolio", "10", "50"],
    [zh ? "邮件价格提醒（无限）" : "Email price alerts (unlimited)", false, true],
    [zh ? "Alpha Vantage + FMP 数据" : "Alpha Vantage + FMP data", false, true],
    [zh ? "历史估值趋势 🔧" : "Historical trends 🔧", false, zh ? "持续加强中" : "Improving"],
  ];

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-3">{t("pricing.title")}</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">{t("pricing.subtitle")}</p>
      </div>

      {/* Why we charge — honest explanation */}
      <div className="max-w-3xl mx-auto px-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex gap-3">
              <InfoIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1.5">
                  {zh ? "为什么收费？" : "Why we charge"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {zh
                    ? "为了给你更完整、更准确的估值数据，我们接入了多个付费 API（Alpha Vantage、Financial Modeling Prep 等），每一次查询都会产生真实的 API 调用成本。S$1.99/月 仅用于覆盖数据源费用与服务器开销 — 我们不投放广告，不贩卖用户数据。一杯果汁的钱，让你拥有接近券商级别的多源估值工具。"
                    : "To give you complete and accurate valuation data, we pay for multiple data APIs (Alpha Vantage, Financial Modeling Prep, etc.) — every query incurs real API costs. S$1.99/month simply covers these data-source fees and hosting. We don't run ads. We don't sell your data. For the price of a juice, you get a broker-grade multi-source valuation tool."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {checkoutError && (
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm">
            {checkoutError}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-3xl mx-auto px-4">
        {/* Free plan */}
        <Card className="relative flex flex-col">
          <CardHeader className="pb-4">
            <div className="font-bold text-lg">{zh ? "免费版" : "Free"}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-extrabold">S$0</span>
              <span className="text-muted-foreground text-sm">{zh ? "永久免费" : "forever"}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {zh ? "基础估值数据入门" : "Get started with basic valuation"}
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <ul className="space-y-2.5 flex-1">
              {FEATURES.free[zh ? "zh" : "en"].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {f.included ? (
                    <CheckIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XIcon className="h-4 w-4 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                  )}
                  <span className={f.included ? "" : "text-muted-foreground/50"}>{f.text}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                {zh ? "免费开始" : "Get Started Free"}
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Pro plan */}
        <Card className="relative flex flex-col border-primary border-2 shadow-lg scale-[1.02]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-3 py-1">
              {zh ? "推荐" : "RECOMMENDED"}
            </Badge>
          </div>
          <CardHeader className="pb-4">
            <div className="font-bold text-lg">{zh ? "专业版" : "Pro"}</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-extrabold">S$1.99</span>
              <span className="text-muted-foreground text-sm">{zh ? "/月" : "/month"}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {zh ? "一杯果汁钱，解锁全部功能" : "Price of a juice — unlock everything"}
            </p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            <ul className="space-y-2.5 flex-1">
              {FEATURES.pro[zh ? "zh" : "en"].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm font-medium">
                <CrownIcon className="h-4 w-4" />
                {zh ? "你已是 Pro 会员 ✓" : "You're already Pro ✓"}
              </div>
            ) : (
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSubscribePro}
                disabled={checkoutLoading || status === "loading"}
              >
                {checkoutLoading
                  ? (zh ? "跳转中..." : "Redirecting...")
                  : session?.user
                  ? (zh ? "订阅专业版" : "Subscribe Pro")
                  : (zh ? "登录后订阅" : "Sign in to Subscribe")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature comparison table */}
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-xl font-bold mb-6 text-center">
          {zh ? "功能对比一览" : "Feature Comparison"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 pr-6 font-medium text-muted-foreground">
                  {zh ? "功能" : "Feature"}
                </th>
                <th className="text-center py-3 px-4 font-medium">{zh ? "免费" : "Free"}</th>
                <th className="text-center py-3 px-4 font-medium text-primary">
                  {zh ? "专业 S$1.99" : "Pro S$1.99"}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([feature, free, pro], i) => (
                <tr key={i} className="border-b hover:bg-muted/20">
                  <td className="py-2.5 pr-6">{feature}</td>
                  {[free, pro].map((val, j) => (
                    <td key={j} className="py-2.5 px-4 text-center">
                      {val === true ? (
                        <CheckIcon className="h-4 w-4 text-green-500 mx-auto" />
                      ) : val === false ? (
                        <XIcon className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                      ) : (
                        <span className="text-xs font-medium">{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-xl font-bold mb-6 text-center">{t("pricing.faq.title")}</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border rounded-lg p-4">
              <p className="font-medium mb-2">{faq.q}</p>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
