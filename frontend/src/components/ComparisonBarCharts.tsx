"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockValuation } from "@/types/stock";

interface Props { data: StockValuation[]; }

function pegColor(peg: number) {
  if (peg < 1) return "#10b981"; // green — undervalued
  if (peg < 1.5) return "#34d399";
  if (peg < 2) return "#fbbf24"; // yellow — fair
  if (peg < 3) return "#fb923c";
  return "#ef4444"; // red — overvalued
}

function fpeColor(fpe: number) {
  if (fpe < 15) return "#10b981";
  if (fpe < 22) return "#34d399";
  if (fpe < 30) return "#fbbf24";
  if (fpe < 45) return "#fb923c";
  return "#ef4444";
}

function ratioColor(ratio: number) {
  // ratio = price / target. <1 = undervalued, >1 = overvalued
  if (ratio < 0.8) return "#10b981";
  if (ratio < 0.95) return "#34d399";
  if (ratio <= 1.05) return "#fbbf24";
  if (ratio <= 1.2) return "#fb923c";
  return "#ef4444";
}

export default function ComparisonBarCharts({ data }: Props) {
  const { locale } = useI18n();
  const zh = locale === "zh";

  // Only show stocks with relevant data
  const pegData = data
    .filter((s) => s.peg_ratio.value != null && s.peg_ratio.value > 0)
    .map((s) => ({ ticker: s.ticker, value: s.peg_ratio.value! }));

  const fpeData = data
    .filter((s) => s.forward_pe.value != null && s.forward_pe.value > 0)
    .map((s) => ({ ticker: s.ticker, value: Math.round(s.forward_pe.value! * 10) / 10 }));

  const targetRatioData = data
    .filter(
      (s) =>
        s.current_price != null &&
        s.target_price.avg != null &&
        s.target_price.avg > 0
    )
    .map((s) => ({
      ticker: s.ticker,
      value: Math.round((s.current_price! / s.target_price.avg!) * 100) / 100,
    }));

  const chartHeight = Math.max(200, data.length * 40 + 60);

  const CommonTooltip = ({
    label,
    payload,
    unit = "",
  }: {
    label?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any[];
    unit?: string;
  }) => {
    if (!payload?.length) return null;
    return (
      <div className="bg-popover border rounded-lg px-3 py-2 text-sm">
        <div className="font-bold">{label}</div>
        <div>
          {payload[0].value}
          {unit}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* PEG */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {zh ? "PEG 比率对比" : "PEG Ratio"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {zh ? "<1 低估，1-2 合理，>2 高估" : "<1 undervalued, 1-2 fair, >2 overvalued"}
          </p>
        </CardHeader>
        <CardContent className="p-2">
          {pegData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {zh ? "无 PEG 数据" : "No PEG data"}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={pegData} layout="vertical" margin={{ left: 0, right: 40, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  width={55}
                />
                <Tooltip content={<CommonTooltip />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.2 }} />
                <ReferenceLine x={1} stroke="#10b981" strokeDasharray="3 3" />
                <ReferenceLine x={2} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {pegData.map((entry, i) => (
                    <Cell key={i} fill={pegColor(entry.value)} />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Forward P/E */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {zh ? "远期市盈率对比" : "Forward P/E"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {zh ? "<15 低估，15-25 合理，>30 偏高" : "<15 low, 15-25 fair, >30 high"}
          </p>
        </CardHeader>
        <CardContent className="p-2">
          {fpeData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {zh ? "无远期 P/E 数据" : "No Forward P/E data"}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={fpeData} layout="vertical" margin={{ left: 0, right: 40, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  width={55}
                />
                <Tooltip content={<CommonTooltip />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.2 }} />
                <ReferenceLine x={20} stroke="#94a3b8" strokeDasharray="3 3" />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {fpeData.map((entry, i) => (
                    <Cell key={i} fill={fpeColor(entry.value)} />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fill: "hsl(var(--foreground))", fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Price / Target ratio */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {zh ? "现价 / 目标价 比率" : "Price / Target Ratio"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {zh ? "<1 分析师看涨空间大" : "<1 = analyst upside"}
          </p>
        </CardHeader>
        <CardContent className="p-2">
          {targetRatioData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {zh ? "无目标价数据" : "No target data"}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={targetRatioData} layout="vertical" margin={{ left: 0, right: 40, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={(v) => `${v.toFixed(2)}×`}
                />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  tick={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                  width={55}
                />
                <Tooltip content={<CommonTooltip unit="×" />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.2 }} />
                <ReferenceLine x={1} stroke="#10b981" strokeDasharray="3 3" />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {targetRatioData.map((entry, i) => (
                    <Cell key={i} fill={ratioColor(entry.value)} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => `${v}×`}
                    style={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
