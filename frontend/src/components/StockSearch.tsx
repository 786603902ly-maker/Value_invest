"use client";

import { useState, useCallback } from "react";

interface StockSearchProps {
  onSearch: (symbols: string[]) => void;
  loading?: boolean;
}

export default function StockSearch({ onSearch, loading }: StockSearchProps) {
  const [input, setInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

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
    // Also process any remaining input
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

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-3">
        Enter Stock Tickers
      </h2>
      <div className="flex flex-wrap gap-2 items-center bg-slate-900 border border-slate-600 rounded-lg p-3 min-h-[48px] focus-within:border-emerald-500 transition-colors">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-emerald-200 ml-1"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length ? "Add more..." : "NVDA, TSM, PLTR..."}
          className="flex-1 min-w-[120px] bg-transparent text-white placeholder-slate-500 outline-none text-sm"
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-slate-500">
          Press Enter, comma, or space to add tickers
        </p>
        <button
          onClick={handleSubmit}
          disabled={loading || (tags.length === 0 && !input.trim())}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Loading..." : "Analyze"}
        </button>
      </div>
    </div>
  );
}
