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
  LockIcon, PlusIcon, PowerIcon, MonitorIcon, CheckCheckIcon, BellIcon,
} from "lucide-react";
import Link from "next/link";

interface AlertRecord {
  id: string;
  metric: string;
  condition: string;
  threshold: number;
  active: boolean;
  frequency: string;
  notifyVia: string;
  createdAt: string;
  stock: { ticker: string };
}

interface InAppNotification {
  id: string;
  ticker: string;
  metric: string;
  condition: string;
  currentValue: number;
  threshold: number;
  read: boolean;
  createdAt: string;
}

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const zh = locale === "zh";

  const userTier = ((session?.user as { tier?: string })?.tier ?? "free") as Tier;
  const isPro = userTier === "pro" || userTier === "premium";

  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    ticker: "",
    metric: "current_price",
    condition: "below",
    threshold: "",
    frequency: "daily",
    notifyVia: "email",
  });

  const metricOptions = [
    { value: "current_price", label: t("metric.currentPrice") },
    { value: "target_deviation", label: t("metric.targetDeviation") },
    { value: "dcf_deviation", label: t("metric.dcfDeviation") },
    { value: "forward_pe", label: t("metric.forwardPE") },
    { value: "peg_ratio", label: t("metric.pegRatio") },
  ];

  const frequencyOptions = [
    { value: "hourly", label: zh ? "每小时一次" : "Hourly" },
    { value: "daily", label: zh ? "每天一次（默认）" : "Daily (default)" },
    { value: "weekly", label: zh ? "每周一次" : "Weekly" },
  ];

  const channelOptions = [
    { value: "email", label: zh ? "📧 邮件" : "📧 Email" },
    { value: "inapp", label: zh ? "🖥️ 网页端" : "🖥️ In-app" },
  ];

  const loadAlerts = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const [alertsRes, notifRes] = await Promise.all([
        fetch("/api/alerts"),
        fetch("/api/alerts/notifications"),
      ]);
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(Array.isArray(data) ? data : []);
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
          frequency: form.frequency,
          notifyVia: form.notifyVia,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create alert");
      }
      setForm({ ticker: "", metric: "current_price", condition: "below", threshold: "", frequency: "daily", notifyVia: "email" });
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

  const markAllRead = async () => {
    await fetch("/api/alerts/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await fetch("/api/alerts/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
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
              ? "升级到 Pro（S$1.99/月）即可设置无限价格提醒，通过邮件或网页端通知你。"
              : "Upgrade to Pro (S$1.99/mo) to set unlimited price alerts via email or in-app."}
          </p>
        </div>
        <div className="space-y-3 text-left max-w-sm mx-auto">
          <div className="flex items-center gap-3 text-sm">
            <BellRingIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{zh ? "无限价格和估值提醒" : "Unlimited price & valuation alerts"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MailIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{zh ? "邮件 / 网页端双渠道推送" : "Email & in-app notifications"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <PowerIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span>{zh ? "自定义频率：每小时/每天/每周" : "Custom frequency: hourly / daily / weekly"}</span>
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-1">{t("alerts.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {zh
            ? "设置自定义触发条件，通过邮件或网页端通知你。"
            : "Set custom triggers — get notified by email or in-app when conditions are met."}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-destructive text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-destructive/70 hover:text-destructive">✕</button>
        </div>
      )}

      {/* Create alert form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            {t("alerts.create")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: ticker, metric, condition, threshold */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          </div>

          {/* Row 2: frequency, notifyVia, submit */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                {zh ? "通知频率" : "Frequency"}
              </label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                {zh ? "通知方式" : "Notify via"}
              </label>
              <select
                value={form.notifyVia}
                onChange={(e) => setForm({ ...form, notifyVia: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {channelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Button
                onClick={createAlert}
                disabled={creating || !form.ticker.trim() || !form.threshold}
                className="w-full"
              >
                {creating ? "..." : t("alerts.add")}
              </Button>
            </div>
          </div>

          {/* Channel hint */}
          <p className="text-xs text-muted-foreground">
            {form.notifyVia === "email"
              ? (zh
                ? `📧 触发后发送至 ${session.user?.email}，频率受"通知频率"控制，不会重复打扰。`
                : `📧 Sent to ${session.user?.email} when triggered. Frequency controls how often you'll be re-notified.`)
              : (zh
                ? "🖥️ 触发记录将显示在本页下方的【网页端提醒】面板中，无需查收邮件。"
                : "🖥️ Triggered alerts appear in the In-app Notifications panel below — no email needed.")}
          </p>
        </CardContent>
      </Card>

      {/* In-app notifications panel */}
      {notifications.length > 0 && (
        <Card className={unreadCount > 0 ? "border-primary/40 bg-primary/5" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BellIcon className="h-5 w-5" />
                {zh ? "网页端提醒" : "In-App Notifications"}
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" onClick={markAllRead} className="gap-1.5 text-xs">
                  <CheckCheckIcon className="h-3.5 w-3.5" />
                  {zh ? "全部标为已读" : "Mark all read"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.slice(0, 20).map((n) => {
                const metricLabel = metricOptions.find((m) => m.value === n.metric)?.label ?? n.metric;
                const conditionLabel = n.condition === "below" ? t("alerts.fallsBelow") : t("alerts.risesAbove");
                const timeStr = new Date(n.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      n.read
                        ? "opacity-60 bg-muted/20"
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      <div>
                        <span className="font-bold font-mono text-sm">{n.ticker}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {metricLabel} {conditionLabel}{" "}
                          <span className="text-foreground font-semibold">{n.threshold}</span>
                          {zh ? "，当前值：" : " · now: "}
                          <span className="text-primary font-semibold">{n.currentValue.toFixed(2)}</span>
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">{timeStr}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
              {alerts.map((alert) => {
                const freqLabel = frequencyOptions.find((f) => f.value === alert.frequency)?.label ?? alert.frequency;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      alert.active ? "hover:bg-accent/30" : "opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold font-mono">{alert.stock.ticker}</span>
                      <span className="text-sm text-muted-foreground">
                        {metricOptions.find((m) => m.value === alert.metric)?.label}{" "}
                        {alert.condition === "below" ? t("alerts.fallsBelow") : t("alerts.risesAbove")}{" "}
                        <span className="text-primary font-semibold">{alert.threshold}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {alert.notifyVia === "email"
                            ? <><MailIcon className="h-3 w-3" />{zh ? "邮件" : "Email"}</>
                            : <><MonitorIcon className="h-3 w-3" />{zh ? "网页" : "In-app"}</>}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {freqLabel.replace("（默认）", "").replace(" (default)", "")}
                        </Badge>
                        <Badge variant={alert.active ? "success" : "secondary"} className="text-[10px]">
                          {alert.active ? "ON" : "OFF"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-red-600 flex-shrink-0"
                      onClick={() => deleteAlert(alert.id)}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
