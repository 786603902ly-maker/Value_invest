import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAlertEmail(
  to: string,
  alerts: {
    ticker: string;
    metric: string;
    condition: string;
    threshold: number;
    currentValue: number;
  }[]
) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Resend] No API key configured. Skipping email.");
    return;
  }

  const alertRows = alerts
    .map(
      (a) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #334155">${a.ticker}</td>
          <td style="padding:8px;border-bottom:1px solid #334155">${a.metric}</td>
          <td style="padding:8px;border-bottom:1px solid #334155">${a.condition} ${a.threshold}</td>
          <td style="padding:8px;border-bottom:1px solid #334155">${a.currentValue}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: "ValueInvest <alerts@valueinvest.app>",
    to,
    subject: `ValueInvest Alert: ${alerts.length} trigger(s) activated`,
    html: `
      <div style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:12px">
        <h2 style="color:#10b981;margin-bottom:16px">ValueInvest Alert</h2>
        <p>The following alert(s) have been triggered:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="color:#94a3b8;text-align:left">
              <th style="padding:8px;border-bottom:2px solid #475569">Stock</th>
              <th style="padding:8px;border-bottom:2px solid #475569">Metric</th>
              <th style="padding:8px;border-bottom:2px solid #475569">Trigger</th>
              <th style="padding:8px;border-bottom:2px solid #475569">Current</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">
          Manage your alerts at valueinvest.app/alerts
        </p>
      </div>
    `,
  });
}
