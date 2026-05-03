import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/resend";

const FREQUENCY_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

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

  // Filter to only alerts whose frequency cooldown has elapsed
  const now = Date.now();
  const dueAlerts = alerts.filter((a) => {
    const cooldown = FREQUENCY_MS[a.frequency] ?? FREQUENCY_MS.daily;
    const lastMs = a.lastNotifiedAt ? new Date(a.lastNotifiedAt).getTime() : 0;
    return now - lastMs >= cooldown;
  });

  if (dueAlerts.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0, skipped: alerts.length });
  }

  const tickers = Array.from(new Set(dueAlerts.map((a) => a.stock.ticker)));
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
      // skip ticker
    }
  }

  type TriggeredAlert = { ticker: string; metric: string; condition: string; threshold: number; currentValue: number };
  const emailBatch: { email: string; alerts: TriggeredAlert[] }[] = [];
  const inappRecords: { alertId: string; userId: string; ticker: string; metric: string; currentValue: number; threshold: number; condition: string }[] = [];
  const notifiedIds: string[] = [];

  for (const alert of dueAlerts) {
    const vals = valuationMap[alert.stock.ticker];
    if (!vals) continue;

    const current = vals[alert.metric];
    if (current == null) continue;

    const fired = alert.condition === "below" ? current <= alert.threshold : current >= alert.threshold;
    if (!fired) continue;

    notifiedIds.push(alert.id);

    if (alert.notifyVia === "email") {
      let entry = emailBatch.find((e) => e.email === alert.user.email);
      if (!entry) {
        entry = { email: alert.user.email, alerts: [] };
        emailBatch.push(entry);
      }
      entry.alerts.push({
        ticker: alert.stock.ticker,
        metric: alert.metric,
        condition: alert.condition,
        threshold: alert.threshold,
        currentValue: current,
      });
    } else {
      inappRecords.push({
        alertId: alert.id,
        userId: alert.userId,
        ticker: alert.stock.ticker,
        metric: alert.metric,
        currentValue: current,
        threshold: alert.threshold,
        condition: alert.condition,
      });
    }
  }

  // Send emails
  for (const entry of emailBatch) {
    try {
      await sendAlertEmail(entry.email, entry.alerts);
    } catch (e) {
      console.error(`Failed to send alert email to ${entry.email}:`, e);
    }
  }

  // Create in-app notifications
  if (inappRecords.length > 0) {
    await prisma.alertNotification.createMany({ data: inappRecords });
  }

  // Update lastNotifiedAt for all fired alerts
  if (notifiedIds.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: notifiedIds } },
      data: { lastNotifiedAt: new Date() },
    });
  }

  const total = emailBatch.reduce((s, e) => s + e.alerts.length, 0) + inappRecords.length;

  return NextResponse.json({
    checked: dueAlerts.length,
    triggered: total,
    emails: emailBatch.length,
    inapp: inappRecords.length,
  });
}
