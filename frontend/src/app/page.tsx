"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const { t } = useI18n();

  const features = [
    { key: "feature1", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color: "text-primary" },
    { key: "feature2", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z", color: "text-blue-400" },
    { key: "feature3", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", color: "text-purple-400" },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-5xl font-bold leading-tight">
          {t("landing.title1")}
          <br />
          <span className="text-primary">{t("landing.title2")}</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("landing.subtitle")}
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/dashboard">{t("landing.cta")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="text-lg px-8">
            <Link href="/pricing">{t("landing.pricing")}</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-5xl w-full">
        {features.map((f) => (
          <Card key={f.key} className="text-left">
            <CardContent className="pt-6">
              <div className={`w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4`}>
                <svg className={`w-5 h-5 ${f.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">{t(`landing.${f.key}.title` as any)}</h3>
              <p className="text-sm text-muted-foreground">{t(`landing.${f.key}.desc` as any)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
