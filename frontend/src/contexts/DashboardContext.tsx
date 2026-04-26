"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { StockValuation } from "@/types/stock";

interface DashboardState {
  stocks: StockValuation[];
  setStocks: (stocks: StockValuation[]) => void;
  activeStock: string | null;
  setActiveStock: (ticker: string | null) => void;
  searchTags: string[];
  setSearchTags: (tags: string[]) => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState<StockValuation[]>([]);
  const [activeStock, setActiveStock] = useState<string | null>(null);
  const [searchTags, setSearchTags] = useState<string[]>([]);
  return (
    <DashboardContext.Provider value={{ stocks, setStocks, activeStock, setActiveStock, searchTags, setSearchTags }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
