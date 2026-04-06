"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, XIcon } from "lucide-react";

interface FeatureItem {
  text: string;
  included: boolean;
}

const FEATURES: Record<string, { zh: FeatureItem[]; en: FeatureItem[] }> = {
  free: {
    zh: [
      { text: "估值概览表（DCF 均值 + 目标价均值）", included: true },
      { text: "基础偏离度图表", included: true },
      { text: "1 个投资组合（最多 10 只股票）", included: true },
      { text: "Yahoo Finance 实时数据", included: true },
      { text: "DCF 多模型详情", included: false },
      { text: "分析师目标价多源对比", included: false },
      { text: "高级图表（雷达图、牛熊区间）", included: false },
      { text: "邮件提醒", included: false },
    ],
    en: [
      { text: "Valuation overview (DCF avg + target avg)", included: true },
      { text: "Basic deviation chart", included: true },
      { text: "1 portfolio (up to 10 stocks)", included: true },
      { text: "Yahoo Finance real-time data", included: true },
      { text: "DCF multi-model details", included: false },
      { text: "Multi-source analyst target prices", included: false },
      { text: "Advanced charts (radar, bull/bear)", included: false },
      { text: "Email alerts", included: false },
    ],
  },
  pro: {
    zh: [
      { text: "估值概览表（DCF 均值 + 目标价均值）", included: true },
      { text: "DCF 多模型详情（格雷厄姆、Lynch、FCF 等）", included: true },
      { text: "基础偏离度图表", included: true },
      { text: "3 个投资组合（最多 20 只股票）", included: true },
      { text: "Alpha Vantage 多源数据", included: true },
      { text: "5 个邮件提醒", included: true },
      { text: "分析师目标价多源对比", included: false },
      { text: "高级图表（雷达图、牛熊区间）", included: false },
    ],
    en: [
      { text: "Valuation overview (DCF avg + target avg)", included: true },
      { text: "DCF multi-model details (Graham, Lynch, FCF...)", included: true },
      { text: "Basic deviation chart", included: true },
      { text: "3 portfolios (up to 20 stocks)", included: true },
      { text: "Alpha Vantage multi-source data", included: true },
      { text: "5 email alerts", included: true },
      { text: "Multi-source analyst target prices", included: false },
      { text: "Advanced charts (radar, bull/bear)", included: false },
    ],
  },
  premium: {
    zh: [
      { text: "估值概览表（DCF 均值 + 目标价均值）", included: true },
      { text: "DCF 多模型详情（格雷厄姆、Lynch、FCF 等）", included: true },
      { text: "分析师目标价多源对比详情", included: true },
      { text: "全部高级图表（雷达图、牛熊区间、安全边际）", included: true },
      { text: "10 个投资组合（最多 50 只股票）", included: true },
      { text: "无限邮件 + Telegram 提醒", included: true },
      { text: "Alpha Vantage + FMP 多源数据", included: true },
      { text: "CSV 数据导出", included: true },
    ],
    en: [
      { text: "Valuation overview (DCF avg + target avg)", included: true },
      { text: "DCF multi-model details (Graham, Lynch, FCF...)", included: true },
      { text: "Multi-source analyst target price details", included: true },
      { text: "All advanced charts (radar, bull/bear, MoS)", included: true },
      { text: "10 portfolios (up to 50 stocks)", included: true },
      { text: "Unlimited email + Telegram alerts", included: true },
      { text: "Alpha Vantage + FMP multi-source data", included: true },
      { text: "CSV data export", included: true },
    ],
  },
};

export default function PricingPage() {
  const { t, locale } = useI18n();
  const zh = locale === "zh";

  const plans = [
    {
      key: "free",
      name: zh ? "免费版" : "Free",
      price: "S$0",
      period: zh ? "永久免费" : "forever",
      desc: zh ? "基础估值数据入门" : "Get started with basic valuation data",
      cta: zh ? "免费开始" : "Get Started Free",
      ctaHref: "/dashboard",
      ctaVariant: "outline" as const,
    },
    {
      key: "pro",
      name: zh ? "专业版" : "Pro",
      price: "S$1.99",
      period: zh ? "/月" : "/month",
      desc: zh ? "一杯果汁钱，看完整 DCF 多模型" : "Price of a juice — full DCF multi-model",
      cta: zh ? "订阅专业版" : "Subscribe Pro",
      popular: true,
      ctaHref: "/login",
      ctaVariant: "default" as const,
    },
    {
      key: "premium",
      name: zh ? "旗舰版" : "Premium",
      price: "S$5.99",
      period: zh ? "/月" : "/month",
      desc: zh ? "一杯咖啡钱，解锁全部功能" : "Price of a coffee — unlock everything",
      cta: zh ? "升级旗舰版" : "Go Premium",
      ctaHref: "/login",
      ctaVariant: "outline" as const,
    },
  ];

  const faqs = [
    { q: t("pricing.faq.q1"), a: t("pricing.faq.a1") },
    { q: t("pricing.faq.q2"), a: t("pricing.faq.a2") },
    { q: t("pricing.faq.q3"), a: t("pricing.faq.a3") },
    { q: t("pricing.faq.q4"), a: t("pricing.faq.a4") },
  ];

  const comparisonRows: [string, boolean | string, boolean | string, boolean | string][] = [
    [zh ? "估值概览表" : "Overview table", true, true, true],
    [zh ? "DCF 多模型明细" : "DCF multi-model details", false, true, true],
    [zh ? "分析师目标价多源" : "Multi-source targets", false, false, true],
    [zh ? "安全边际雷达图" : "Margin of safety radar", false, false, true],
    [zh ? "牛熊估值区间图" : "Bull/bear range chart", false, false, true],
    [zh ? "投资组合" : "Portfolios", "1", "3", "10"],
    [zh ? "每组合最多股票" : "Stocks per portfolio", "10", "20", "50"],
    [zh ? "邮件提醒" : "Email alerts", false, "5", zh ? "无限" : "Unlimited"],
    [zh ? "Telegram 提醒" : "Telegram alerts", false, false, true],
    [zh ? "Alpha Vantage 数据" : "Alpha Vantage data", false, true, true],
  ];

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-3">{t("pricing.title")}</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">{t("pricing.subtitle")}</p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto px-4">
        {plans.map((plan) => {
          const features = FEATURES[plan.key][zh ? "zh" : "en"];
          return (
            <Card
              key={plan.key}
              className={`relative flex flex-col ${
                plan.popular ? "border-primary border-2 shadow-lg scale-[1.02]" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    {zh ? "最受欢迎" : "POPULAR"}
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="font-bold text-lg">{plan.name}</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <ul className="space-y-2.5 flex-1">
                  {features.map((f, i) => (
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
                <Link href={plan.ctaHref}>
                  <Button
                    variant={plan.ctaVariant}
                    className={`w-full ${
                      plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="max-w-4xl mx-auto px-4">
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
                <th className="text-center py-3 px-4 font-medium">
                  {zh ? "旗舰 S$5.99" : "Premium S$5.99"}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([feature, free, pro, premium], i) => (
                <tr key={i} className="border-b hover:bg-muted/20">
                  <td className="py-2.5 pr-6">{feature}</td>
                  {[free, pro, premium].map((val, j) => (
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
