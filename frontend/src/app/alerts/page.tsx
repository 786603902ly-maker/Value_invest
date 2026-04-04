"use client";

import { useState } from "react";

interface AlertRule {
  id: string;
  ticker: string;
  metric: string;
  condition: string;
  threshold: number;
  active: boolean;
  email?: string;
}

const metricOptions = [
  { value: "current_price", label: "Current Price" },
  { value: "dcf_deviation", label: "DCF Deviation %" },
  { value: "target_deviation", label: "Target Deviation %" },
  { value: "forward_pe", label: "Forward P/E" },
  { value: "peg_ratio", label: "PEG Ratio" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [form, setForm] = useState({
    ticker: "",
    metric: "dcf_deviation",
    condition: "below",
    threshold: "",
    email: "",
  });

  const addAlert = () => {
    if (!form.ticker || !form.threshold) return;

    const newAlert: AlertRule = {
      id: Date.now().toString(),
      ticker: form.ticker.toUpperCase(),
      metric: form.metric,
      condition: form.condition,
      threshold: parseFloat(form.threshold),
      active: true,
      email: form.email,
    };

    setAlerts((prev) => [...prev, newAlert]);
    setForm({ ...form, ticker: "", threshold: "" });
  };

  const toggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Price & Valuation Alerts
        </h1>
        <p className="text-slate-400 text-sm">
          Set custom triggers to get notified when stocks hit your target
          valuations. Available for Pro and Premium subscribers.
        </p>
      </div>

      {/* Create Alert Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Create New Alert
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ticker</label>
            <input
              type="text"
              value={form.ticker}
              onChange={(e) =>
                setForm({ ...form, ticker: e.target.value.toUpperCase() })
              }
              placeholder="NVDA"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Metric</label>
            <select
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
            >
              {metricOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Condition
            </label>
            <select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
            >
              <option value="below">Falls below</option>
              <option value="above">Rises above</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Threshold
            </label>
            <input
              type="number"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
              placeholder="e.g. -20"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addAlert}
              disabled={!form.ticker || !form.threshold}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add Alert
            </button>
          </div>
        </div>

        {/* Email */}
        <div className="mt-4">
          <label className="block text-xs text-slate-400 mb-1">
            Notification Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="your@email.com"
            className="w-full max-w-md bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Active Alerts ({alerts.filter((a) => a.active).length})
        </h2>
        {alerts.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No alerts yet. Create one above to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  alert.active
                    ? "bg-slate-900/50 border-slate-600"
                    : "bg-slate-900/20 border-slate-700/50 opacity-50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-white">
                    {alert.ticker}
                  </span>
                  <span className="text-sm text-slate-400">
                    {metricOptions.find((m) => m.value === alert.metric)?.label}{" "}
                    {alert.condition === "below" ? "falls below" : "rises above"}{" "}
                    <span className="text-emerald-400 font-medium">
                      {alert.threshold}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      alert.active
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {alert.active ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="px-3 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification Channels */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Notification Channels
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-medium text-white">Email</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                Pro+
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Daily summary + instant alerts to your inbox
            </p>
          </div>

          <div className="border border-slate-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-sky-500/20 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </div>
              <span className="font-medium text-white">Telegram</span>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                Premium
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Instant push notifications to your Telegram
            </p>
          </div>

          <div className="border border-slate-600 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-orange-500/20 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="font-medium text-white">Browser</span>
              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Browser push notifications (no email needed)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
