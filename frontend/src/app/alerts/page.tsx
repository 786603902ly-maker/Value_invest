"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AlertRule {
  id: string;
  ticker: string;
  metric: string;
  condition: string;
  threshold: number;
  active: boolean;
}

export default function AlertsPage() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [form, setForm] = useState({
    ticker: "", metric: "dcf_deviation", condition: "below", threshold: "", email: "",
  });

  const metricOptions = [
    { value: "current_price", label: t("metric.currentPrice") },
    { value: "dcf_deviation", label: t("metric.dcfDeviation") },
    { value: "target_deviation", label: t("metric.targetDeviation") },
    { value: "forward_pe", label: t("metric.forwardPE") },
    { value: "peg_ratio", label: t("metric.pegRatio") },
  ];

  const addAlert = () => {
    if (!form.ticker || !form.threshold) return;
    setAlerts((prev) => [...prev, {
      id: Date.now().toString(),
      ticker: form.ticker.toUpperCase(),
      metric: form.metric,
      condition: form.condition,
      threshold: parseFloat(form.threshold),
      active: true,
    }]);
    setForm({ ...form, ticker: "", threshold: "" });
  };

  const toggleAlert = (id: string) => setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, active: !a.active } : a));
  const removeAlert = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t("alerts.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("alerts.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("alerts.create")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.ticker")}</label>
              <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} placeholder="NVDA" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.metric")}</label>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {metricOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.condition")}</label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="below">{t("alerts.fallsBelow")}</option>
                <option value="above">{t("alerts.risesAbove")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.threshold")}</label>
              <Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="-20" />
            </div>
            <div className="flex items-end">
              <Button onClick={addAlert} disabled={!form.ticker || !form.threshold} className="w-full">{t("alerts.add")}</Button>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-muted-foreground mb-1">{t("alerts.email")}</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className="max-w-md" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("alerts.active")} ({alerts.filter((a) => a.active).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("alerts.none")}</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className={`flex items-center justify-between p-4 rounded-lg border ${alert.active ? "" : "opacity-50"}`}>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">{alert.ticker}</span>
                    <span className="text-sm text-muted-foreground">
                      {metricOptions.find((m) => m.value === alert.metric)?.label}{" "}
                      {alert.condition === "below" ? t("alerts.fallsBelow") : t("alerts.risesAbove")}{" "}
                      <span className="text-primary font-medium">{alert.threshold}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={alert.active ? "default" : "secondary"} onClick={() => toggleAlert(alert.id)}>
                      {alert.active ? "ON" : "OFF"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => removeAlert(alert.id)}>
                      {"\u5220\u9664"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("alerts.channels")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{t("alerts.emailChannel")}</span>
                <Badge variant="success">Pro+</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("alerts.emailDesc")}</p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{t("alerts.telegramChannel")}</span>
                <Badge>Premium</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("alerts.telegramDesc")}</p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{t("alerts.browserChannel")}</span>
                <Badge variant="secondary">{t("alerts.comingSoon")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("alerts.browserDesc")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
