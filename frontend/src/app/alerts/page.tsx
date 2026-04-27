"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tier } from "@/types/stock";
import {
  BellRingIcon, Trash2Icon, MailIcon, CrownIcon,
  LockIcon, PlusIcon, PowerIcon,
} from "lucide-react";
import Link from "next/link";

interface AlertRecord {
  id: string;
  metric: string;
  condition: string;
  threshold: number;
  active: boolean;
  createdAt: string;
  stock: { ticker: string };
}

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const zh = locale === "zh";

  const userTier = ((session?.user as { tier?: string })?.tier ?? "free") as Tier;
  const isPro = userTier === "pro" || userTier === "premium";

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    ticker: "",
    metric: "current_price",
    condition: "below",
    threshold: "",
  });

  const metricOptions = [
    { value: "current_price", label: t("metric.currentPrice") },
    { value: "target_deviation", label: t("metric.targetDeviation") },
    { value: "dcf_deviation", label: t("metric.dcfDeviation") },
    { value: "forward_pe", label: t("metric.forwardPE") },
    { value: "peg_ratio", label: t("metric.pegRatio") },
  ];

  const loadAlerts = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
    } catch {
      setError(zh ? "加载提醒失败" : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [session?.user, zh]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/alerts");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) loadAlerts();
  }, [session?.user, loadAlerts]);

  const createAlert = async () => {
    if (!form.ticker.trim() || !form.threshold) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker.trim().toUpperCase(),
          metric: form.metric,
          condition: form.condition,
          threshold: form.threshold,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create alert");
      }
      setForm({ ticker: "", metric: "current_price", condition: "below", threshold: "" });
      await loadAlerts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      setError(zh ? "删除失败" : "Failed to delete");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return null;

  if (!isPro) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <LockIcon className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">{zh ? "价格提醒 — Pro 专属功能" : "Price Alerts — Pro Feature"}</h1>
          <p className="text-muted-foreground">
            {zh
              ? "升级到 Pro（S$1.99/月）即可设置无限价格提醒，当股票达到你的目标估值时，通过邮件即时通知。"
              : "Upgrade to Pro (S$1.99/mo) to set unlimited price alerts. Get notified by email when stocks hit your target valuations."}
          </p>
        </div>
        <div className="space-y-3 text-left max-w-sm mx-auto">
          <div className="flex items-center gap-3 text-sm">
            <BellRingIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{zh ? "无限价格和估值提醒" : "Unlimited price & valuation alerts"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MailIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{zh ? "邮件即时推送通知" : "Instant email notifications"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <PowerIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{zh ? "支持 5 种指标触发条件" : "5 metric trigger conditions"}</span>
          </div>
        </div>
        <Link href="/pricing">
          <Button className="gap-2">
            <CrownIcon className="h-4 w-4" />
            {zh ? "升级到 Pro" : "Upgrade to Pro"}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-1">{t("alerts.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {zh
            ? "设置自定义触发条件，当股票达到你的目标估值时通过邮件通知你。"
            : "Set custom triggers to get notified by email when stocks hit your target valuations."}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">✕</button>
        </div>
      )}

      {/* Notification info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <MailIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">
              {zh ? "邮件推送通知" : "Email Push Notifications"}
            </p>
            <p className="text-xs text-muted-foreground">
              {zh
                ? `提醒触发后会发送至你的登录邮箱 (${session.user?.email})。系统每小时检查一次所有活跃提醒。`
                : `Triggered alerts are sent to your login email (${session.user?.email}). The system checks all active alerts hourly.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Create alert form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            {t("alerts.create")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.ticker")}</label>
              <Input
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder="NVDA"
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.metric")}</label>
              <select
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {metricOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.condition")}</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="below">{t("alerts.fallsBelow")}</option>
                <option value="above">{t("alerts.risesAbove")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("alerts.threshold")}</label>
              <Input
                type="number"
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                placeholder={form.metric === "current_price" ? "120.00" : "-20"}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={createAlert}
                disabled={creating || !form.ticker.trim() || !form.threshold}
                className="w-full"
              >
                {creating ? "..." : t("alerts.add")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active alerts list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("alerts.active")} ({alerts.filter((a) => a.active).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <BellRingIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t("alerts.none")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    alert.active ? "hover:bg-accent/30" : "opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-bold font-mono">{alert.stock.ticker}</span>
                    <span className="text-sm text-muted-foreground">
                      {metricOptions.find((m) => m.value === alert.metric)?.label}{" "}
                      {alert.condition === "below" ? t("alerts.fallsBelow") : t("alerts.risesAbove")}{" "}
                      <span className="text-primary font-semibold">{alert.threshold}</span>
                    </span>
                    <Badge variant={alert.active ? "success" : "secondary"} className="text-[10px]">
                      {alert.active ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() => deleteAlert(alert.id)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
