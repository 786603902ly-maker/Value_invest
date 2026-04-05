"use client";

import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockValuation } from "@/types/stock";

interface Props { data: StockValuation[]; }

function computeScore(stock: StockValuation): number {
  let score = 50;
  let factors = 0;
  if (stock.deviations.vs_avg_dcf != null) { score += Math.max(-50, Math.min(50, -stock.deviations.vs_avg_dcf)); factors++; }
  if (stock.deviations.vs_avg_target != null) { score += Math.max(-50, Math.min(50, -stock.deviations.vs_avg_target)); factors++; }
  if (stock.peg_ratio.value != null) {
    const ps = stock.peg_ratio.value < 0.5 ? 85 : stock.peg_ratio.value < 1 ? 70 : stock.peg_ratio.value < 2 ? 50 : stock.peg_ratio.value < 3 ? 30 : 15;
    score += ps - 50; factors++;
  }
  const recScores: Record<string, number> = { strong_buy: 90, buy: 75, hold: 50, sell: 25, strong_sell: 10 };
  if (stock.recommendation && recScores[stock.recommendation] != null) { score += recScores[stock.recommendation] - 50; factors++; }
  if (factors > 0) score = 50 + (score - 50) / factors;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = ((180 - startAngle) * Math.PI) / 180;
  const e = ((180 - endAngle) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(s), y1 = cy - r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy - r * Math.sin(e);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

function GaugeArc({ score }: { score: number }) {
  const angle = (score / 100) * 180;
  const r = 80, cx = 100, cy = 95;
  const needleAngle = ((180 - angle) * Math.PI) / 180;
  const nx = cx + (r - 10) * Math.cos(needleAngle);
  const ny = cy - (r - 10) * Math.sin(needleAngle);
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#fbbf24" : "#ef4444";

  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
      <path d={describeArc(cx, cy, r, 0, 60)} fill="none" stroke="#ef444440" strokeWidth="16" strokeLinecap="round" />
      <path d={describeArc(cx, cy, r, 60, 120)} fill="none" stroke="#fbbf2440" strokeWidth="16" strokeLinecap="round" />
      <path d={describeArc(cx, cy, r, 120, 180)} fill="none" stroke="#10b98140" strokeWidth="16" strokeLinecap="round" />
      {angle > 0 && <path d={describeArc(cx, cy, r, 0, angle)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="4" fill="hsl(var(--foreground))" />
      <text x="20" y="110" fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">SELL</text>
      <text x="100" y="15" fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">HOLD</text>
      <text x="180" y="110" fill="hsl(var(--muted-foreground))" fontSize="9" textAnchor="middle">BUY</text>
    </svg>
  );
}

export default function GaugeChart({ data }: Props) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("chart.gauge.title")}</CardTitle>
        <CardDescription>{t("chart.gauge.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.map((stock) => {
            const score = computeScore(stock);
            const label = score >= 70 ? t("signal.buy") : score >= 40 ? t("signal.hold") : t("signal.sell");
            const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-yellow-400" : "text-red-400";
            const bg = score >= 70 ? "bg-emerald-500/20" : score >= 40 ? "bg-yellow-500/20" : "bg-red-500/20";
            return (
              <div key={stock.ticker} className="flex flex-col items-center">
                <GaugeArc score={score} />
                <div className="mt-2 text-center">
                  <div className="font-semibold">{stock.ticker}</div>
                  <div className={`text-sm font-bold mt-1 px-3 py-1 rounded-full ${bg} ${color}`}>
                    {label} ({score})
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
