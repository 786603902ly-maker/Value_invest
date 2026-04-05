import { NextRequest, NextResponse } from "next/server";
import { getFullValuation } from "@/lib/data/aggregator";
import { searchYahoo } from "@/lib/data/yahoo";

// In-memory cache
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  cache.delete(key);
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbols = searchParams.get("symbols");
  const search = searchParams.get("search");

  try {
    // Search mode
    if (search) {
      const results = await searchYahoo(search);
      return NextResponse.json(results);
    }

    // Valuation mode
    if (symbols) {
      const symbolList = symbols
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 20);

      if (!symbolList.length) {
        return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
      }

      const results = await Promise.all(
        symbolList.map(async (sym) => {
          const cached = getCached(sym);
          if (cached) return cached;

          try {
            const data = await getFullValuation(sym);
            cache.set(sym, { data, ts: Date.now() });
            return data;
          } catch (error) {
            console.error(`Error fetching ${sym}:`, error);
            return null;
          }
        })
      );

      return NextResponse.json(results.filter(Boolean));
    }

    return NextResponse.json(
      { error: "Provide ?symbols= or ?search= parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Stock API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}
