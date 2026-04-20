"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockValuation } from "@/types/stock";

interface Props { data: StockValuation[]; }

interface Point {
  x: number; // current price / DCF ratio (1 = fair, <1 = undervalued)
  y: number; // current price / target price ratio
  ticker: string;
  currentPrice?: number;
  dcfAvg: number;
  targetAvg: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TickerLabel = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <g>
      <text
        x={cx + 10}
        y={cy + 4}
        fill="hsl(var(--foreground))"
        fontSize={11}
        fontWeight={600}
        textAnchor="start"
      >
        {payload.ticker}
      </text>
    </g>
  );
};

export default function ScatterPlot({ data }: Props) {
  const { t, locale } = useI18n();
  const zh = locale === "zh";

  const chartData: Point[] = data
    .filter(
      (s) =>
        s.dcf_fair_value.avg != null &&
        s.target_price.avg != null &&
        s.current_price != null &&
        s.dcf_fair_value.avg > 0 &&
        s.target_price.avg > 0
    )
    .map((s) => ({
      x: Math.round((s.current_price! / s.dcf_fair_value.avg!) * 100) / 100,
      y: Math.round((s.current_price! / s.target_price.avg!) * 100) / 100,
      ticker: s.ticker,
      currentPrice: s.current_price,
      dcfAvg: s.dcf_fair_value.avg!,
      targetAvg: s.target_price.avg!,
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

  // Axis bounds: center on 1.0 (fair), expand to fit all points
  const allX = chartData.map((d) => d.x);
  const allY = chartData.map((d) => d.y);
  const xMax = Math.max(1.3, ...allX) * 1.1;
  const xMin = Math.min(0.7, ...allX) * 0.9;
  const yMax = Math.max(1.3, ...allY) * 1.1;
  const yMin = Math.min(0.7, ...allY) * 0.9;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {zh ? "价格/公允价值 vs 价格/目标价 比率散点" : "Price/Fair Value vs Price/Target Ratio"}
        </CardTitle>
        <CardDescription>
          {zh
            ? "1.0 = 公允；左下 = 双重低估（DCF 和分析师都看好）；右上 = 双重高估"
            : "1.0 = fair; bottom-left = double undervalued; top-right = double overvalued"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 50, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[xMin, xMax]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(v) => v.toFixed(2) + "×"}
            >
              <Label
                value={zh ? "当前价 / DCF 公允价值" : "Price / DCF Fair Value"}
                position="bottom"
                offset={10}
                style={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={[yMin, yMax]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(v) => v.toFixed(2) + "×"}
            >
              <Label
                value={zh ? "当前价 / 分析师目标价" : "Price / Analyst Target"}
                angle={-90}
                position="insideLeft"
                style={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
            </YAxis>
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload as Point;
                return (
                  <div className="bg-popover border rounded-lg p-3 text-sm text-popover-foreground">
                    <div className="font-bold mb-1">{d.ticker}</div>
                    <div>{zh ? "现价" : "Price"}: ${d.currentPrice?.toFixed(2)}</div>
                    <div>DCF: ${d.dcfAvg.toFixed(2)}</div>
                    <div>{zh ? "目标" : "Target"}: ${d.targetAvg.toFixed(2)}</div>
                    <div className="mt-1 pt-1 border-t">
                      P/DCF: <span className="font-semibold">{d.x}×</span>
                    </div>
                    <div>
                      P/Target: <span className="font-semibold">{d.y}×</span>
                    </div>
                  </div>
                );
              }}
            />
            {/* Fair value lines at 1.0 on both axes */}
            <ReferenceLine x={1} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5}>
              <Label value={zh ? "DCF 公允" : "DCF fair"} position="insideTopRight" fontSize={10} fill="#10b981" />
            </ReferenceLine>
            <ReferenceLine y={1} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5}>
              <Label value={zh ? "目标价公允" : "Target fair"} position="insideTopLeft" fontSize={10} fill="#3b82f6" />
            </ReferenceLine>
            <Scatter
              data={chartData}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              shape="circle"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={(props: any) => <TickerLabel {...props} />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
