"use client";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PricingPage() {
  const { t } = useI18n();

  const tiers = [
    {
      key: "free",
      features: ["stocks3", "yahoo", "basicChart", "community"],
      highlighted: false,
    },
    {
      key: "pro",
      features: ["stocks20", "allSources", "allCharts", "alerts5", "export", "refresh15"],
      highlighted: true,
    },
    {
      key: "premium",
      features: ["stocksUnlimited", "allSources", "allCharts", "alertsUnlimited", "export", "refresh5", "api", "support"],
      highlighted: false,
    },
  ];

  const faqs = ["q1", "q2", "q3", "q4"];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("pricing.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <Card key={tier.key} className={`relative flex flex-col ${tier.highlighted ? "border-primary border-2" : ""}`}>
            {tier.highlighted && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">{t("pricing.popular")}</Badge>
            )}
            <CardHeader>
              <CardTitle>{t(`pricing.${tier.key}.name` as any)}</CardTitle>
              <CardDescription>{t(`pricing.${tier.key}.desc` as any)}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold">{t(`pricing.${tier.key}.price` as any)}</span>
                <span className="text-muted-foreground text-sm">{t(`pricing.${tier.key}.period` as any)}</span>
              </div>
              <ul className="space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t(`pricing.feature.${feature}` as any)}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant={tier.highlighted ? "default" : "secondary"}>
                {t(`pricing.${tier.key}.cta` as any)}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="max-w-2xl mx-auto mt-12 space-y-4">
        <h2 className="text-xl font-bold text-center mb-6">{t("pricing.faq.title")}</h2>
        {faqs.map((faq) => (
          <details key={faq} className="border rounded-lg group">
            <summary className="px-4 py-3 cursor-pointer font-medium text-sm hover:text-primary transition-colors">
              {t(`pricing.faq.${faq}` as any)}
            </summary>
            <p className="px-4 pb-3 text-muted-foreground text-sm">
              {t(`pricing.faq.a${faq.slice(1)}` as any)}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
