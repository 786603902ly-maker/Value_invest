import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      {/* Hero */}
      <div className="max-w-3xl space-y-6">
        <h1 className="text-5xl font-bold text-white leading-tight">
          Smarter Stock Valuation
          <br />
          <span className="text-emerald-400">for Value Investors</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Compare DCF fair values, analyst target prices, PEG ratios, and
          forward P/E from multiple institutions — all in one dashboard. Know
          when to buy, hold, or sell.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors text-lg"
          >
            Start Analyzing
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg font-semibold transition-colors text-lg"
          >
            View Pricing
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl w-full">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-left">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Multi-Source Data</h3>
          <p className="text-slate-400 text-sm">
            Aggregate DCF valuations, analyst targets, and key ratios from
            Yahoo Finance, FMP, and more. See the complete picture.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-left">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Visual Insights</h3>
          <p className="text-slate-400 text-sm">
            Interactive charts show how current price deviates from fair value.
            Color-coded signals tell you Buy, Hold, or Sell at a glance.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-left">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-white font-semibold mb-2">Smart Alerts</h3>
          <p className="text-slate-400 text-sm">
            Set custom thresholds for any metric. Get notified via email or
            Telegram when it&apos;s time to act.
          </p>
        </div>
      </div>
    </div>
  );
}
