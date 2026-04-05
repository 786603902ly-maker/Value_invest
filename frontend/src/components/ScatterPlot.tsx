"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ZAxis, Label,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockValuation } from "@/types/stock";

interface Props { data: StockValuation[]; }

export default function ScatterPlot({ data }: Props) {
  const { t } = useI18n();

  const chartData = data
    .filter((s) => s.dcf_fair_value.avg != null && s.target_price.avg != null)
    .map((s) => ({
      x: s.dcf_fair_value.avg!, y: s.target_price.avg!, z: s.current_price || 50,
      ticker: s.ticker, currentPrice: s.current_price,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("chart.scatter.title")}</CardTitle>
          <CardDescription>{t("chart.scatter.needData")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const allValues = [...chartData.map((d) => d.x), ...chartData.map((d) => d.y)];
  const maxVal = Math.max(...allValues) * 1.1;
  const minVal = Math.min(...allValues) * 0.9;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("chart.scatter.title")}</CardTitle>
        <CardDescription>{t("chart.scatter.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="x" domain={[minVal, maxVal]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(0)}`}>
              <Label value="DCF Fair Value" position="bottom" offset={0} style={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            </XAxis>
            <YAxis type="number" dataKey="y" domain={[minVal, maxVal]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(0)}`}>
              <Label value="Analyst Target" angle={-90} position="insideLeft" style={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            </YAxis>
            <ZAxis type="number" dataKey="z" range={[60, 400]} />
            <Tooltip content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-popover border rounded-lg p-3 text-sm text-popover-foreground">
                  <div className="font-bold">{d.ticker}</div>
                  <div>DCF: ${d.x?.toFixed(2)}</div>
                  <div>Target: ${d.y?.toFixed(2)}</div>
                  <div>Price: ${d.currentPrice?.toFixed(2)}</div>
                </div>
              );
            }} />
            <ReferenceLine segment={[{ x: minVal, y: minVal }, { x: maxVal, y: maxVal }]} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
            <Scatter data={chartData} fill="hsl(var(--primary))" stroke="hsl(var(--primary))" strokeWidth={1} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
