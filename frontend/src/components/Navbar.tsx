"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/alerts", label: t("nav.alerts") },
    { href: "/pricing", label: t("nav.pricing") },
  ];

  return (
    <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">ValueInvest</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              className="ml-2 text-xs font-medium"
            >
              {t("nav.language")}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
