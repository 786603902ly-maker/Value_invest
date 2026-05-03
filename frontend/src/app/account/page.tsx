"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useI18n, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserIcon, CrownIcon, LogOutIcon, GlobeIcon,
  CreditCardIcon, ShieldIcon, CalendarIcon,
} from "lucide-react";
import Link from "next/link";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  isPro: boolean;
  hasSubscription: boolean;
  createdAt: string;
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const zh = locale === "zh";

  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/account");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/me")
      .then((r) => r.json())
      .then((data) => { if (data.id) setUser(data); })
      .finally(() => setLoading(false));
  }, [session?.user]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
        setPortalLoading(false);
      }
    } catch {
      alert(zh ? "无法打开管理页面" : "Failed to open billing portal");
      setPortalLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session || !user) return null;

  const joinDate = new Date(user.createdAt).toLocaleDateString(
    zh ? "zh-CN" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">{zh ? "账户设置" : "Account Settings"}</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            {zh ? "个人信息" : "Profile"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{zh ? "姓名" : "Name"}</p>
              <p className="font-medium">{user.name || (zh ? "未设置" : "Not set")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{zh ? "邮箱" : "Email"}</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{zh ? "注册日期" : "Joined"}</p>
              <p className="font-medium flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {joinDate}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{zh ? "当前方案" : "Plan"}</p>
              <div className="flex items-center gap-2">
                {user.isPro ? (
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <CrownIcon className="h-3 w-3" />
                    Pro
                  </Badge>
                ) : (
                  <Badge variant="secondary">{zh ? "免费版" : "Free"}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCardIcon className="h-5 w-5" />
            {zh ? "订阅管理" : "Subscription"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.isPro ? (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <CrownIcon className="h-4 w-4 text-primary" />
                    {zh ? "专业版会员" : "Pro Member"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {zh
                      ? "你已解锁全部 DCF 多模型详情、高级图表和无限提醒。"
                      : "Full access to DCF multi-model details, advanced charts, and unlimited alerts."}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={openPortal}
                  disabled={portalLoading || !user.hasSubscription}
                  className="gap-2"
                >
                  <ShieldIcon className="h-4 w-4" />
                  {portalLoading
                    ? (zh ? "跳转中..." : "Redirecting...")
                    : (zh ? "管理订阅 / 退订" : "Manage / Cancel Subscription")}
                </Button>
              </div>
              {!user.hasSubscription && (
                <p className="text-xs text-muted-foreground">
                  {zh
                    ? "你的 Pro 权限可能由管理员手动开启，如需修改订阅请联系我们。"
                    : "Your Pro access may have been granted manually. Contact us to manage it."}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4 space-y-4">
              <p className="text-muted-foreground">
                {zh
                  ? "升级到专业版，解锁 DCF 多模型估值、高级图表和无限价格提醒。"
                  : "Upgrade to Pro to unlock DCF multi-model valuation, advanced charts, and unlimited alerts."}
              </p>
              <Link href="/pricing">
                <Button className="gap-2">
                  <CrownIcon className="h-4 w-4" />
                  {zh ? "升级到 Pro — S$1.99/月" : "Upgrade to Pro — S$1.99/mo"}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GlobeIcon className="h-5 w-5" />
            {zh ? "语言设置" : "Language"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {(["zh", "en"] as Locale[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  locale === lang
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-accent"
                }`}
              >
                {lang === "zh" ? "中文" : "English"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {zh
              ? "语言偏好会自动保存在浏览器中。"
              : "Your language preference is saved in your browser."}
          </p>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card>
        <CardContent className="py-4">
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOutIcon className="h-4 w-4" />
            {zh ? "退出登录" : "Sign Out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
