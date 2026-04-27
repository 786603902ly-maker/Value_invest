"use client";

import { StockValuation } from "@/types/stock";
import { useI18n } from "@/lib/i18n";

interface Props {
  stock: StockValuation;
}

export default function TargetRangeChart({ stock }: Props) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const cp = stock.current_price;
  const targets = stock.target_price;

  if (!targets.avg || !targets.min || !targets.max || !cp) {
    return (
      <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
        {zh ? "目标价数据不足" : "Insufficient target price data"}
      </div>
    );
  }

  const allValues = [cp, targets.min, targets.max, targets.avg];
  const domainMin = Math.min(...allValues);
  const domainMax = Math.max(...allValues);
  const range = domainMax - domainMin || 1;
  const pad = range * 0.12;
  const scaleMin = domainMin - pad;
  const scaleMax = domainMax + pad;
  const fullRange = scaleMax - scaleMin;

  const pct = (val: number) => ((val - scaleMin) / fullRange) * 100;

  const cpPct = pct(cp);
  const lowPct = pct(targets.min);
  const avgPct = pct(targets.avg);
  const highPct = pct(targets.max);

  const upside = ((targets.avg - cp) / cp * 100).toFixed(1);
  const upsideColor = Number(upside) > 0 ? "text-emerald-500" : "text-red-500";

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-[11px] text-muted-foreground">{zh ? "最低目标" : "Low"}</div>
          <div className="text-sm font-semibold text-orange-500">${targets.min.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{zh ? "平均目标" : "Avg"}</div>
          <div className="text-sm font-semibold text-blue-500">${targets.avg.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{zh ? "最高目标" : "High"}</div>
          <div className="text-sm font-semibold text-emerald-500">${targets.max.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">{zh ? "当前价" : "Current"}</div>
          <div className="text-sm font-semibold">${cp.toFixed(2)}</div>
        </div>
      </div>

      {/* Visual range bar */}
      <div className="relative h-32 px-2">
        {/* Background range (low to high) */}
        <div
          className="absolute top-10 h-8 rounded-full bg-gradient-to-r from-orange-500/20 via-blue-500/20 to-emerald-500/20 border border-border"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />

        {/* Low marker */}
        <div className="absolute top-6" style={{ left: `${lowPct}%`, transform: "translateX(-50%)" }}>
          <div className="w-0.5 h-16 bg-orange-500 mx-auto" />
          <div className="text-[10px] text-orange-500 font-medium text-center mt-1 whitespace-nowrap">
            ${targets.min.toFixed(0)}
          </div>
        </div>

        {/* Avg marker */}
        <div className="absolute top-6" style={{ left: `${avgPct}%`, transform: "translateX(-50%)" }}>
          <div className="w-1 h-16 bg-blue-500 mx-auto rounded" />
          <div className="text-[10px] text-blue-500 font-semibold text-center mt-1 whitespace-nowrap">
            {zh ? "均值" : "Avg"} ${targets.avg.toFixed(0)}
          </div>
        </div>

        {/* High marker */}
        <div className="absolute top-6" style={{ left: `${highPct}%`, transform: "translateX(-50%)" }}>
          <div className="w-0.5 h-16 bg-emerald-500 mx-auto" />
          <div className="text-[10px] text-emerald-500 font-medium text-center mt-1 whitespace-nowrap">
            ${targets.max.toFixed(0)}
          </div>
        </div>

        {/* Current price marker (diamond) */}
        <div className="absolute top-4" style={{ left: `${cpPct}%`, transform: "translateX(-50%)" }}>
          <div className="text-[10px] text-violet-500 font-semibold text-center mb-0.5 whitespace-nowrap">
            {zh ? "现价" : "Price"}
          </div>
          <div className="w-3 h-3 bg-violet-500 rotate-45 mx-auto" />
          <div className="w-0.5 h-10 bg-violet-500/50 mx-auto" style={{ marginTop: "2px" }} />
        </div>
      </div>

      {/* Upside/downside indicator */}
      <div className="text-center pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          {zh ? "与平均目标价相比: " : "vs Avg Target: "}
        </span>
        <span className={`text-sm font-bold ${upsideColor}`}>
          {Number(upside) > 0 ? "+" : ""}{upside}%
        </span>
        <span className="text-xs text-muted-foreground ml-2">
          {Number(upside) > 10
            ? (zh ? "潜在上行空间较大" : "significant upside potential")
            : Number(upside) > 0
            ? (zh ? "小幅上行空间" : "modest upside")
            : Number(upside) > -10
            ? (zh ? "接近目标价" : "near target")
            : (zh ? "高于目标价" : "above target")}
        </span>
      </div>
    </div>
  );
}
