"""
Alert checker service.
Now calls the Next.js /api/alerts/check endpoint which handles
database queries and email sending via Prisma + Resend.
Can be run as a cron job or scheduled task.
"""

import asyncio
import httpx
import os


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CRON_SECRET = os.getenv("CRON_SECRET", "valueinvest-cron-2024")


async def run_check():
    """Trigger alert check via the Next.js API."""
    print("Starting alert check...")
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{FRONTEND_URL}/api/alerts/check",
                headers={"Authorization": f"Bearer {CRON_SECRET}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"Alert check complete: {data}")
            else:
                print(f"Alert check failed: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"Alert check error: {e}")


if __name__ == "__main__":
    asyncio.run(run_check())
