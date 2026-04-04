import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbols = searchParams.get("symbols");
  const search = searchParams.get("search");

  try {
    if (search) {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (symbols) {
      const res = await fetch(
        `${BACKEND_URL}/api/valuation/batch?symbols=${encodeURIComponent(symbols)}`,
        { next: { revalidate: 300 } }
      );
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Provide ?symbols= or ?search= parameter" }, { status: 400 });
  } catch (error) {
    console.error("Backend fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock data. Is the Python backend running?" },
      { status: 502 }
    );
  }
}
