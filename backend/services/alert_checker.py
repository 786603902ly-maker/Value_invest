"""
Alert checker service.
Designed to be run as a scheduled job (cron or background task).
Fetches all active alerts, checks current valuations, and triggers notifications.
"""

import asyncio
import httpx
import sqlite3
import json
import os


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
DB_PATH = os.getenv("DB_PATH", "../frontend/prisma/dev.db")


def get_active_alerts() -> list[dict]:
    """Fetch active alerts from SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.id, a.metric, a.condition, a.threshold, a.userId,
               s.ticker, u.email, u.tier
        FROM Alert a
        JOIN Stock s ON a.stockId = s.id
        JOIN User u ON a.userId = u.id
        WHERE a.active = 1 AND u.tier IN ('pro', 'premium')
    """)

    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts


async def get_current_value(ticker: str, metric: str) -> float | None:
    """Fetch current value for a specific metric from the valuation API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"http://localhost:8000/api/valuation/{ticker}")
        if resp.status_code != 200:
            return None

        data = resp.json()

        metric_map = {
            "current_price": lambda d: d.get("current_price"),
            "dcf_deviation": lambda d: d.get("deviations", {}).get("vs_avg_dcf"),
            "target_deviation": lambda d: d.get("deviations", {}).get("vs_avg_target"),
            "forward_pe": lambda d: d.get("forward_pe", {}).get("value"),
            "peg_ratio": lambda d: d.get("peg_ratio", {}).get("value"),
            "dcf_fair_value": lambda d: d.get("dcf_fair_value", {}).get("avg"),
            "target_price": lambda d: d.get("target_price", {}).get("avg"),
        }

        extractor = metric_map.get(metric)
        if extractor:
            return extractor(data)
        return None


def check_trigger(current: float, condition: str, threshold: float) -> bool:
    """Check if alert condition is met."""
    if condition == "below":
        return current <= threshold
    elif condition == "above":
        return current >= threshold
    return False


async def send_notification(email: str, triggered: list[dict]):
    """Send notification via the frontend API."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            await client.post(
                f"{FRONTEND_URL}/api/notifications",
                json={"email": email, "alerts": triggered},
            )
        except Exception as e:
            print(f"Failed to send notification to {email}: {e}")


async def run_check():
    """Main alert checking loop."""
    print("Starting alert check...")
    alerts = get_active_alerts()
    print(f"Found {len(alerts)} active alerts")

    # Group by email for batch notifications
    by_email: dict[str, list[dict]] = {}

    for alert in alerts:
        current = await get_current_value(alert["ticker"], alert["metric"])
        if current is None:
            print(f"  Could not get {alert['metric']} for {alert['ticker']}")
            continue

        if check_trigger(current, alert["condition"], alert["threshold"]):
            email = alert["email"]
            if email not in by_email:
                by_email[email] = []
            by_email[email].append({
                "ticker": alert["ticker"],
                "metric": alert["metric"],
                "condition": alert["condition"],
                "threshold": alert["threshold"],
                "currentValue": current,
            })
            print(f"  TRIGGERED: {alert['ticker']} {alert['metric']} "
                  f"{alert['condition']} {alert['threshold']} (current: {current})")

    # Send notifications
    for email, triggered in by_email.items():
        await send_notification(email, triggered)
        print(f"  Sent notification to {email} ({len(triggered)} alerts)")

    print(f"Alert check complete. {sum(len(v) for v in by_email.values())} triggers sent.")


if __name__ == "__main__":
    asyncio.run(run_check())
