import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
  Menu,
  MessageCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Train,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button3D, button3dClass } from "@/components/ui/button-3d";

export const Route = createFileRoute("/")({
  component: RailwayAutoBookerLandingPage,
});

/** Shared focus-ring class — visible only on keyboard focus. */
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Default Contact URLs (Placeholders for user to update) */
const WHATSAPP_NUMBER = "8801XXXXXXXXX"; // User can replace with their WhatsApp number
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello! I want to buy the Bangladesh Railway Auto-Booker subscription.")}`;
const FACEBOOK_LINK = "https://facebook.com/"; // User can replace with their Facebook profile / page link

function BrandWordmark({
  className = "",
  iconSize = "h-7 w-7",
  textSize = "text-xl",
}: {
  className?: string;
  iconSize?: string;
  textSize?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 leading-none select-none ${className}`}>
      <img
        src="/railway-icon.png"
        alt="Railway Auto-Booker Logo"
        className={`${iconSize} rounded-[8px] object-cover shrink-0 shadow-xs border border-primary/20`}
      />
      <div className="flex flex-col">
        <span className={`font-bold tracking-tight text-foreground ${textSize}`}>
          Railway <span className="text-primary">Auto-Booker</span>
        </span>
        <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
          By Rifat · v4.0 Pro
        </span>
      </div>
    </span>
  );
}

function WhatsAppIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.301-.15-1.782-.879-2.058-.98-.276-.1-.477-.15-.678.15-.2.301-.778.98-.954 1.18-.175.201-.351.226-.652.076-.301-.15-1.272-.469-2.423-1.496-.896-.8-1.5-1.788-1.676-2.089-.175-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.527-.075-.15-.678-1.631-.929-2.233-.244-.586-.493-.507-.678-.516-.175-.01-.376-.01-.577-.01-.201 0-.527.075-.803.376-.276.301-1.054 1.03-1.054 2.511 0 1.482 1.079 2.911 1.229 3.112.15.201 2.124 3.243 5.146 4.549.719.311 1.281.497 1.719.636.722.23 1.378.197 1.898.12.579-.087 1.782-.728 2.032-1.431.251-.703.251-1.305.176-1.431-.076-.126-.276-.201-.577-.351zM12.04 2c-5.513 0-9.988 4.475-9.988 9.988 0 1.761.46 3.483 1.334 5.002L2 22l5.174-1.357a9.948 9.948 0 004.866 1.266h.004c5.513 0 9.988-4.475 9.988-9.988A9.99 9.99 0 0012.04 2zm0 18.283h-.003a8.27 8.27 0 01-4.218-1.156l-.302-.18-3.136.823.837-3.056-.197-.314a8.257 8.257 0 01-1.268-4.397c0-4.57 3.718-8.288 8.289-8.288a8.26 8.26 0 015.86 2.428 8.257 8.257 0 012.427 5.86c0 4.572-3.718 8.29-8.289 8.29z" />
    </svg>
  );
}

function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const TOP_ROUTES = [
  { from: "Dhaka", to: "Chittagong", train: "Suborno / Sonar Bangla" },
  { from: "Dhaka", to: "Cox's Bazar", train: "Cox's Bazar / Tourist Exp" },
  { from: "Dhaka", to: "Sylhet", train: "Parabat / Upaban Express" },
  { from: "Dhaka", to: "Rajshahi", train: "Silkcity / Padma Express" },
  { from: "Dhaka", to: "Khulna", train: "Sundarban / Chitra Express" },
];

const SEAT_CLASSES = ["Snigdha (AC)", "AC_B (Berth)", "S_CHAIR", "AC_S (Seat)", "Shovon"];

const FEATURES = [
  {
    icon: Zap,
    title: "8:00 AM Millisecond Rush Trigger",
    body: "Synchronizes directly with official server time. Searches and selects seats the exact millisecond tickets unlock at 8:00 AM or 2:00 PM.",
  },
  {
    icon: Train,
    title: "Smart Seat & Coach Selector",
    body: "Specify your desired class, favorite bogie (coach), and seat number range (1–40). Auto-selects consecutive seats for families in seconds.",
  },
  {
    icon: Clock,
    title: "Auto OTP & Instant Checkout Handoff",
    body: "Auto-fills passenger details and jumps straight to the payment gateway (bKash, Nagad, Rocket, or Card) without hesitation.",
  },
  {
    icon: ShieldCheck,
    title: "100% Local, Private & Secure",
    body: "Runs purely on your local browser. No passwords, personal data, or payment tokens are ever sent to third-party servers. Zero logs.",
  },
  {
    icon: RotateCcw,
    title: "Multi-Train & Route Fallbacks",
    body: "If your top train is sold out within 100 milliseconds, the auto-booker instantly flips to your secondary train choice without missing a beat.",
  },
  {
    icon: Sparkles,
    title: "Anti-Ban & Humanized Micro-Delays",
    body: "Engineered with intelligent delay distribution that mimics high-speed human interaction, avoiding server rate limits and IP blocks.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Get Extension & Unzip",
    desc: "Contact us via WhatsApp or Facebook to receive the latest v4.0 extension ZIP file, then extract it to a folder on your computer.",
  },
  {
    step: "2",
    title: "Open Chrome Extensions",
    desc: "In your Chrome, Edge, Brave, or Opera browser, go to chrome://extensions in the address bar.",
  },
  {
    step: "3",
    title: "Enable Developer Mode",
    desc: "Turn ON the 'Developer mode' toggle located at the top-right corner of the Extensions page.",
  },
  {
    step: "4",
    title: "Click 'Load Unpacked'",
    desc: "Click the 'Load unpacked' button at the top-left and select the unzipped folder. You're ready to auto-book!",
  },
];

const PRICING_PLANS = [
  {
    id: "monthly",
    name: "1 Month Pass",
    badge: "Quick Trip",
    isPopular: false,
    price: "৳ 499",
    period: "for 30 Days",
    description: "Ideal for travelers planning single journeys or holiday vacation tickets.",
    features: [
      "1 Browser / PC License",
      "8:00 AM & 2:00 PM Rush Auto-Booking",
      "All Bangladesh Railway Routes & Trains",
      "Class & Seat Range Preference",
      "Auto-fill Passenger Details",
      "WhatsApp Setup Guidance",
    ],
  },
  {
    id: "seasonal",
    name: "Seasonal / Eid Special",
    badge: "Most Popular · Eid Rush",
    isPopular: true,
    price: "৳ 999",
    period: "for 3 Months (Full Season)",
    description: "The top choice for regular commuters, family trips, and high-demand Eid rushes.",
    features: [
      "Up to 2 Devices Supported",
      "High-Priority Millisecond Search Engine",
      "Multi-Train Fallback Queuing",
      "Consecutive Family Seat Auto-Lock",
      "VIP 1-on-1 Remote Setup (AnyDesk)",
      "Instant Updates for Railway Portal Changes",
      "Priority WhatsApp & Facebook Support",
    ],
  },
  {
    id: "lifetime",
    name: "Lifetime VIP Pro",
    badge: "Maximum Value",
    isPopular: false,
    price: "৳ 1,999",
    period: "One-Time · Lifetime Access",
    description: "For frequent commuters, business executives, and power users who travel year-round.",
    features: [
      "Unlimited Device Activations",
      "All Future Updates Free (v4.x, v5.x)",
      "Dedicated WhatsApp VIP Direct Line",
      "Custom Timing & Delay Tuning Support",
      "Early Beta Access to New Features",
      "Full Replacement & License Guarantee",
      "Priority Booking Assistance",
    ],
  },
];

function RailwayAutoBookerLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#video-demo", label: "Video Demo" },
    { href: "#pricing", label: "Packages & Pricing" },
    { href: "#install", label: "Installation" },
    { href: "#contact", label: "Contact & Buy" },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Top sticky navigation bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-5 sm:px-6 md:h-[72px] md:px-8">
          <a
            href="/"
            aria-label="Railway Auto-Booker — Home"
            className={"inline-flex items-center leading-none rounded-lg " + focusRing}
          >
            <BrandWordmark iconSize="h-8 w-8 sm:h-9 sm:w-9" textSize="text-lg sm:text-xl" />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex lg:gap-8">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={"transition-colors hover:text-foreground font-medium " + focusRing}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Header Action Button */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="#pricing"
              className={button3dClass("sm", `gap-1.5 ${focusRing}`)}
            >
              <span>Get Subscription</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className={
              "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-[color:var(--surface)] md:hidden " +
              focusRing
            }
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <div
          id="mobile-menu"
          className={
            "overflow-hidden border-t border-border bg-background transition-[max-height,opacity] duration-300 ease-out md:hidden " +
            (menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0")
          }
        >
          <nav aria-label="Mobile" className="mx-auto max-w-7xl px-5 py-4 space-y-2">
            <ul className="flex flex-col space-y-1">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className={
                      "flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-[color:var(--surface)] " +
                      focusRing
                    }
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <a
                href="#pricing"
                onClick={() => setMenuOpen(false)}
                className={button3dClass("md", "w-full justify-center")}
              >
                View Packages & Order
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 sm:px-6 md:px-8">
        {/* HERO SECTION */}
        <section className="pt-12 pb-16 sm:pt-16 sm:pb-20 md:pt-20 md:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            {/* Animated Pill Badge */}
            <div className="hero-pill mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-foreground/90 shadow-sm">
              <span
                className="h-2 w-2 rounded-full bg-primary"
                style={{ animation: "pill-dot 2.4s cubic-bezier(0.4,0,0.6,1) infinite" }}
                aria-hidden
              />
              <span className="tracking-tight font-medium">
                v4.0 Ready for eticket.railway.gov.bd · 8:00 AM Rush Ready
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-balance text-[clamp(2.25rem,7vw,4.25rem)] font-bold leading-[1.08] tracking-tight">
              Book Bangladesh Railway Tickets
              <br />
              <span className="text-primary bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 bg-clip-text text-transparent">
                in Milliseconds, Automatically.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-[17px] md:text-lg">
              The high-speed, local-first browser extension engineered specifically for Bangladesh
              Railway (<strong>eticket.railway.gov.bd</strong>). Automates station search, coach
              selection, seat picking, and OTP checkout before tickets sell out.
            </p>

            {/* Action Buttons (3D button + Guide) */}
            <div className="mt-8 flex w-full flex-col items-stretch gap-3.5 sm:mt-10 sm:flex-row sm:items-center sm:justify-center">
              <a
                href="#pricing"
                className={button3dClass(
                  "lg",
                  "w-full sm:w-auto min-h-12 gap-2 text-base shadow-lg",
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>View Subscription Packages</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>

              <a
                href="#video-demo"
                className={
                  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-border bg-background px-6 text-sm font-semibold text-foreground transition-all hover:bg-[color:var(--surface)] hover:border-primary/40 sm:w-auto shadow-xs " +
                  focusRing
                }
              >
                <Play className="h-4 w-4 text-primary fill-primary/20" aria-hidden="true" />
                <span>Watch Video Demo</span>
              </a>
            </div>

            {/* Direct Order Quick CTAs */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-medium text-muted-foreground">
              <span>Instant Buy via:</span>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-whatsapp inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white text-[11px] hover:scale-105 transition-transform"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
              <a
                href={FACEBOOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-facebook inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white text-[11px] hover:scale-105 transition-transform"
              >
                <FacebookIcon className="h-3.5 w-3.5" />
                <span>Facebook</span>
              </a>
            </div>

            {/* Popular Routes Bar */}
            <div className="mt-12 pt-8 border-t border-border/60">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Optimized for all major intercity routes & classes
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {TOP_ROUTES.map((r) => (
                  <span
                    key={r.from + r.to}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-foreground/90 shadow-2xs"
                  >
                    <Train className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {r.from} ⇄ {r.to}
                    </span>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {SEAT_CLASSES.map((cls) => (
                  <span
                    key={cls}
                    className="rounded-md bg-muted/60 border border-border/50 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* POP-UP / VIDEO DEMO SHOWCASE SECTION */}
        <section id="video-demo" className="pb-16 sm:pb-20 md:pb-24 scroll-mt-24">
          <RailwayVideoAndExtensionShowcase />
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="mb-10 max-w-2xl sm:mb-14">
            <p className="font-mono text-[11px] uppercase tracking-widest text-primary font-semibold">
              Engineered For Milliseconds
            </p>
            <h2 className="mt-2 text-[clamp(1.75rem,4.5vw,2.5rem)] font-bold tracking-tight">
              Six things done properly for high-speed booking.
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
              When tickets release at 8:00 AM, thousands of passengers flood the server simultaneously.
              Railway Auto-Booker executes all booking steps instantly so you secure the seat you want.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const IconComp = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-border bg-[color:var(--surface)] p-6 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <IconComp className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SUBSCRIPTION PACKAGES / PRICING SECTION */}
        <section id="pricing" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="mx-auto max-w-3xl text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Transparent & Affordable Pricing</span>
            </div>
            <h2 className="text-[clamp(1.85rem,4.5vw,2.75rem)] font-bold tracking-tight">
              Choose Your Subscription Package
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Choose the plan that fits your travel frequency. Subscriptions are activated directly
              via WhatsApp or Facebook with instant setup assistance.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8 items-stretch">
            {PRICING_PLANS.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>

          {/* Help notice under pricing */}
          <div className="mt-10 rounded-xl border border-border bg-[color:var(--surface)] p-4 text-center sm:p-5">
            <p className="text-sm text-muted-foreground">
              ⚡ Need a custom agency license for multiple ticket desks or special train routes?{" "}
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-4 hover:text-emerald-700"
              >
                Chat with us on WhatsApp for custom setups →
              </a>
            </p>
          </div>
        </section>

        {/* INSTALLATION GUIDE SECTION */}
        <section id="install" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:gap-16 items-start">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-primary font-semibold">
                Setup In 60 Seconds
              </p>
              <h2 className="mt-2 text-[clamp(1.75rem,4.5vw,2.5rem)] font-bold tracking-tight">
                Four simple steps. One minute.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Works seamlessly in any Chromium browser — <strong>Google Chrome, Microsoft Edge, Brave, Arc, and Opera</strong>. No complicated coding or terminal commands needed.
              </p>

              <div className="mt-6 rounded-xl border border-border bg-[color:var(--surface)] p-4.5 space-y-3">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
                  <Laptop className="h-4 w-4 text-primary" />
                  <span>Compatible Operating Systems</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-2 py-1">Windows 10 / 11</span>
                  <span className="rounded bg-muted px-2 py-1">macOS</span>
                  <span className="rounded bg-muted px-2 py-1">Linux</span>
                </div>
              </div>
            </div>

            <ol className="space-y-3 sm:space-y-4">
              {STEPS.map((s) => (
                <li
                  key={s.step}
                  className="flex items-start gap-4 rounded-xl border border-border bg-[color:var(--surface)] p-5 transition-colors hover:border-primary/40"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
                    {s.step}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      {s.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* DEDICATED CONTACT & PURCHASE SECTION */}
        <section id="contact" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 via-[color:var(--surface)] to-background p-8 sm:p-12 md:p-16 text-center max-w-4xl mx-auto shadow-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Direct Developer Assistance</span>
            </span>

            <h2 className="mt-4 text-balance text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
              Ready to Secure Your Train Tickets?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
              Contact Rifat directly via WhatsApp or Facebook Messenger to buy your subscription,
              get immediate license activation, and receive personal setup help.
            </p>

            {/* The Two Main Contact Buttons Requested by User */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-whatsapp w-full sm:w-auto min-h-12 inline-flex items-center justify-center gap-2.5 rounded-[12px] px-8 text-sm font-bold shadow-md hover:scale-[1.02] transition-transform"
              >
                <WhatsAppIcon className="h-5 w-5" />
                <span>Contact via WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>

              <a
                href={FACEBOOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-facebook w-full sm:w-auto min-h-12 inline-flex items-center justify-center gap-2.5 rounded-[12px] px-8 text-sm font-bold shadow-md hover:scale-[1.02] transition-transform"
              >
                <FacebookIcon className="h-5 w-5" />
                <span>Contact via Facebook</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            </div>

            <p className="mt-6 text-xs text-muted-foreground font-mono">
              ⚡ Typical response time: Under 5 minutes (8:00 AM – 11:30 PM BST)
            </p>
          </div>
        </section>

        {/* TRUST & GUARANTEE PRINCIPLES */}
        <section className="border-t border-border py-14 sm:py-16">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 md:gap-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
                <ShieldCheck className="h-4 w-4" />
                <span>100% Local & Private</span>
              </div>
              <h3 className="text-base font-semibold tracking-tight">Your data never leaves your device.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No cloud servers, no account required. Your railway login information stays entirely inside your browser's private storage.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
                <Clock className="h-4 w-4" />
                <span>Millisecond Precision</span>
              </div>
              <h3 className="text-base font-semibold tracking-tight">Beats human reaction speed.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                While humans take 15–30 seconds to select trains and seats, the auto-booker executes seat picking in 0.3 seconds.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-2">
                <RotateCcw className="h-4 w-4" />
                <span>Continuous Updates</span>
              </div>
              <h3 className="text-base font-semibold tracking-tight">Always compatible with eticket portal.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Whenever Bangladesh Railway updates their website or seat layouts, the extension receives instant patch updates.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border bg-[color:var(--surface)]/50">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 md:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-border">
            <div className="flex items-center gap-3">
              <img
                src="/railway-icon.png"
                alt="Railway Auto-Booker"
                className="h-7 w-7 rounded-md object-cover"
              />
              <span className="font-bold text-foreground text-base">Railway Auto-Booker</span>
              <span className="text-xs text-muted-foreground">· High-speed ticket booking extension</span>
            </div>

            {/* Quick Contact Links in Footer */}
            <div className="flex items-center gap-4 text-xs font-medium">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-emerald-600 transition-colors"
              >
                <WhatsAppIcon className="h-4 w-4" />
                <span>WhatsApp</span>
              </a>
              <a
                href={FACEBOOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-blue-600 transition-colors"
              >
                <FacebookIcon className="h-4 w-4" />
                <span>Facebook</span>
              </a>
              <a
                href="#pricing"
                className="text-primary hover:underline font-semibold"
              >
                Pricing Plans
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Railway Auto-Booker By Rifat. All rights reserved.
            </p>
            <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground/80">
              Disclaimer: Railway Auto-Booker is an independent browser utility developed to assist travelers with automated form completion. It is not affiliated with, endorsed by, or sponsored by Bangladesh Railway, the Ministry of Railways, or Shohoz-Synesis-Vincen JV.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** PRICING CARD COMPONENT */
function PricingCard({
  plan,
}: {
  plan: (typeof PRICING_PLANS)[number];
}) {
  return (
    <div
      className={
        "relative flex flex-col justify-between rounded-2xl border p-6 sm:p-8 transition-all duration-300 " +
        (plan.isPopular
          ? "border-primary bg-[color:var(--surface)] shadow-lg ring-2 ring-primary/20 scale-[1.02]"
          : "border-border bg-[color:var(--surface)] hover:border-primary/40 shadow-xs")
      }
    >
      {plan.isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
          {plan.badge}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight text-foreground">{plan.name}</h3>
          {!plan.isPopular && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {plan.badge}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {plan.description}
        </p>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {plan.price}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground font-mono">{plan.period}</span>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 font-mono">
            Included Benefits:
          </p>
          <ul className="space-y-2.5 text-xs sm:text-sm">
            {plan.features.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-foreground/90">
                <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Two dedicated contact buttons on each card */}
      <div className="mt-8 space-y-2.5 pt-4 border-t border-border">
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-3d-whatsapp flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-xs sm:text-sm font-bold shadow-xs hover:scale-[1.01] transition-transform"
        >
          <WhatsAppIcon className="h-4 w-4" />
          <span>Buy via WhatsApp</span>
        </a>

        <a
          href={FACEBOOK_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-3d-facebook flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-xs sm:text-sm font-bold shadow-xs hover:scale-[1.01] transition-transform"
        >
          <FacebookIcon className="h-4 w-4" />
          <span>Buy via Facebook</span>
        </a>
      </div>
    </div>
  );
}

/** VIDEO & EXTENSION PREVIEW SHOWCASE COMPONENT (Replaces the Memlace popup frame) */
function RailwayVideoAndExtensionShowcase() {
  const [activeTab, setActiveTab] = useState<"video" | "interactive">("video");
  const [bookingState, setBookingState] = useState<"idle" | "running" | "booked">("idle");
  const [selectedClass, setSelectedClass] = useState("Snigdha");
  const [selectedFrom, setSelectedFrom] = useState("DHAKA");
  const [selectedTo, setSelectedTo] = useState("CHITTAGONG");

  const startDemoBooking = () => {
    if (bookingState === "running") return;
    setBookingState("running");
    toast.info("8:00:00 AM Trigger Activated! Searching tickets…");
    setTimeout(() => {
      setBookingState("booked");
      toast.success("Seats Locked in 0.38s! Coach: CHA, Seats: 21, 22, 23, 24");
    }, 1200);
  };

  const resetDemoBooking = () => {
    setBookingState("idle");
  };

  return (
    <div
      role="region"
      aria-label="Railway Auto-Booker video and live extension showcase"
      className="group/frame relative overflow-hidden rounded-2xl border border-border bg-[color:var(--surface)] shadow-[var(--shadow-soft)] transition-shadow duration-500 hover:shadow-xl"
    >
      {/* Mockup Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/70 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <span className="ml-3 font-mono text-xs text-muted-foreground hidden sm:inline">
            eticket.railway.gov.bd · Railway Auto-Booker Extension
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all " +
              (activeTab === "video"
                ? "bg-[color:var(--surface)] text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Play className="h-3 w-3 text-primary fill-primary" />
            <span>Demo Video</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("interactive")}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all " +
              (activeTab === "interactive"
                ? "bg-[color:var(--surface)] text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Live Interactive UI</span>
          </button>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          <span>Rush Ready</span>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "video" ? (
        /* TAB 1: User's Video Spot */
        <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-b from-background via-[color:var(--surface)] to-background">
          <div className="relative mx-auto aspect-video max-w-4xl overflow-hidden rounded-xl border border-border bg-black/95 shadow-md flex items-center justify-center text-center">
            {/* Poster image fallback / Background */}
            <img
              src="/railway-hero.png"
              alt="Bangladesh Railway Auto-Booker Preview"
              className="absolute inset-0 h-full w-full object-cover opacity-25 filter blur-[1px]"
            />

            {/* Video or video embed container */}
            <div className="relative z-10 p-6 flex flex-col items-center justify-center max-w-md">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-xl ring-8 ring-primary/20 hover:scale-110 transition-transform cursor-pointer">
                <Play className="h-7 w-7 sm:h-9 sm:w-9 ml-1 fill-white" />
              </div>
              <h3 className="mt-5 text-lg sm:text-xl font-bold text-white">
                Railway Auto-Booker Demo Video
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                Watch how the extension automatically grabs seats on <em>eticket.railway.gov.bd</em> in under 0.4 seconds during 8:00 AM rush hour.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 rounded-full px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Place Your Video Here</span>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-muted-foreground font-mono">
              💡 Tip: Click the "Live Interactive UI" tab above to test the auto-booker form simulator!
            </p>
          </div>
        </div>
      ) : (
        /* TAB 2: Live Extension Form Simulator */
        <div className="p-4 sm:p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] items-start">
            {/* Extension popup mockup */}
            <div className="rounded-xl border border-border bg-background p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div className="flex items-center gap-2">
                  <img
                    src="/railway-icon.png"
                    alt=""
                    className="h-6 w-6 rounded-md object-cover"
                  />
                  <span className="font-bold text-sm text-foreground">
                    Railway Auto-Booker <span className="text-primary text-xs font-mono">v4.0</span>
                  </span>
                </div>
                <span className="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px] px-2 py-0.5 font-bold">
                  LOCAL EXTENSION
                </span>
              </div>

              {/* Form fields */}
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      From Station
                    </label>
                    <select
                      value={selectedFrom}
                      onChange={(e) => setSelectedFrom(e.target.value)}
                      className="w-full rounded-md border border-border bg-[color:var(--surface)] px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary"
                    >
                      <option value="DHAKA">DHAKA (DA)</option>
                      <option value="CHITTAGONG">CHITTAGONG (CG)</option>
                      <option value="SYLHET">SYLHET (SYL)</option>
                      <option value="RAJSHAHI">RAJSHAHI (RAJ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      To Station
                    </label>
                    <select
                      value={selectedTo}
                      onChange={(e) => setSelectedTo(e.target.value)}
                      className="w-full rounded-md border border-border bg-[color:var(--surface)] px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary"
                    >
                      <option value="CHITTAGONG">CHITTAGONG (CG)</option>
                      <option value="COX'S BAZAR">COX'S BAZAR (CXB)</option>
                      <option value="DHAKA">DHAKA (DA)</option>
                      <option value="KHULNA">KHULNA (KHL)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Journey Date
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Tomorrow (8:00 AM Rush)"
                      className="w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Seat Class
                    </label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full rounded-md border border-border bg-[color:var(--surface)] px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary"
                    >
                      <option value="Snigdha">Snigdha (AC Chair)</option>
                      <option value="AC_B">AC_B (AC Berth)</option>
                      <option value="S_CHAIR">S_CHAIR (Shovon Chair)</option>
                      <option value="AC_S">AC_S (AC Seat)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Seats Count
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="4 Seats (Consecutive)"
                      className="w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Seat Range
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="1 – 40 (Window Preferred)"
                      className="w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Simulated action button */}
                <div className="pt-2">
                  {bookingState === "booked" ? (
                    <div className="space-y-2">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 p-3 text-center">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          ✓ 4 Tickets Auto-Locked in 0.38 Seconds!
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Coach: CHA | Seats: 21, 22, 23, 24 | Ready for bKash
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetDemoBooking}
                        className="w-full rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        Reset Simulator
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startDemoBooking}
                      disabled={bookingState === "running"}
                      className={button3dClass(
                        "md",
                        "w-full justify-center text-xs font-bold uppercase tracking-wider",
                      )}
                    >
                      {bookingState === "running" ? (
                        <span>Searching & Locking Seats…</span>
                      ) : (
                        <span>Start Auto-Booking Test</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Speed Log */}
            <div className="rounded-xl border border-border bg-background p-5 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
                <span className="font-bold text-muted-foreground uppercase text-[11px] tracking-wider">
                  Real-time Execution Telemetry
                </span>
                <span className="text-[10px] text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded font-bold">
                  0.38s TOTAL
                </span>
              </div>

              <div className="space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-primary">[08:00:00.005]</span>
                  <span>System clock synced with Railway NTP server.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">[08:00:00.042]</span>
                  <span>
                    Query fired: {selectedFrom} ➔ {selectedTo} ({selectedClass})
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">[08:00:00.118]</span>
                  <span>Train located: Suborno Express (701). Available seats: 48</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">[08:00:00.224]</span>
                  <span>Scanning coach CHA for 4 adjacent seats...</span>
                </div>
                <div className="flex items-start gap-2 text-emerald-600 font-semibold">
                  <span className="text-primary">[08:00:00.315]</span>
                  <span>Locked CHA-21, 22, 23, 24. Session holding active.</span>
                </div>
                <div className="flex items-start gap-2 text-foreground font-semibold">
                  <span className="text-primary">[08:00:00.380]</span>
                  <span>Passenger details autofilled. Proceeding to checkout.</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Manual Human Speed: ~25.0s</span>
                <span className="text-primary font-bold">Auto-Booker Speed: 0.38s (65x faster)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
