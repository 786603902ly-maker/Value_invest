"use client";

import { StockValuation } from "@/types/stock";
import { useI18n } from "@/lib/i18n";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Props {
  stock: StockValuation;
}

function marginOfSafety(currentPrice: number, fairValue: number): number {
  return Math.round(((fairValue - currentPrice) / fairValue) * 100);
}

function mosToScore(mos: number): number {
  return Math.max(0, Math.min(100, mos + 50));
}

export default function MarginOfSafetyChart({ stock }: Props) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const cp = stock.current_price;

  if (!cp) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        {zh ? "无当前价格数据" : "No current price data"}
      </div>
    );
  }

  const axes: { axis: string; score: number; mos: number; fairValue: number }[] = [];

  const validSources = stock.dcf_fair_value.sources.filter((s) => s.value > 0);
  for (const s of validSources.slice(0, 4)) {
    const label = s.model?.replace(/\s*\(.*\)/, "").split(" ").slice(0, 2).join(" ") || s.source;
    axes.push({
      axis: label,
      score: mosToScore(marginOfSafety(cp, s.value)),
      mos: marginOfSafety(cp, s.value),
      fairValue: s.value,
    });
  }

  if (stock.dcf_fair_value.avg && stock.dcf_fair_value.avg > 0) {
    axes.push({
      axis: zh ? "DCF均值" : "DCF Avg",
      score: mosToScore(marginOfSafety(cp, stock.dcf_fair_value.avg)),
      mos: marginOfSafety(cp, stock.dcf_fair_value.avg),
      fairValue: stock.dcf_fair_value.avg,
    });
  }

  if (stock.target_price.avg && stock.target_price.avg > 0) {
    axes.push({
      axis: zh ? "目标价" : "Target",
      score: mosToScore(marginOfSafety(cp, stock.target_price.avg)),
      mos: marginOfSafety(cp, stock.target_price.avg),
      fairValue: stock.target_price.avg,
    });
  }

  if (stock.forward_pe.value && stock.forward_pe.value > 0) {
    const fpeScore = stock.forward_pe.value < 15 ? 75
      : stock.forward_pe.value < 20 ? 62
      : stock.forward_pe.value < 25 ? 50
      : stock.forward_pe.value < 35 ? 38
      : 25;
    axes.push({
      axis: "Fwd P/E",
      score: fpeScore,
      mos: fpeScore - 50,
      fairValue: stock.forward_pe.value,
    });
  }

  if (stock.forward_pe.value && stock.forward_pe.sector_avg && stock.forward_pe.value > 0) {
    const impliedPrice = (cp / stock.forward_pe.value) * stock.forward_pe.sector_avg;
    if (impliedPrice > 0) {
      axes.push({
        axis: zh ? "行业PE" : "Sector PE",
        score: mosToScore(marginOfSafety(cp, impliedPrice)),
        mos: marginOfSafety(cp, impliedPrice),
        fairValue: impliedPrice,
      });
    }
  }

  if (stock.peg_ratio.value && stock.peg_ratio.value > 0) {
    const pegMos = Math.round((1 - stock.peg_ratio.value) * 30);
    axes.push({
      axis: "PEG",
      score: mosToScore(pegMos),
      mos: pegMos,
      fairValue: stock.peg_ratio.value,
    });
  }

  if (axes.length < 3) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        {zh ? "需要至少3个估值维度" : "Need at least 3 valuation dimensions"}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const isPeg = d.axis === "PEG";
    const isFpe = d.axis === "Fwd P/E";
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium">{d.axis}</p>
        <p className="text-muted-foreground">
          {isPeg
            ? `PEG: ${d.fairValue.toFixed(2)}`
            : isFpe
            ? `Fwd P/E: ${d.fairValue.toFixed(1)}`
            : `${zh ? "公允价值" : "Fair value"}: $${d.fairValue.toFixed(2)}`}
        </p>
        <p className={d.mos > 0 ? "text-green-600" : "text-red-600"}>
          {zh ? "安全边际: " : "Margin of safety: "}
          {d.mos > 0 ? "+" : ""}{d.mos}%
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={axes}>
        <PolarGrid />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={zh ? "安全边际得分" : "MoS Score"}
          dataKey="score"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.3}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
