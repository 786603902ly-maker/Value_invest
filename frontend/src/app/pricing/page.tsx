"use client";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic valuation data",
    features: [
      "3 stocks in watchlist",
      "Yahoo Finance data",
      "Basic deviation chart",
      "Community access",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    description: "Full analysis for active investors",
    features: [
      "20 stocks in watchlist",
      "Yahoo Finance + FMP data",
      "All chart types",
      "5 email alerts",
      "CSV data export",
      "15-min data refresh",
    ],
    cta: "Subscribe Pro",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "$19.99",
    period: "/month",
    description: "Unlimited power for serious investors",
    features: [
      "Unlimited watchlist",
      "All data sources",
      "All chart types",
      "Unlimited alerts (email + Telegram)",
      "CSV data export",
      "5-min data refresh",
      "REST API access",
      "Priority support",
    ],
    cta: "Go Premium",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">
          Simple, transparent pricing
        </h1>
        <p className="text-slate-400 mt-2">
          Choose the plan that fits your investment workflow
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-xl p-6 flex flex-col ${
              tier.highlighted
                ? "bg-emerald-500/10 border-2 border-emerald-500"
                : "bg-slate-800/50 border border-slate-700"
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </div>
            )}
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">{tier.name}</h3>
              <p className="text-slate-400 text-sm mt-1">{tier.description}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">{tier.price}</span>
              <span className="text-slate-400 text-sm">{tier.period}</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-slate-300"
                >
                  <svg
                    className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                tier.highlighted
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-slate-200"
              }`}
              onClick={() => {
                // TODO: Stripe checkout integration
                alert(
                  tier.name === "Free"
                    ? "Free plan - just sign up!"
                    : `Stripe checkout for ${tier.name} plan coming soon!`
                );
              }}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-12 space-y-4">
        <h2 className="text-xl font-bold text-white text-center mb-6">
          Frequently Asked Questions
        </h2>
        {[
          {
            q: "Where does the data come from?",
            a: "We aggregate data from Yahoo Finance (analyst consensus, forward P/E, PEG) and Financial Modeling Prep (DCF models, analyst estimates). Pro and Premium users get data from both sources.",
          },
          {
            q: "Can I cancel anytime?",
            a: "Yes! All subscriptions are month-to-month with no contracts. Cancel anytime from your account settings.",
          },
          {
            q: "How often is data refreshed?",
            a: "Free tier caches data for 1 hour. Pro refreshes every 15 minutes. Premium users get 5-minute refresh intervals.",
          },
          {
            q: "What notification options are available?",
            a: "Pro users get email alerts. Premium users can also receive Telegram notifications for instant alerts.",
          },
        ].map((faq) => (
          <details
            key={faq.q}
            className="bg-slate-800/50 border border-slate-700 rounded-lg"
          >
            <summary className="px-4 py-3 cursor-pointer text-white font-medium text-sm hover:text-emerald-400 transition-colors">
              {faq.q}
            </summary>
            <p className="px-4 pb-3 text-slate-400 text-sm">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
