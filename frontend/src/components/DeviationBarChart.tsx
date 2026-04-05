"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockValuation } from "@/types/stock";

interface Props { data: StockValuation[]; }

function getColor(value: number) {
  if (value < -20) return "#10b981";
  if (value < -5) return "#34d399";
  if (value <= 5) return "#fbbf24";
  if (value <= 20) return "#fb923c";
  return "#ef4444";
}

export default function DeviationBarChart({ data }: Props) {
  const { t } = useI18n();

  const chartData = data.flatMap((stock) => {
    const items = [];
    if (stock.deviations.vs_avg_dcf != null)
      items.push({ name: `${stock.ticker} vs DCF`, value: stock.deviations.vs_avg_dcf });
    if (stock.deviations.vs_avg_target != null)
      items.push({ name: `${stock.ticker} vs Target`, value: stock.deviations.vs_avg_target });
    return items;
  });

  if (!chartData.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("chart.deviation.title")}</CardTitle>
        <CardDescription>{t("chart.deviation.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={120} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
              formatter={(value) => { const v = Number(value); return [`${v > 0 ? "+" : ""}${v.toFixed(1)}%`, t("chart.deviation.label")]; }}
            />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (<Cell key={index} fill={getColor(entry.value)} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
