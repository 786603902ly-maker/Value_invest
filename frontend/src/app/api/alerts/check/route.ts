import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "valueinvest-cron-2024";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await prisma.alert.findMany({
    where: { active: true, user: { tier: { in: ["pro", "premium"] } } },
    include: { stock: true, user: true },
  });

  if (alerts.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0 });
  }

  const tickers = Array.from(new Set(alerts.map((a) => a.stock.ticker)));
  const valuationMap: Record<string, Record<string, number | null>> = {};

  const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
  for (const ticker of tickers) {
    try {
      const res = await fetch(`${backendUrl}/api/valuation/${ticker}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        valuationMap[ticker] = {
          current_price: data.current_price ?? null,
          dcf_deviation: data.deviations?.vs_avg_dcf ?? null,
          target_deviation: data.deviations?.vs_avg_target ?? null,
          forward_pe: data.forward_pe?.value ?? null,
          peg_ratio: data.peg_ratio?.value ?? null,
          dcf_fair_value: data.dcf_fair_value?.avg ?? null,
          target_price: data.target_price?.avg ?? null,
        };
      }
    } catch {
      // skip
    }
  }

  const triggered: { email: string; alerts: { ticker: string; metric: string; condition: string; threshold: number; currentValue: number }[] }[] = [];

  for (const alert of alerts) {
    const vals = valuationMap[alert.stock.ticker];
    if (!vals) continue;

    const current = vals[alert.metric];
    if (current == null) continue;

    const fired =
      alert.condition === "below"
        ? current <= alert.threshold
        : current >= alert.threshold;

    if (fired) {
      const email = alert.user.email;
      let entry = triggered.find((t) => t.email === email);
      if (!entry) {
        entry = { email, alerts: [] };
        triggered.push(entry);
      }
      entry.alerts.push({
        ticker: alert.stock.ticker,
        metric: alert.metric,
        condition: alert.condition,
        threshold: alert.threshold,
        currentValue: current,
      });
    }
  }

  for (const entry of triggered) {
    try {
      await sendAlertEmail(entry.email, entry.alerts);
    } catch (e) {
      console.error(`Failed to send alert email to ${entry.email}:`, e);
    }
  }

  return NextResponse.json({
    checked: alerts.length,
    triggered: triggered.reduce((sum, e) => sum + e.alerts.length, 0),
    emails: triggered.length,
  });
}
