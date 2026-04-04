"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
  Label,
} from "recharts";
import { StockValuation } from "@/types/stock";

interface Props {
  data: StockValuation[];
}

export default function ScatterPlot({ data }: Props) {
  const chartData = data
    .filter((s) => s.dcf_fair_value.avg != null && s.target_price.avg != null)
    .map((s) => ({
      x: s.dcf_fair_value.avg!,
      y: s.target_price.avg!,
      z: s.current_price || 50,
      ticker: s.ticker,
      currentPrice: s.current_price,
    }));

  if (chartData.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-1">
          Fair Value vs Target Price
        </h3>
        <p className="text-sm text-slate-400">
          Need both DCF fair value and target price data to display scatter plot.
          Ensure FMP API key is configured for DCF data.
        </p>
      </div>
    );
  }

  const allValues = [...chartData.map((d) => d.x), ...chartData.map((d) => d.y)];
  const maxVal = Math.max(...allValues) * 1.1;
  const minVal = Math.min(...allValues) * 0.9;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">
        Fair Value vs Target Price
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Above diagonal = analysts more bullish than DCF model. Dot size = current
        price.
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[minVal, maxVal]}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          >
            <Label
              value="DCF Fair Value"
              position="bottom"
              offset={0}
              style={{ fill: "#94a3b8", fontSize: 12 }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            domain={[minVal, maxVal]}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          >
            <Label
              value="Analyst Target"
              angle={-90}
              position="insideLeft"
              style={{ fill: "#94a3b8", fontSize: 12 }}
            />
          </YAxis>
          <ZAxis type="number" dataKey="z" range={[60, 400]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e293b",
              border: "1px solid #475569",
              borderRadius: "8px",
            }}
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm">
                  <div className="font-bold text-white">{d.ticker}</div>
                  <div className="text-slate-300">
                    DCF Fair Value: ${d.x?.toFixed(2)}
                  </div>
                  <div className="text-slate-300">
                    Analyst Target: ${d.y?.toFixed(2)}
                  </div>
                  <div className="text-slate-300">
                    Current Price: ${d.currentPrice?.toFixed(2)}
                  </div>
                </div>
              );
            }}
          />
          {/* Diagonal line: y = x (where DCF = Target) */}
          <ReferenceLine
            segment={[
              { x: minVal, y: minVal },
              { x: maxVal, y: maxVal },
            ]}
            stroke="#64748b"
            strokeDasharray="5 5"
            strokeWidth={1}
          />
          <Scatter
            data={chartData}
            fill="#10b981"
            stroke="#064e3b"
            strokeWidth={1}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
