"use client";

import { StockValuation } from "@/types/stock";

interface Props {
  data: StockValuation[];
}

function computeScore(stock: StockValuation): number {
  // Composite score: 0 (strong sell) to 100 (strong buy)
  let score = 50; // neutral
  let factors = 0;

  // DCF deviation: negative is good (undervalued)
  if (stock.deviations.vs_avg_dcf != null) {
    const dcfScore = Math.max(0, Math.min(100, 50 - stock.deviations.vs_avg_dcf));
    score += dcfScore - 50;
    factors++;
  }

  // Target deviation: negative is good (upside)
  if (stock.deviations.vs_avg_target != null) {
    const targetScore = Math.max(0, Math.min(100, 50 - stock.deviations.vs_avg_target));
    score += targetScore - 50;
    factors++;
  }

  // PEG: < 1 is good
  if (stock.peg_ratio.value != null) {
    const pegScore =
      stock.peg_ratio.value < 0.5 ? 85 :
      stock.peg_ratio.value < 1 ? 70 :
      stock.peg_ratio.value < 2 ? 50 :
      stock.peg_ratio.value < 3 ? 30 : 15;
    score += pegScore - 50;
    factors++;
  }

  // Recommendation
  const recScores: Record<string, number> = {
    strong_buy: 90, buy: 75, hold: 50, sell: 25, strong_sell: 10,
  };
  if (stock.recommendation && recScores[stock.recommendation] != null) {
    score += recScores[stock.recommendation] - 50;
    factors++;
  }

  if (factors > 0) {
    score = 50 + (score - 50) / factors;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSignalInfo(score: number) {
  if (score >= 70) return { label: "BUY", color: "#10b981", bgColor: "bg-emerald-500/20" };
  if (score >= 40) return { label: "HOLD", color: "#fbbf24", bgColor: "bg-yellow-500/20" };
  return { label: "SELL", color: "#ef4444", bgColor: "bg-red-500/20" };
}

function GaugeArc({ score }: { score: number }) {
  const angle = (score / 100) * 180; // 0-180 degrees
  const radius = 80;
  const cx = 100;
  const cy = 95;

  // Background arc
  const bgPath = describeArc(cx, cy, radius, 0, 180);
  // Score arc
  const scorePath = describeArc(cx, cy, radius, 0, angle);

  // Needle position
  const needleAngle = ((180 - angle) * Math.PI) / 180;
  const needleX = cx + (radius - 10) * Math.cos(needleAngle);
  const needleY = cy - (radius - 10) * Math.sin(needleAngle);

  const signal = getSignalInfo(score);

  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
      {/* Background arc */}
      <path d={bgPath} fill="none" stroke="#334155" strokeWidth="16" strokeLinecap="round" />
      {/* Colored segments */}
      <path d={describeArc(cx, cy, radius, 0, 60)} fill="none" stroke="#ef444480" strokeWidth="16" strokeLinecap="round" />
      <path d={describeArc(cx, cy, radius, 60, 120)} fill="none" stroke="#fbbf2480" strokeWidth="16" strokeLinecap="round" />
      <path d={describeArc(cx, cy, radius, 120, 180)} fill="none" stroke="#10b98180" strokeWidth="16" strokeLinecap="round" />
      {/* Score arc (bright) */}
      {angle > 0 && (
        <path d={scorePath} fill="none" stroke={signal.color} strokeWidth="4" strokeLinecap="round" />
      )}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#f1f5f9" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="4" fill="#f1f5f9" />
      {/* Labels */}
      <text x="20" y="110" fill="#94a3b8" fontSize="9" textAnchor="middle">SELL</text>
      <text x="100" y="15" fill="#94a3b8" fontSize="9" textAnchor="middle">HOLD</text>
      <text x="180" y="110" fill="#94a3b8" fontSize="9" textAnchor="middle">BUY</text>
    </svg>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const startRad = ((180 - startAngle) * Math.PI) / 180;
  const endRad = ((180 - endAngle) * Math.PI) / 180;

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy - r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy - r * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function GaugeChart({ data }: Props) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-1">
        Buy / Hold / Sell Signal
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Composite score combining DCF, target price, PEG, and analyst recommendation
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {data.map((stock) => {
          const score = computeScore(stock);
          const signal = getSignalInfo(score);
          return (
            <div key={stock.ticker} className="flex flex-col items-center">
              <GaugeArc score={score} />
              <div className="mt-2 text-center">
                <div className="font-semibold text-white">{stock.ticker}</div>
                <div
                  className={`text-sm font-bold mt-1 px-3 py-1 rounded-full ${signal.bgColor}`}
                  style={{ color: signal.color }}
                >
                  {signal.label} ({score})
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
