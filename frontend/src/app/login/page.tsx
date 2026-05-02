"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangleIcon, ExternalLinkIcon, CopyIcon, CheckIcon } from "lucide-react";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function detectInAppBrowser(): { isInApp: boolean; name: string } {
  if (typeof window === "undefined") return { isInApp: false, name: "" };
  const ua = navigator.userAgent;
  if (/MicroMessenger/i.test(ua)) return { isInApp: true, name: "微信" };
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return { isInApp: true, name: "Facebook" };
  if (/Instagram/i.test(ua)) return { isInApp: true, name: "Instagram" };
  if (/Line\//i.test(ua)) return { isInApp: true, name: "LINE" };
  if (/TikTok/i.test(ua)) return { isInApp: true, name: "TikTok" };
  if (/Twitter/i.test(ua)) return { isInApp: true, name: "Twitter" };
  if (/Telegram/i.test(ua)) return { isInApp: true, name: "Telegram" };
  // Generic Android WebView
  if (/wv\)/i.test(ua) && /Android/i.test(ua)) return { isInApp: true, name: "App 内置浏览器" };
  return { isInApp: false, name: "" };
}

function InAppBrowserWarning({ appName, zh }: { appName: string; zh: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "https://value-invest.vercel.app/login";

  const copyUrl = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
            {zh ? `请在浏览器中打开` : `Open in your browser`}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
            {zh
              ? `你正在 ${appName} 内置浏览器中访问，Google 不允许在此环境中登录。请复制链接，用 Chrome 或 Safari 打开后再登录。`
              : `You're in ${appName}'s in-app browser. Google doesn't allow sign-in here. Copy the link and open it in Chrome or Safari.`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 gap-1.5 border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
          onClick={copyUrl}
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? (zh ? "已复制！" : "Copied!") : (zh ? "复制链接" : "Copy Link")}
        </Button>
        <a
          href={`googlechrome://navigate?url=${encodeURIComponent(url)}`}
          className="flex-1"
        >
          <Button
            size="sm"
            className="w-full h-9 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            {zh ? "用 Chrome 打开" : "Open in Chrome"}
          </Button>
        </a>
      </div>
      <p className="text-[11px] text-amber-600 dark:text-amber-500">
        {zh
          ? "💡 仍可使用下方邮箱/密码登录（不依赖 Google）"
          : "💡 You can still use email/password login below (no Google required)"}
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const [isSignUp, setIsSignUp] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inAppInfo, setInAppInfo] = useState<{ isInApp: boolean; name: string }>({ isInApp: false, name: "" });

  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    setInAppInfo(detectInAppBrowser());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
      name: form.name,
      action: isSignUp ? "signup" : "login",
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error === "CredentialsSignin" ? t("login.invalidCredentials") : result.error);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isSignUp ? t("login.create") : t("login.welcome")}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {zh
              ? "登录后即可使用投资组合和 Pro 功能"
              : "Sign in to access your portfolios and Pro features"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* In-app browser warning */}
          {inAppInfo.isInApp && (
            <InAppBrowserWarning appName={inAppInfo.name} zh={zh} />
          )}

          {/* Google OAuth button */}
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center gap-3 h-11"
            onClick={handleGoogle}
            disabled={googleLoading || inAppInfo.isInApp}
          >
            <GoogleIcon />
            <span>
              {googleLoading
                ? zh ? "跳转中..." : "Redirecting..."
                : inAppInfo.isInApp
                ? zh ? "请用浏览器打开后使用 Google 登录" : "Open in browser to use Google"
                : zh ? "使用 Google 账号登录" : "Continue with Google"}
            </span>
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {zh ? "或使用邮箱" : "or use email"}
              </span>
            </div>
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm text-muted-foreground mb-1">{t("login.name")}</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("login.name")}
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t("login.email")}</label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{t("login.password")}</label>
              <Input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={zh ? "最少 6 位" : "Min 6 characters"}
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("login.waiting") : isSignUp ? t("login.signup") : t("login.signin")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? t("login.hasAccount") : t("login.noAccount")}{" "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-primary hover:text-primary/80 font-medium"
            >
              {isSignUp ? t("login.signin") : t("login.signup")}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh]" />}>
      <LoginForm />
    </Suspense>
  );
}
