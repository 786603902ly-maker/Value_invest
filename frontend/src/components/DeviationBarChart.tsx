"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { StockValuation } from "@/types/stock";

interface Props {
  data: StockValuation[];
}

function getColor(value: number) {
  if (value < -20) return "#10b981"; // emerald-500 - strong buy
  if (value < -5) return "#34d399"; // emerald-400
  if (value <= 5) return "#fbbf24"; // yellow-400 - hold
  if (value <= 20) return "#fb923c"; // orange-400
  return "#ef4444"; // red-500 - strong sell
}

function getLabel(value: number) {
  if (value < -20) return "Strong Buy";
  if (value < -5) return "Buy";
  if (value <= 5) return "Hold";
  if (value <= 20) return "Sell";
  return "Strong Sell";
}

export default function DeviationBarChart({ data }: Props) {
  const chartData = data.flatMap((stock) => {
    const items = [];
    if (stock.deviations.vs_avg_dcf != null) {
      items.push({
        name: `${stock.ticker} vs DCF`,
        value: stock.deviations.vs_avg_dcf,
        ticker: stock.ticker,
        type: "DCF Fair Value",
      });
    }
    if (stock.deviations.vs_avg_target != null) {
      items.push({
        name: `${stock.ticker} vs Target`,
        value: stock.deviations.vs_avg_target,
        ticker: stock.ticker,
        type: "Analyst Target",
      });
    }
    return items;
  });

  if (!chartData.length) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">
        Price vs Fair Value Deviation
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Negative = undervalued (green), Positive = overvalued (red)
      </p>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 45)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v) => `${v}%`}
            domain={["auto", "auto"]}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            width={120}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#f1f5f9" }}
            formatter={(value) => {
              const v = Number(value);
              return [
                `${v > 0 ? "+" : ""}${v.toFixed(1)}% — ${getLabel(v)}`,
                "Deviation",
              ];
            }}
          />
          <ReferenceLine x={0} stroke="#64748b" strokeWidth={2} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={getColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
