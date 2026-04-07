"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StockSearchProps {
  onSearch: (symbols: string[]) => void;
  loading?: boolean;
}

const POPULAR_STOCKS = [
  { symbol: "NVDA", name: "英伟达 NVIDIA", category: "AI/芯片" },
  { symbol: "AAPL", name: "苹果 Apple", category: "科技" },
  { symbol: "MSFT", name: "微软 Microsoft", category: "科技" },
  { symbol: "GOOGL", name: "谷歌 Alphabet", category: "科技" },
  { symbol: "AMZN", name: "亚马逊 Amazon", category: "电商/云" },
  { symbol: "META", name: "Meta (Facebook)", category: "社交" },
  { symbol: "TSLA", name: "特斯拉 Tesla", category: "电动车" },
  { symbol: "TSM", name: "台积电 TSMC", category: "芯片" },
  { symbol: "AVGO", name: "博通 Broadcom", category: "芯片" },
  { symbol: "AMD", name: "超威半导体 AMD", category: "芯片" },
  { symbol: "PLTR", name: "Palantir", category: "AI/数据" },
  { symbol: "SNOW", name: "Snowflake", category: "云数据" },
  { symbol: "CRM", name: "Salesforce", category: "SaaS" },
  { symbol: "NFLX", name: "奈飞 Netflix", category: "流媒体" },
  { symbol: "COST", name: "Costco 好市多", category: "零售" },
  { symbol: "LLY", name: "礼来 Eli Lilly", category: "医药" },
  { symbol: "V", name: "Visa 维萨", category: "金融" },
  { symbol: "JPM", name: "摩根大通 JPMorgan", category: "银行" },
  { symbol: "COIN", name: "Coinbase", category: "加密" },
  { symbol: "SMCI", name: "超微电脑 Super Micro", category: "AI/服务器" },
];

export default function StockSearch({ onSearch, loading }: StockSearchProps) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<
    { symbol: string; name: string; exchange?: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced remote search via Yahoo Finance (full universe)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setRemoteResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/stocks?search=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setRemoteResults(Array.isArray(data) ? data : []);
        }
      } catch {
        setRemoteResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const addTag = useCallback(
    (value: string) => {
      const symbol = value.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
      if (symbol && !tags.includes(symbol)) {
        setTags((prev) => [...prev, symbol]);
      }
    },
    [tags]
  );

  const removeTag = (symbol: string) => {
    setTags((prev) => prev.filter((t) => t !== symbol));
  };

  const togglePopular = (symbol: string) => {
    if (tags.includes(symbol)) {
      removeTag(symbol);
    } else {
      addTag(symbol);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === "," || e.key === " ") && input.trim()) {
      e.preventDefault();
      const parts = input.split(/[,\s]+/).filter(Boolean);
      parts.forEach(addTag);
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSubmit = () => {
    if (input.trim()) {
      const parts = input.split(/[,\s]+/).filter(Boolean);
      const newTags = [...tags];
      parts.forEach((p) => {
        const sym = p.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
        if (sym && !newTags.includes(sym)) newTags.push(sym);
      });
      setTags(newTags);
      setInput("");
      onSearch(newTags);
    } else if (tags.length > 0) {
      onSearch(tags);
    }
  };

  const filteredStocks = searchQuery
    ? POPULAR_STOCKS.filter(
        (s) =>
          s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_STOCKS;

  // Merge local popular + remote results, dedupe by symbol
  const combinedResults = (() => {
    const seen = new Set<string>();
    const out: { symbol: string; name: string; category?: string; exchange?: string }[] = [];
    for (const s of filteredStocks) {
      if (!seen.has(s.symbol)) {
        seen.add(s.symbol);
        out.push(s);
      }
    }
    for (const r of remoteResults) {
      if (!seen.has(r.symbol)) {
        seen.add(r.symbol);
        out.push(r);
      }
    }
    return out;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("dashboard.search.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tag input area */}
        <div className="flex flex-wrap gap-2 items-center border rounded-lg p-3 min-h-[48px] focus-within:ring-2 focus-within:ring-ring transition-all bg-background">
          {tags.map((tag) => (
            <Badge key={tag} variant="default" className="gap-1 pr-1">
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-primary-foreground/70 rounded-full"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Badge>
          ))}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length ? t("dashboard.search.addMore") : t("dashboard.search.placeholder")}
            className="flex-1 min-w-[150px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t("dashboard.search.hint")}</p>
          <Button
            onClick={handleSubmit}
            disabled={loading || (tags.length === 0 && !input.trim())}
          >
            {loading ? t("dashboard.search.loading") : t("dashboard.search.analyze")}
          </Button>
        </div>

        {/* Popular stocks section */}
        <Tabs defaultValue="popular" className="mt-2">
          <TabsList>
            <TabsTrigger value="popular">{t("dashboard.search.popular")}</TabsTrigger>
            <TabsTrigger value="search">{t("dashboard.search.searchLabel")}</TabsTrigger>
          </TabsList>

          <TabsContent value="popular">
            <div className="flex flex-wrap gap-2 pt-2">
              {POPULAR_STOCKS.slice(0, 12).map((stock) => {
                const selected = tags.includes(stock.symbol);
                return (
                  <button
                    key={stock.symbol}
                    onClick={() => togglePopular(stock.symbol)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent text-foreground"
                    }`}
                  >
                    <span className="font-medium">{stock.symbol}</span>
                    <span className="text-muted-foreground text-xs">{stock.name.split(" ")[0]}</span>
                    {selected && (
                      <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="search">
            <div className="space-y-3 pt-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("dashboard.search.searchPlaceholder")}
              />
              {searching && (
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.search.loading")}
                </p>
              )}
              <div className="max-h-[320px] overflow-y-auto space-y-1">
                {combinedResults.length === 0 && searchQuery && !searching && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("dashboard.search.loading")}
                  </p>
                )}
                {combinedResults.map((stock) => {
                  const selected = tags.includes(stock.symbol);
                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => togglePopular(stock.symbol)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        selected ? "bg-primary/10 text-primary" : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-semibold w-16 text-left shrink-0">
                          {stock.symbol}
                        </span>
                        <span className="text-muted-foreground truncate">{stock.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {"category" in stock && stock.category ? (
                          <Badge variant="secondary" className="text-xs">
                            {stock.category}
                          </Badge>
                        ) : stock.exchange ? (
                          <Badge variant="outline" className="text-xs">
                            {stock.exchange}
                          </Badge>
                        ) : null}
                        {selected && (
                          <svg
                            className="w-4 h-4 text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
