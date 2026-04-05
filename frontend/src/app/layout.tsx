import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "ValueInvest - 智能股票估值 | Smart Stock Valuation",
  description: "汇聚多家机构的 DCF 公允价值、分析师目标价、PEG 比率和远期 P/E，一站式辅助价值投资决策。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
