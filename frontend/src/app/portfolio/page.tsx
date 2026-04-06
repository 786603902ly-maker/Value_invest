"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Portfolio, StockValuation } from "@/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ValuationTable from "@/components/ValuationTable";
import { PlusIcon, Trash2Icon, LineChartIcon, PencilIcon, CheckIcon, XIcon } from "lucide-react";

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useI18n();

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [valuations, setValuations] = useState<StockValuation[]>([]);
  const [loadingValuations, setLoadingValuations] = useState(false);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const zh = locale === "zh";

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load portfolios
  const loadPortfolios = useCallback(async () => {
    if (!session) return;
    setLoadingPortfolios(true);
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to load");
      const data: Portfolio[] = await res.json();
      setPortfolios(data);
      if (data.length > 0 && !activeId) setActiveId(data[0].id);
    } catch {
      setError(zh ? "加载投资组合失败" : "Failed to load portfolios");
    } finally {
      setLoadingPortfolios(false);
    }
  }, [session, activeId, zh]);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  // Fetch valuations for active portfolio
  const activePortfolio = portfolios.find((p) => p.id === activeId);

  useEffect(() => {
    if (!activePortfolio?.items.length) {
      setValuations([]);
      return;
    }
    const tickers = activePortfolio.items.map((i) => i.ticker).join(",");
    setLoadingValuations(true);
    fetch(`/api/stocks?symbols=${tickers}`)
      .then((r) => r.json())
      .then((d) => setValuations(Array.isArray(d) ? d : []))
      .catch(() => setValuations([]))
      .finally(() => setLoadingValuations(false));
  }, [activePortfolio]);

  async function createPortfolio() {
    if (!newPortfolioName.trim()) return;
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: newPortfolioName.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error);
      return;
    }
    const p: Portfolio = await res.json();
    setPortfolios((prev) => [...prev, p]);
    setActiveId(p.id);
    setNewPortfolioName("");
  }

  async function deletePortfolio(id: string) {
    const res = await fetch(`/api/portfolio?id=${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setPortfolios((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId(portfolios.find((p) => p.id !== id)?.id ?? null);
  }

  async function addTicker() {
    if (!activeId || !newTicker.trim()) return;
    const ticker = newTicker.trim().toUpperCase();
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addTicker", portfolioId: activeId, ticker }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error);
      return;
    }
    setNewTicker("");
    await loadPortfolios();
  }

  async function removeTicker(ticker: string) {
    if (!activeId) return;
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeTicker", portfolioId: activeId, ticker }),
    });
    await loadPortfolios();
  }

  async function renamePortfolio(id: string, name: string) {
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", portfolioId: id, name }),
    });
    setEditingName(null);
    await loadPortfolios();
  }

  if (status === "loading" || loadingPortfolios) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">
          {zh ? "我的投资组合" : "My Portfolios"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {zh
            ? "创建并追踪你的股票组合，下次登录可继续查看"
            : "Create and track your stock portfolios — saved across sessions"}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Portfolio list */}
        <div className="lg:col-span-1 space-y-3">
          <div className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            {zh ? "组合列表" : "Portfolios"}
          </div>

          {portfolios.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer border transition-colors ${
                activeId === p.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "hover:bg-muted/50 border-transparent"
              }`}
              onClick={() => setActiveId(p.id)}
            >
              {editingName === p.id ? (
                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    className="h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renamePortfolio(p.id, editNameValue);
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    autoFocus
                  />
                  <button onClick={() => renamePortfolio(p.id, editNameValue)}>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                  </button>
                </div>
              ) : (
                <>
                  <LineChartIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {p.items.length}
                  </Badge>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingName(p.id);
                        setEditNameValue(p.name);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePortfolio(p.id);
                      }}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Create new portfolio */}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder={zh ? "新组合名称..." : "New portfolio name..."}
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createPortfolio()}
            />
            <Button size="sm" onClick={createPortfolio} className="h-8 px-2">
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: Active portfolio */}
        <div className="lg:col-span-3 space-y-4">
          {!activePortfolio ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {zh
                  ? "← 选择一个组合，或创建新的投资组合"
                  : "← Select a portfolio or create a new one"}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{activePortfolio.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {activePortfolio.items.length}{" "}
                      {zh ? "只股票" : "stocks"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Add ticker */}
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder={zh ? "添加股票代码 (如 NVDA)" : "Add ticker (e.g. NVDA)"}
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                      className="h-9 font-mono uppercase"
                      onKeyDown={(e) => e.key === "Enter" && addTicker()}
                    />
                    <Button onClick={addTicker} size="sm" className="h-9">
                      <PlusIcon className="h-4 w-4 mr-1" />
                      {zh ? "添加" : "Add"}
                    </Button>
                  </div>

                  {/* Ticker chips */}
                  {activePortfolio.items.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activePortfolio.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm font-mono group"
                        >
                          {item.ticker}
                          <button
                            onClick={() => removeTicker(item.ticker)}
                            className="ml-1 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {zh ? "还没有股票 — 在上方添加" : "No stocks yet — add one above"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Valuation data */}
              {loadingValuations ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {zh ? "加载估值数据..." : "Loading valuations..."}
                  </span>
                </div>
              ) : valuations.length > 0 ? (
                <ValuationTable data={valuations} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
