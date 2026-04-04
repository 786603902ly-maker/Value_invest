"use client";

import { StockValuation } from "@/types/stock";

interface Props {
  data: StockValuation[];
}

function formatPrice(val?: number) {
  if (val == null) return "N/A";
  return `$${val.toFixed(2)}`;
}

function formatPct(val?: number) {
  if (val == null) return "N/A";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

function deviationColor(val?: number) {
  if (val == null) return "text-slate-400";
  if (val < -20) return "text-emerald-400"; // significantly undervalued
  if (val < -5) return "text-emerald-300";
  if (val <= 5) return "text-yellow-400";
  if (val <= 20) return "text-orange-400";
  return "text-red-400"; // significantly overvalued
}

function signalBadge(signal?: string) {
  const colors: Record<string, string> = {
    undervalued: "bg-emerald-500/20 text-emerald-400",
    fair: "bg-yellow-500/20 text-yellow-400",
    overvalued: "bg-red-500/20 text-red-400",
  };
  if (!signal) return null;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[signal] || "bg-slate-700 text-slate-300"}`}
    >
      {signal}
    </span>
  );
}

function recBadge(rec?: string) {
  if (!rec) return null;
  const colors: Record<string, string> = {
    buy: "bg-emerald-500/20 text-emerald-400",
    strong_buy: "bg-emerald-500/30 text-emerald-300",
    hold: "bg-yellow-500/20 text-yellow-400",
    sell: "bg-red-500/20 text-red-400",
    strong_sell: "bg-red-500/30 text-red-300",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${colors[rec] || "bg-slate-700 text-slate-300"}`}
    >
      {rec.replace("_", " ")}
    </span>
  );
}

export default function ValuationTable({ data }: Props) {
  if (!data.length) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">
          Valuation Overview
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-6 py-3">Stock</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">DCF Fair Value</th>
              <th className="text-right px-4 py-3">vs DCF</th>
              <th className="text-right px-4 py-3">Target (Avg)</th>
              <th className="text-right px-4 py-3">Target Range</th>
              <th className="text-right px-4 py-3">vs Target</th>
              <th className="text-right px-4 py-3">Fwd P/E</th>
              <th className="text-right px-4 py-3">PEG</th>
              <th className="text-center px-4 py-3">Signal</th>
              <th className="text-center px-4 py-3">Rec</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {data.map((stock) => (
              <tr
                key={stock.ticker}
                className="hover:bg-slate-700/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-white">
                    {stock.ticker}
                  </div>
                  <div className="text-xs text-slate-400 max-w-[150px] truncate">
                    {stock.company_name}
                  </div>
                </td>
                <td className="text-right px-4 py-4 text-white font-medium">
                  {formatPrice(stock.current_price)}
                </td>
                <td className="text-right px-4 py-4 text-slate-300">
                  {formatPrice(stock.dcf_fair_value.avg)}
                  {stock.dcf_fair_value.sources.length > 0 && (
                    <div className="text-xs text-slate-500">
                      {stock.dcf_fair_value.sources.length} source
                      {stock.dcf_fair_value.sources.length > 1 ? "s" : ""}
                    </div>
                  )}
                </td>
                <td
                  className={`text-right px-4 py-4 font-medium ${deviationColor(stock.deviations.vs_avg_dcf)}`}
                >
                  {formatPct(stock.deviations.vs_avg_dcf)}
                </td>
                <td className="text-right px-4 py-4 text-slate-300">
                  {formatPrice(stock.target_price.avg)}
                </td>
                <td className="text-right px-4 py-4 text-xs text-slate-400">
                  {stock.target_price.min != null && stock.target_price.max != null
                    ? `${formatPrice(stock.target_price.min)} - ${formatPrice(stock.target_price.max)}`
                    : "N/A"}
                </td>
                <td
                  className={`text-right px-4 py-4 font-medium ${deviationColor(stock.deviations.vs_avg_target)}`}
                >
                  {formatPct(stock.deviations.vs_avg_target)}
                </td>
                <td className="text-right px-4 py-4 text-slate-300">
                  {stock.forward_pe.value?.toFixed(1) ?? "N/A"}
                </td>
                <td className="text-right px-4 py-4 text-slate-300">
                  {stock.peg_ratio.value?.toFixed(2) ?? "N/A"}
                </td>
                <td className="text-center px-4 py-4">
                  {signalBadge(stock.deviations.peg_signal)}
                </td>
                <td className="text-center px-4 py-4">
                  {recBadge(stock.recommendation)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source Details Accordion */}
      <div className="border-t border-slate-700 px-6 py-4">
        <details className="group">
          <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-200 transition-colors">
            View source details
          </summary>
          <div className="mt-4 space-y-4">
            {data.map((stock) => (
              <div key={stock.ticker}>
                <h4 className="text-sm font-medium text-white mb-2">
                  {stock.ticker} - Source Breakdown
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* DCF Sources */}
                  {stock.dcf_fair_value.sources.map((s, i) => (
                    <div
                      key={`dcf-${i}`}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg p-3"
                    >
                      <div className="text-slate-400">{s.source}</div>
                      <div className="text-white font-medium">
                        DCF: {formatPrice(s.value)}
                      </div>
                      {s.model && (
                        <div className="text-slate-500">{s.model}</div>
                      )}
                    </div>
                  ))}
                  {/* Target Sources */}
                  {stock.target_price.sources.map((s, i) => (
                    <div
                      key={`target-${i}`}
                      className="bg-slate-900/50 border border-slate-700 rounded-lg p-3"
                    >
                      <div className="text-slate-400">{s.source}</div>
                      <div className="text-white font-medium">
                        Target: {formatPrice(s.mean)}
                      </div>
                      <div className="text-slate-500">
                        Range: {formatPrice(s.low)} - {formatPrice(s.high)}
                        {s.count != null && ` (${s.count} analysts)`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
