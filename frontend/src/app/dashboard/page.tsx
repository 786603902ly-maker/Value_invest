"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import StockSearch from "@/components/StockSearch";
import ValuationTable from "@/components/ValuationTable";
import DeviationBarChart from "@/components/DeviationBarChart";
import ScatterPlot from "@/components/ScatterPlot";
import GaugeChart from "@/components/GaugeChart";
import { StockValuation } from "@/types/stock";

export default function DashboardPage() {
  const { t } = useI18n();
  const [stocks, setStocks] = useState<StockValuation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (symbols: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch");
      }
      const data = await res.json();
      setStocks(Array.isArray(data) ? data : [data]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("dashboard.subtitle")}</p>
      </div>

      <StockSearch onSearch={handleSearch} loading={loading} />

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">{t("dashboard.loading")}</span>
        </div>
      )}

      {!loading && stocks.length > 0 && (
        <>
          <ValuationTable data={stocks} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DeviationBarChart data={stocks} />
            <GaugeChart data={stocks} />
          </div>
          <ScatterPlot data={stocks} />
        </>
      )}
    </div>
  );
}
