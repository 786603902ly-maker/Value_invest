"use client";

import { StockValuation } from "@/types/stock";
import { useI18n } from "@/lib/i18n";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  data: StockValuation[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, locale }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const fmt = (v?: number) =>
    v != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: d.currency || "USD", maximumFractionDigits: 2 }).format(v)
      : "N/A";

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
      <p className="font-bold mb-2">{d.ticker}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{locale === "zh" ? "当前价" : "Current"}</span>
          <span className="font-medium">{fmt(d.currentPrice)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-green-600">{locale === "zh" ? "乐观上限" : "Bull"}</span>
          <span className="font-medium text-green-600">{fmt(d.dcfMax)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{locale === "zh" ? "DCF均值" : "Avg DCF"}</span>
          <span className="font-medium">{fmt(d.dcfAvg)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-orange-600">{locale === "zh" ? "保守下限" : "Bear"}</span>
          <span className="font-medium text-orange-600">{fmt(d.dcfMin)}</span>
        </div>
      </div>
    </div>
  );
}

export default function BullBearChart({ data }: Props) {
  const { locale } = useI18n();

  const chartData = data
    .filter(
      (s) =>
        s.dcf_fair_value.min != null ||
        s.dcf_fair_value.max != null ||
        s.dcf_fair_value.avg != null
    )
    .map((s) => {
      const min = s.dcf_fair_value.min ?? s.dcf_fair_value.avg ?? 0;
      const max = s.dcf_fair_value.max ?? s.dcf_fair_value.avg ?? 0;
      const avg = s.dcf_fair_value.avg;
      return {
        ticker: s.ticker,
        currency: s.currency,
        currentPrice: s.current_price,
        dcfMin: min,
        dcfAvg: avg,
        dcfMax: max,
        // For stacked bar: base (min), mid (avg-min), top (max-avg)
        base: min,
        mid: avg != null ? avg - min : 0,
        top: max - (avg ?? max),
      };
    });

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        {locale === "zh" ? "需要多个DCF模型数据才能显示范围图" : "Need multiple DCF models to show range chart"}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="ticker" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${v}`}
          width={60}
        />
        <Tooltip
          content={(props) => (
            <CustomTooltip {...props} locale={locale} />
          )}
        />
        {/* Invisible base to stack from dcfMin */}
        <Bar dataKey="base" stackId="a" fill="transparent" />
        {/* Bear → Avg range (orange) */}
        <Bar dataKey="mid" stackId="a" fill="#fb923c" opacity={0.7} radius={[0, 0, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill="#fb923c" />
          ))}
        </Bar>
        {/* Avg → Bull range (green) */}
        <Bar dataKey="top" stackId="a" fill="#4ade80" opacity={0.7} radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill="#4ade80" />
          ))}
        </Bar>
        {/* Current price reference lines */}
        {chartData.map((d) => (
          d.currentPrice != null ? (
            <ReferenceLine
              key={d.ticker}
              y={d.currentPrice}
              stroke="#6366f1"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          ) : null
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
