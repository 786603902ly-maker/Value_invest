"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "zh" | "en";

const translations = {
  zh: {
    // Nav
    "nav.dashboard": "估值看板",
    "nav.alerts": "价格提醒",
    "nav.pricing": "订阅方案",
    "nav.login": "登录",
    "nav.language": "EN",

    // Landing
    "landing.title1": "更聪明的股票估值",
    "landing.title2": "为价值投资者而生",
    "landing.subtitle": "汇聚多家机构的 DCF 公允价值、分析师目标价、PEG 比率和远期 P/E — 一站式看清估值全貌，辅助你做出买入、持有或卖出决策。",
    "landing.cta": "开始分析",
    "landing.pricing": "查看价格",
    "landing.feature1.title": "多源数据聚合",
    "landing.feature1.desc": "汇聚 Yahoo Finance、FMP 等多家机构的 DCF 估值、分析师目标价和关键指标，看到完整全貌。",
    "landing.feature2.title": "可视化洞察",
    "landing.feature2.desc": "交互式图表直观展示当前股价与公允价值的偏离程度。颜色信号一眼看清买入、持有或卖出。",
    "landing.feature3.title": "智能提醒",
    "landing.feature3.desc": "为任意指标设置自定义阈值，当达到你的目标价时，通过邮件或 Telegram 即时通知。",

    // Dashboard
    "dashboard.title": "股票估值看板",
    "dashboard.subtitle": "输入股票代码，对比多个来源的 DCF 公允价值、分析师目标价、PEG 和远期 P/E。",
    "dashboard.search.title": "输入股票代码",
    "dashboard.search.placeholder": "输入代码如 NVDA, TSM, PLTR...",
    "dashboard.search.addMore": "继续添加...",
    "dashboard.search.hint": "按回车、逗号或空格添加代码",
    "dashboard.search.analyze": "开始分析",
    "dashboard.search.loading": "加载中...",
    "dashboard.search.popular": "热门股票",
    "dashboard.search.searchLabel": "搜索股票",
    "dashboard.search.searchPlaceholder": "搜索公司名称或代码...",
    "dashboard.loading": "正在获取估值数据...",

    // Table
    "table.title": "估值概览",
    "table.stock": "股票",
    "table.price": "当前价",
    "table.dcf": "DCF 公允价值",
    "table.vsDcf": "偏离 DCF",
    "table.target": "目标价（均值）",
    "table.targetRange": "目标价范围",
    "table.vsTarget": "偏离目标价",
    "table.forwardPE": "远期 P/E",
    "table.peg": "PEG",
    "table.signal": "信号",
    "table.rec": "评级",
    "table.sourceDetails": "查看数据来源详情",
    "table.sourceBreakdown": "数据来源明细",
    "table.sources": "个来源",
    "table.analysts": "位分析师",

    // Charts
    "chart.deviation.title": "股价 vs 公允价值偏离度",
    "chart.deviation.subtitle": "负值 = 被低估（绿色），正值 = 被高估（红色）",
    "chart.deviation.label": "偏离度",
    "chart.scatter.title": "公允价值 vs 分析师目标价",
    "chart.scatter.subtitle": "对角线上方 = 分析师比 DCF 模型更看好",
    "chart.scatter.needData": "需要 DCF 公允价值和目标价数据才能显示散点图。请确认 FMP API Key 已配置。",
    "chart.gauge.title": "买入 / 持有 / 卖出 信号",
    "chart.gauge.subtitle": "综合 DCF、目标价、PEG 和分析师评级的复合评分",

    // Signals
    "signal.strongBuy": "强力买入",
    "signal.buy": "买入",
    "signal.hold": "持有",
    "signal.sell": "卖出",
    "signal.strongSell": "强力卖出",
    "signal.undervalued": "被低估",
    "signal.fair": "估值合理",
    "signal.overvalued": "被高估",

    // Alerts
    "alerts.title": "价格与估值提醒",
    "alerts.subtitle": "设置自定义触发条件，当股票达到你的目标估值时收到通知。Pro 和 Premium 订阅用户可用。",
    "alerts.create": "创建新提醒",
    "alerts.ticker": "股票代码",
    "alerts.metric": "指标",
    "alerts.condition": "条件",
    "alerts.threshold": "阈值",
    "alerts.email": "通知邮箱",
    "alerts.add": "添加提醒",
    "alerts.active": "活跃提醒",
    "alerts.none": "暂无提醒。在上方创建一个开始使用。",
    "alerts.fallsBelow": "低于",
    "alerts.risesAbove": "高于",
    "alerts.channels": "通知渠道",
    "alerts.emailChannel": "邮件",
    "alerts.emailDesc": "每日汇总 + 即时提醒发送至邮箱",
    "alerts.telegramChannel": "Telegram",
    "alerts.telegramDesc": "即时推送通知至 Telegram",
    "alerts.browserChannel": "浏览器通知",
    "alerts.browserDesc": "浏览器推送通知（无需邮箱）",
    "alerts.comingSoon": "即将推出",

    // Metrics
    "metric.currentPrice": "当前价格",
    "metric.dcfDeviation": "DCF 偏离度 %",
    "metric.targetDeviation": "目标价偏离度 %",
    "metric.forwardPE": "远期 P/E",
    "metric.pegRatio": "PEG 比率",

    // Portfolio
    "nav.portfolio": "投资组合",
    "portfolio.title": "我的投资组合",
    "portfolio.subtitle": "创建并追踪你的股票组合，下次登录可继续查看",
    "portfolio.loginRequired": "请先登录才能使用投资组合功能",
    "portfolio.goLogin": "前往登录",

    // DCF Detail
    "dcf.title": "DCF 多模型估值详情",
    "dcf.subtitle": "基于不同方法论的内在价值估算，综合参考更全面",
    "dcf.upgrade": "升级到专业版查看完整 DCF 多模型详情",

    // Target Price Detail
    "target.title": "分析师目标价详情",
    "target.subtitle": "来自多家机构的分析师预测，覆盖更广视角",
    "target.upgrade": "升级到旗舰版查看多来源分析师目标价",

    // Visualizations
    "chart.bullbear.title": "DCF 估值区间（牛/熊/基准）",
    "chart.bullbear.subtitle": "紫色虚线 = 当前价，橙色 = 保守下限，绿色 = 乐观上限",
    "chart.mos.title": "多维安全边际雷达",
    "chart.mos.subtitle": "各估值模型对应的安全边际得分（分数越高 = 被低估越多）",

    // Pricing
    "pricing.title": "简单透明的定价",
    "pricing.subtitle": "选择适合你投资工作流的方案",
    "pricing.popular": "最受欢迎",
    "pricing.free.name": "免费版",
    "pricing.free.price": "S$0",
    "pricing.free.period": "永久免费",
    "pricing.free.desc": "基础估值数据入门",
    "pricing.free.cta": "免费开始",
    "pricing.pro.name": "专业版",
    "pricing.pro.price": "S$1.99",
    "pricing.pro.period": "/月",
    "pricing.pro.desc": "一杯果汁钱，看完整 DCF 多模型",
    "pricing.pro.cta": "订阅专业版",
    "pricing.premium.name": "旗舰版",
    "pricing.premium.price": "S$5.99",
    "pricing.premium.period": "/月",
    "pricing.premium.desc": "一杯咖啡钱，解锁全部功能",
    "pricing.premium.cta": "升级旗舰版",
    "pricing.feature.summary": "估值概览表（DCF均值 + 目标价均值）",
    "pricing.feature.dcfDetail": "DCF 多模型详情（格雷厄姆、Lynch、FCF 等）",
    "pricing.feature.targetDetail": "多来源分析师目标价详情",
    "pricing.feature.portfolio1": "1 个投资组合（最多10只股票）",
    "pricing.feature.portfolio3": "3 个投资组合（最多20只股票）",
    "pricing.feature.portfolioUnlimited": "10 个投资组合（最多50只股票）",
    "pricing.feature.basicChart": "基础偏离度图表",
    "pricing.feature.allCharts": "全部图表（雷达图、牛熊区间、安全边际）",
    "pricing.feature.alerts5": "5 个邮件提醒",
    "pricing.feature.alertsUnlimited": "无限提醒（邮件 + Telegram）",
    "pricing.feature.alphaVantage": "Alpha Vantage 多源数据",
    "pricing.feature.export": "CSV 数据导出",
    "pricing.feature.support": "优先客服支持",
    "pricing.feature.community": "社区交流",
    "pricing.faq.title": "常见问题",
    "pricing.faq.q1": "数据来自哪里？",
    "pricing.faq.a1": "我们聚合来自 Yahoo Finance、Alpha Vantage 和 FMP 的数据，并自动计算格雷厄姆数字、Lynch 公允价值、FCF DCF 等多种估值模型。",
    "pricing.faq.q2": "可以随时取消吗？",
    "pricing.faq.a2": "当然！所有订阅均为月度付费，无合同约束。随时可在账户设置中取消。",
    "pricing.faq.q3": "免费版和付费版的主要区别？",
    "pricing.faq.a3": "免费版只显示综合概览（均值）。专业版（S$1.99）额外显示 DCF 多模型明细，帮你理解每个估值背后的逻辑。旗舰版（S$5.99）进一步提供分析师目标价多源对比、高级图表和多组合管理。",
    "pricing.faq.q4": "有哪些通知方式？",
    "pricing.faq.a4": "专业版用户可收到邮件提醒。旗舰版用户还可通过 Telegram 接收即时通知。",

    // Login
    "login.create": "创建账户",
    "login.welcome": "欢迎回来",
    "login.name": "姓名",
    "login.email": "邮箱",
    "login.password": "密码",
    "login.signup": "注册",
    "login.signin": "登录",
    "login.hasAccount": "已有账户？",
    "login.noAccount": "没有账户？",
    "login.waiting": "请稍候...",
    "login.invalidCredentials": "邮箱或密码错误",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.alerts": "Alerts",
    "nav.pricing": "Pricing",
    "nav.login": "Login",
    "nav.language": "中文",

    "landing.title1": "Smarter Stock Valuation",
    "landing.title2": "for Value Investors",
    "landing.subtitle": "Compare DCF fair values, analyst target prices, PEG ratios, and forward P/E from multiple institutions — all in one dashboard. Make smarter buy/hold/sell decisions.",
    "landing.cta": "Start Analyzing",
    "landing.pricing": "View Pricing",
    "landing.feature1.title": "Multi-Source Data",
    "landing.feature1.desc": "Aggregate DCF valuations, analyst targets, and key ratios from Yahoo Finance, FMP, and more. See the complete picture.",
    "landing.feature2.title": "Visual Insights",
    "landing.feature2.desc": "Interactive charts show how current price deviates from fair value. Color-coded signals tell you Buy, Hold, or Sell at a glance.",
    "landing.feature3.title": "Smart Alerts",
    "landing.feature3.desc": "Set custom thresholds for any metric. Get notified via email or Telegram when it's time to act.",

    "dashboard.title": "Stock Valuation Dashboard",
    "dashboard.subtitle": "Enter stock tickers to compare DCF fair values, analyst targets, PEG ratios, and forward P/E from multiple sources.",
    "dashboard.search.title": "Enter Stock Tickers",
    "dashboard.search.placeholder": "Enter tickers like NVDA, TSM, PLTR...",
    "dashboard.search.addMore": "Add more...",
    "dashboard.search.hint": "Press Enter, comma, or space to add tickers",
    "dashboard.search.analyze": "Analyze",
    "dashboard.search.loading": "Loading...",
    "dashboard.search.popular": "Popular Stocks",
    "dashboard.search.searchLabel": "Search Stocks",
    "dashboard.search.searchPlaceholder": "Search company name or ticker...",
    "dashboard.loading": "Fetching valuation data...",

    "table.title": "Valuation Overview",
    "table.stock": "Stock",
    "table.price": "Price",
    "table.dcf": "DCF Fair Value",
    "table.vsDcf": "vs DCF",
    "table.target": "Target (Avg)",
    "table.targetRange": "Target Range",
    "table.vsTarget": "vs Target",
    "table.forwardPE": "Fwd P/E",
    "table.peg": "PEG",
    "table.signal": "Signal",
    "table.rec": "Rating",
    "table.sourceDetails": "View source details",
    "table.sourceBreakdown": "Source Breakdown",
    "table.sources": "source(s)",
    "table.analysts": "analysts",

    "chart.deviation.title": "Price vs Fair Value Deviation",
    "chart.deviation.subtitle": "Negative = undervalued (green), Positive = overvalued (red)",
    "chart.deviation.label": "Deviation",
    "chart.scatter.title": "Fair Value vs Target Price",
    "chart.scatter.subtitle": "Above diagonal = analysts more bullish than DCF suggests",
    "chart.scatter.needData": "Need both DCF fair value and target price data. Ensure FMP API key is configured.",
    "chart.gauge.title": "Buy / Hold / Sell Signal",
    "chart.gauge.subtitle": "Composite score combining DCF, target price, PEG, and analyst recommendation",

    "signal.strongBuy": "Strong Buy",
    "signal.buy": "Buy",
    "signal.hold": "Hold",
    "signal.sell": "Sell",
    "signal.strongSell": "Strong Sell",
    "signal.undervalued": "Undervalued",
    "signal.fair": "Fair",
    "signal.overvalued": "Overvalued",

    "alerts.title": "Price & Valuation Alerts",
    "alerts.subtitle": "Set custom triggers to get notified when stocks hit your target valuations. Available for Pro and Premium subscribers.",
    "alerts.create": "Create New Alert",
    "alerts.ticker": "Ticker",
    "alerts.metric": "Metric",
    "alerts.condition": "Condition",
    "alerts.threshold": "Threshold",
    "alerts.email": "Notification Email",
    "alerts.add": "Add Alert",
    "alerts.active": "Active Alerts",
    "alerts.none": "No alerts yet. Create one above to get started.",
    "alerts.fallsBelow": "Falls below",
    "alerts.risesAbove": "Rises above",
    "alerts.channels": "Notification Channels",
    "alerts.emailChannel": "Email",
    "alerts.emailDesc": "Daily summary + instant alerts to your inbox",
    "alerts.telegramChannel": "Telegram",
    "alerts.telegramDesc": "Instant push notifications to your Telegram",
    "alerts.browserChannel": "Browser",
    "alerts.browserDesc": "Browser push notifications (no email needed)",
    "alerts.comingSoon": "Coming Soon",

    "metric.currentPrice": "Current Price",
    "metric.dcfDeviation": "DCF Deviation %",
    "metric.targetDeviation": "Target Deviation %",
    "metric.forwardPE": "Forward P/E",
    "metric.pegRatio": "PEG Ratio",

    // Portfolio (EN)
    "nav.portfolio": "Portfolio",
    "portfolio.title": "My Portfolios",
    "portfolio.subtitle": "Create and track your stock portfolios — saved across sessions",
    "portfolio.loginRequired": "Please log in to use the portfolio feature",
    "portfolio.goLogin": "Go to Login",

    // DCF Detail (EN)
    "dcf.title": "DCF Multi-Model Valuation",
    "dcf.subtitle": "Intrinsic value estimates across different methodologies",
    "dcf.upgrade": "Upgrade to Pro to see full DCF multi-model details",

    // Target Price Detail (EN)
    "target.title": "Analyst Target Price Details",
    "target.subtitle": "Forecasts from multiple institutions for a broader perspective",
    "target.upgrade": "Upgrade to Premium to see multi-source analyst targets",

    // Visualizations (EN)
    "chart.bullbear.title": "DCF Valuation Range (Bull/Bear/Base)",
    "chart.bullbear.subtitle": "Purple dashed = current price, orange = bear, green = bull",
    "chart.mos.title": "Multi-Metric Margin of Safety Radar",
    "chart.mos.subtitle": "MoS score per model (higher = more undervalued)",

    // Pricing (EN)
    "pricing.title": "Simple, transparent pricing",
    "pricing.subtitle": "Choose the plan that fits your investment workflow",
    "pricing.popular": "MOST POPULAR",
    "pricing.free.name": "Free",
    "pricing.free.price": "S$0",
    "pricing.free.period": "forever",
    "pricing.free.desc": "Get started with basic valuation data",
    "pricing.free.cta": "Get Started",
    "pricing.pro.name": "Pro",
    "pricing.pro.price": "S$1.99",
    "pricing.pro.period": "/month",
    "pricing.pro.desc": "Price of a juice — full DCF multi-model breakdown",
    "pricing.pro.cta": "Subscribe Pro",
    "pricing.premium.name": "Premium",
    "pricing.premium.price": "S$5.99",
    "pricing.premium.period": "/month",
    "pricing.premium.desc": "Price of a coffee — unlock everything",
    "pricing.premium.cta": "Go Premium",
    "pricing.feature.summary": "Valuation overview (DCF avg + target avg)",
    "pricing.feature.dcfDetail": "DCF multi-model details (Graham, Lynch, FCF...)",
    "pricing.feature.targetDetail": "Multi-source analyst target price breakdown",
    "pricing.feature.portfolio1": "1 portfolio (up to 10 stocks)",
    "pricing.feature.portfolio3": "3 portfolios (up to 20 stocks)",
    "pricing.feature.portfolioUnlimited": "10 portfolios (up to 50 stocks)",
    "pricing.feature.basicChart": "Basic deviation chart",
    "pricing.feature.allCharts": "All charts (radar, bull/bear, margin of safety)",
    "pricing.feature.alerts5": "5 email alerts",
    "pricing.feature.alertsUnlimited": "Unlimited alerts (email + Telegram)",
    "pricing.feature.alphaVantage": "Alpha Vantage multi-source data",
    "pricing.feature.export": "CSV data export",
    "pricing.feature.support": "Priority support",
    "pricing.feature.community": "Community access",
    "pricing.faq.title": "Frequently Asked Questions",
    "pricing.faq.q1": "Where does the data come from?",
    "pricing.faq.a1": "We aggregate data from Yahoo Finance, Alpha Vantage, and FMP, and automatically compute Graham Number, Lynch fair value, FCF DCF, and more.",
    "pricing.faq.q2": "Can I cancel anytime?",
    "pricing.faq.a2": "Yes! All subscriptions are month-to-month with no contracts. Cancel anytime from your account settings.",
    "pricing.faq.q3": "What's the difference between plans?",
    "pricing.faq.a3": "Free shows summary averages. Pro (S$1.99) adds full DCF multi-model details so you understand each valuation's logic. Premium (S$5.99) adds multi-source analyst targets, advanced charts, and portfolio management.",
    "pricing.faq.q4": "What notification options are available?",
    "pricing.faq.a4": "Pro users get email alerts. Premium users can also receive Telegram notifications for instant alerts.",

    "login.create": "Create Account",
    "login.welcome": "Welcome Back",
    "login.name": "Name",
    "login.email": "Email",
    "login.password": "Password",
    "login.signup": "Sign Up",
    "login.signin": "Sign In",
    "login.hasAccount": "Already have an account?",
    "login.noAccount": "Don't have an account?",
    "login.waiting": "Please wait...",
    "login.invalidCredentials": "Invalid email or password",
  },
} as const;

type TranslationKey = keyof (typeof translations)["zh"];

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "zh",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[locale][key] || translations["zh"][key] || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
