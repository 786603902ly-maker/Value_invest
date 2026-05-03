"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserIcon, LogOutIcon, CrownIcon, SettingsIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { t, locale, setLocale } = useI18n();
  const zh = locale === "zh";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const userTier = (session?.user as { tier?: string })?.tier ?? "free";
  const isPro = userTier === "pro" || userTier === "premium";

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navItems = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/portfolio", label: t("nav.portfolio") },
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
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Language toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              className="ml-1 text-xs font-medium"
            >
              {t("nav.language")}
            </Button>

            {/* Auth section */}
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse ml-2" />
            ) : session?.user ? (
              // Logged-in user menu
              <div className="relative ml-2" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-accent transition-colors"
                >
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium max-w-[100px] truncate">
                    {session.user.name || session.user.email?.split("@")[0]}
                  </span>
                  {isPro && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                      <CrownIcon className="h-2.5 w-2.5 mr-0.5" />
                      Pro
                    </Badge>
                  )}
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-popover border rounded-xl shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b">
                      <p className="text-xs font-medium truncate">{session.user.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isPro
                          ? (zh ? "专业版会员" : "Pro Member")
                          : (zh ? "免费版" : "Free Plan")}
                      </p>
                    </div>

                    {!isPro && (
                      <Link
                        href="/pricing"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent transition-colors"
                      >
                        <CrownIcon className="h-4 w-4" />
                        {zh ? "升级到 Pro — S$1.99/月" : "Upgrade to Pro — S$1.99/mo"}
                      </Link>
                    )}

                    <Link
                      href="/portfolio"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      {zh ? "我的投资组合" : "My Portfolios"}
                    </Link>

                    <Link
                      href="/account"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <SettingsIcon className="h-4 w-4" />
                      {zh ? "账户设置" : "Account Settings"}
                    </Link>

                    <button
                      onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      {zh ? "退出登录" : "Sign Out"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Not logged in
              <Link href="/login" className="ml-2">
                <Button size="sm" variant="outline" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  {t("nav.login")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
