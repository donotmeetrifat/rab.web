import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Users,
  Eye as PageviewsIcon,
  Calendar,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  RefreshCw,
  LogOut,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Compass,
} from "lucide-react";
import type { VisitorStats } from "@/lib/server-analytics";

export const Route = createFileRoute("/admin")({
  component: AdminAnalyticsPage,
});

const TOKEN_STORAGE_KEY = "rab_admin_token";

function toBengaliNumber(num: number): string {
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num
    .toString()
    .replace(/\d/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

function AdminAnalyticsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Fetch stats using token
  const fetchStats = useCallback(async (authToken: string) => {
    setIsLoadingStats(true);
    try {
      const res = await fetch("/api/admin-stats", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setAuthError("সেশনের মেয়াদ শেষ হয়ে গেছে। দয়া করে আবার লগইন করুন।");
        }
        return;
      }

      const data = (await res.json()) as { ok: boolean; stats: VisitorStats };
      if (data.ok && data.stats) {
        setStats(data.stats);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Check stored session on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetchStats(savedToken);
    }
    setIsCheckingAuth(false);
  }, [fetchStats]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setAuthError("অনুগ্রহ করে পাসওয়ার্ডটি লিখুন।");
      return;
    }

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        token?: string;
        error?: string;
        remainingAttempts?: number;
      };

      if (!res.ok || !data.ok || !data.token) {
        setAuthError(data.error || "ভুল পাসওয়ার্ড! প্রবেশাধিকার নেই।");
        return;
      }

      // Login success
      sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setToken(data.token);
      setPasswordInput("");
      fetchStats(data.token);
    } catch {
      setAuthError("সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setStats(null);
    setAuthError(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  // 1. LOCKED LOGIN SCREEN
  if (!token) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans selection:bg-primary/20">
        <div className="max-w-md w-full mx-auto my-auto pt-8 pb-12">
          {/* Back to Home link */}
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>মূল ওয়েবসাইটে ফিরে যান</span>
            </Link>
          </div>

          {/* Login Card */}
          <div className="relative rounded-3xl border border-primary/25 bg-[color:var(--surface)] p-6 sm:p-8 shadow-2xl overflow-hidden">
            {/* Top Emerald Ambient Glow */}
            <div
              className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-teal-500/15 blur-3xl"
              aria-hidden="true"
            />

            {/* Header */}
            <div className="text-center mb-7 relative">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-primary/30 text-primary shadow-sm mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                অ্যাডমিন ভেরিফিকেশন
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
                রিয়েল ভিজিটর অ্যানালিটিক্স দেখতে অ্যাডমিন পাসওয়ার্ড দিন
              </p>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{authError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4 relative">
              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-foreground mb-1.5"
                >
                  অ্যাডমিন পাসওয়ার্ড
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="পাসওয়ার্ড লিখুন..."
                    autoFocus
                    required
                    className="w-full rounded-xl border border-border bg-background pl-10 pr-11 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full min-h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>ভেরিফাই হচ্ছে...</span>
                  </>
                ) : (
                  <span>ড্যাশবোর্ডে প্রবেশ করুন</span>
                )}
              </button>
            </form>

            {/* Security Guarantee Note */}
            <div className="mt-6 pt-5 border-t border-border/60 text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                🔒 <strong>এনক্রিপ্টেড ও সম্পূর্ণ নিরাপদ:</strong> পাসওয়ার্ডটি সার্ভার-সাইডে ক্রিপ্টোগ্রাফিকভাবে যাচাই করা হয়। সঠিক পাসওয়ার্ড ছাড়া কোনো ভিজিটর ডেটা সার্ভার থেকে প্রদান করা হয় না।
              </p>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Railway Auto-Booker · সিকিউর অ্যাডমিন সিস্টেম
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATED DASHBOARD
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 pb-16">
      {/* Top Admin Sticky Navbar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md px-4 sm:px-6 md:px-8 py-3.5">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 group hover:opacity-90 transition-opacity"
            >
              <img
                src="/railway-icon.png"
                alt="Railway Auto-Booker"
                className="h-8 w-8 rounded-lg object-cover border border-primary/20 shadow-xs"
              />
              <span className="font-bold text-base sm:text-lg tracking-tight text-foreground">
                Railway <span className="text-primary">Auto-Booker</span>
              </span>
            </Link>
            <span className="hidden sm:inline-flex rounded-md bg-primary/10 border border-primary/25 px-2 py-0.5 text-xs font-bold text-primary">
              অ্যাডমিন পোর্টাল
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Indicator */}
            <div className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>রিয়েল ট্র্যাকিং সক্রিয়</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => token && fetchStats(token)}
              disabled={isLoadingStats}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="নতুন ভিজিটর ডেটা রিফ্রেশ করুন"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${
                  isLoadingStats ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">রিফ্রেশ</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Page Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <span>রিয়েল-টাইম ভিজিটর অ্যানালিটিক্স</span>
              <Activity className="h-6 w-6 text-primary" />
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              ওয়েবসাইটে ভিজিট করা প্রকৃত ভিজিটরদের সঠিক সংখ্যা (কোনো ফেক বা স্যাম্পল ডেটা নয়)
            </p>
          </div>

          {lastRefreshed && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 self-start sm:self-auto">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>
                সর্বশেষ আপডেট:{" "}
                {lastRefreshed.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* 4 Primary KPI Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total Unique Visitors */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-emerald-500/10 via-[color:var(--surface)] to-[color:var(--surface)] p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                ইউনিক ভিজিটর
              </span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-sans">
              {stats ? toBengaliNumber(stats.uniqueVisitors) : "০"}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              মোট ভিন্ন ভিন্ন প্রকৃত মানুষ
            </p>
          </div>

          {/* Card 2: Total Pageviews */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                মোট পেজভিউ
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <PageviewsIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-sans">
              {stats ? toBengaliNumber(stats.totalVisits) : "০"}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              ওয়েবসাইটে মোট ভিজিট ও রিফ্রেশ
            </p>
          </div>

          {/* Card 3: Today's Unique Visitors */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                আজকের ভিজিটর
              </span>
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-sans">
              {stats ? toBengaliNumber(stats.todayUnique) : "০"}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              আজকে আসা নতুন ইউনিক ভিজিটর
            </p>
          </div>

          {/* Card 4: Today's Pageviews */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-4 sm:p-5 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                আজকের পেজভিউ
              </span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground font-sans">
              {stats ? toBengaliNumber(stats.todayVisits) : "০"}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              আজকে সর্বমোট দেখা হয়েছে
            </p>
          </div>
        </div>

        {/* Section: Devices & Browsers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Box 1: Device Breakdown */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>ডিভাইস বিভাজন (Devices)</span>
            </h3>

            {stats && (
              <div className="space-y-3.5">
                {/* Mobile */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                      <span>মোবাইল (Mobile)</span>
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {toBengaliNumber(stats.devices.mobile || 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalVisits > 0
                            ? Math.round(
                                ((stats.devices.mobile || 0) / stats.totalVisits) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Desktop */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Laptop className="h-3.5 w-3.5 text-blue-500" />
                      <span>কম্পিউটার (Desktop/PC)</span>
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {toBengaliNumber(stats.devices.desktop || 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalVisits > 0
                            ? Math.round(
                                ((stats.devices.desktop || 0) / stats.totalVisits) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Tablet */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Tablet className="h-3.5 w-3.5 text-amber-500" />
                      <span>ট্যাবলেট (Tablet)</span>
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {toBengaliNumber(stats.devices.tablet || 0)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalVisits > 0
                            ? Math.round(
                                ((stats.devices.tablet || 0) / stats.totalVisits) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Box 2: Browser Breakdown */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              <span>ব্রাউজার তালিকা (Browsers)</span>
            </h3>

            {stats && Object.keys(stats.browsers).length > 0 ? (
              <div className="space-y-2.5">
                {Object.entries(stats.browsers)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, count]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                    >
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="font-bold text-primary font-mono">
                        {toBengaliNumber(count)} বার
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                এখনো কোনো ভিজিটর রেকর্ড নেই।
              </p>
            )}
          </div>

          {/* Box 3: Locations */}
          <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>অবস্থান ও অঞ্চল (Locations)</span>
            </h3>

            {stats && Object.keys(stats.cities).length > 0 ? (
              <div className="space-y-2.5">
                {Object.entries(stats.cities)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 7)
                  .map(([city, count]) => (
                    <div
                      key={city}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                    >
                      <span className="font-medium text-foreground">
                        📍 {city}
                      </span>
                      <span className="font-bold text-foreground font-mono">
                        {toBengaliNumber(count)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                এখনো লোকেশন ডেটা রেকর্ড হয়নি।
              </p>
            )}
          </div>
        </div>

        {/* Section: Recent Live Visitors Activity Table */}
        <div className="rounded-2xl border border-border bg-[color:var(--surface)] p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>সর্বশেষ ভিজিটদের লাইভ লগ (Recent Visitor Log)</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                  রিয়েল টাইম
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                কোনো ডামি ডেটা নয় — প্রতিটি ভিজিট হওয়া মাত্রই এখানে স্বয়ংক্রিয়ভাবে রেকর্ড হয়
              </p>
            </div>
          </div>

          {stats && stats.recentLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="pb-3 font-semibold">ভিজিটর ধরন</th>
                    <th className="pb-3 font-semibold">ডিভাইস</th>
                    <th className="pb-3 font-semibold">ব্রাউজার ও ওএস</th>
                    <th className="pb-3 font-semibold">লোকেশন</th>
                    <th className="pb-3 font-semibold text-right">সময় (BST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {stats.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5">
                        {log.isUnique ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>নতুন ইউনিক</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <span>রিটার্নিং</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 font-medium text-foreground capitalize">
                        {log.device === "mobile" && "📱 মোবাইল"}
                        {log.device === "desktop" && "💻 কম্পিউটার"}
                        {log.device === "tablet" && "📟 ট্যাবলেট"}
                      </td>
                      <td className="py-2.5 text-foreground">
                        {log.browser} ({log.os})
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {log.city}, {log.country}
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">
                        {log.timeFormatted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-xs sm:text-sm">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p>এখনো কোনো ভিজিট সম্পন্ন হয়নি। নতুন কোনো ভিজিটর ওয়েবসাইট ভিজিট করলে সাথে সাথে এখানে যোগ হবে।</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
