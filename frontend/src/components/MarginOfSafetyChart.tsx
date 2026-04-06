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

// Normalize a margin-of-safety % to a 0-100 score for radar
// -50% mos → 0 score, +50% mos → 100 score
function mosToScore(mos: number): number {
  return Math.max(0, Math.min(100, mos + 50));
}

export default function MarginOfSafetyChart({ stock }: Props) {
  const { locale } = useI18n();
  const cp = stock.current_price;

  if (!cp) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        {locale === "zh" ? "无当前价格数据" : "No current price data"}
      </div>
    );
  }

  // Build radar axes from DCF sources
  const dcfAxes = stock.dcf_fair_value.sources.slice(0, 5).map((s) => ({
    axis: s.model?.split(" ")[0] || s.source,
    score: mosToScore(marginOfSafety(cp, s.value)),
    mos: marginOfSafety(cp, s.value),
    fairValue: s.value,
  }));

  // Target price axis
  if (stock.target_price.avg) {
    dcfAxes.push({
      axis: locale === "zh" ? "目标价" : "Target",
      score: mosToScore(marginOfSafety(cp, stock.target_price.avg)),
      mos: marginOfSafety(cp, stock.target_price.avg),
      fairValue: stock.target_price.avg,
    });
  }

  if (dcfAxes.length < 3) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        {locale === "zh" ? "需要至少3个估值模型" : "Need at least 3 valuation models"}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium">{d.axis}</p>
        <p className="text-muted-foreground">
          {locale === "zh" ? "公允价值: " : "Fair value: "}
          ${d.fairValue?.toFixed(2)}
        </p>
        <p className={d.mos > 0 ? "text-green-600" : "text-red-600"}>
          {locale === "zh" ? "安全边际: " : "Margin of safety: "}
          {d.mos > 0 ? "+" : ""}{d.mos}%
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={dcfAxes}>
        <PolarGrid />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        <Radar
          name={locale === "zh" ? "安全边际得分" : "MoS Score"}
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
