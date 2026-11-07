import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Button3D, LinkButton3D } from "../components/ui/button-3d";
import { Toaster } from "../components/ui/sonner";
import { AnalyticsTracker } from "../components/analytics-tracker";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <LinkButton3D to="/">Go home</LinkButton3D>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button3D
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button3D>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const SCHEMA_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://railwayautobooker.vercel.app/#software",
      name: "Railway Auto-Booker",
      alternateName: [
        "Bangladesh Railway Auto-Booker",
        "রেলওয়ে ট্রেনের টিকিট অটো বুকিং",
        "BD Railway Auto Booker",
      ],
      applicationCategory: "BrowserApplication",
      operatingSystem: "Windows 10, Windows 11, Android (Kiwi Browser), macOS, ChromeOS",
      browserRequirements:
        "Requires Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Kiwi Browser)",
      url: "https://railwayautobooker.vercel.app/",
      downloadUrl: "https://railwayautobooker.vercel.app/downloads/Railway-Auto-Booker-PC.zip",
      image: "https://railwayautobooker.vercel.app/railway-icon.png",
      screenshot: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      description:
        "High-speed browser extension for Bangladesh Railway (eticket.railway.gov.bd). Automatically books train tickets during 8:00 AM rush hour with instant seat picking, coach selection, and fast checkout.",
      softwareVersion: "2.4.0",
      inLanguage: "bn-BD",
      author: { "@id": "https://railwayautobooker.vercel.app/#organization" },
      publisher: { "@id": "https://railwayautobooker.vercel.app/#organization" },
      isPartOf: { "@id": "https://railwayautobooker.vercel.app/#website" },
      featureList: [
        "সকাল ৮:০০ ও দুপুর ২:০০ টার মিলি-সেকেন্ড অটো-ট্রিগার",
        "কম্পিউটার (Chrome, Edge, Brave) ও মোবাইল (Kiwi Browser) সাপোর্ট",
        "স্মার্ট সিট ও বগি (Coach) অটো-সিলেকশন",
        "ফেইলসেফ ব্যাকআপ সিট বুকিং প্রযুক্তি",
        "অটো প্যাসেঞ্জার ইনফো ও দ্রুত ওটিপি পেজ জাম্প",
        "১০০% লোকাল, প্রাইভেট ও ক্লায়েন্ট-সাইড প্রসেসিং",
        "হিউম্যানাইজড টাইম ডিলে ও অ্যান্টি-ব্যান অ্যালগরিদম",
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        ratingCount: "128",
        bestRating: "5",
        worstRating: "1",
      },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "BDT",
        lowPrice: "79",
        highPrice: "1799",
        offerCount: "7",
        priceValidUntil: "2026-12-31",
        offers: [
          {
            "@type": "Offer",
            name: "৩ দিনের পাস (3 Days Trial Pass)",
            price: "79",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
          {
            "@type": "Offer",
            name: "৭ দিনের পাস (7 Days Round-Trip Pass)",
            price: "149",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
          {
            "@type": "Offer",
            name: "১৫ দিনের পাস (15 Days Short-Term Pass)",
            price: "199",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
          {
            "@type": "Offer",
            name: "৩০ দিন / ১ মাস (30 Days Standard Plan)",
            price: "249",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
          {
            "@type": "Offer",
            name: "৯০ দিন / ৩ মাস (90 Days Popular Plan)",
            price: "599",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
          {
            "@type": "Offer",
            name: "১৮০ দিন / ৬ মাস (180 Days Extended Plan)",
            price: "999",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
          {
            "@type": "Offer",
            name: "৩৬৫ দিন / ১ বছর (365 Days VIP Annual Pass)",
            price: "1799",
            priceCurrency: "BDT",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            url: "https://railwayautobooker.vercel.app/#pricing",
            seller: { "@id": "https://railwayautobooker.vercel.app/#organization" },
          },
        ],
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://railwayautobooker.vercel.app/#website",
      url: "https://railwayautobooker.vercel.app/",
      name: "Railway Auto-Booker",
      description: "বাংলাদেশ রেলওয়ের ট্রেনের টিকিট কাটার দ্রুততম এক্সটেনশন",
      inLanguage: "bn-BD",
      publisher: { "@id": "https://railwayautobooker.vercel.app/#organization" },
      about: { "@id": "https://railwayautobooker.vercel.app/#software" },
    },
    {
      "@type": "WebPage",
      "@id": "https://railwayautobooker.vercel.app/#webpage",
      url: "https://railwayautobooker.vercel.app/",
      name: "Railway Auto-Booker — বাংলাদেশ রেলওয়ে টিকিট অটো বুকিং",
      description:
        "বাংলাদেশ রেলওয়ে ট্রেনের টিকিট কাটার দ্রুততম এক্সটেনশন। সকাল ৮:০০ ও দুপুর ২:০০ টায় মিলিসেকেন্ডে অটোমেটিক বগি, সিট সিলেক্ট ও ফাস্ট চেকআউট।",
      isPartOf: { "@id": "https://railwayautobooker.vercel.app/#website" },
      about: { "@id": "https://railwayautobooker.vercel.app/#software" },
      breadcrumb: { "@id": "https://railwayautobooker.vercel.app/#breadcrumb" },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
        width: "1280",
        height: "720",
      },
      inLanguage: "bn-BD",
    },
    {
      "@type": "Organization",
      "@id": "https://railwayautobooker.vercel.app/#organization",
      name: "Railway Auto-Booker",
      url: "https://railwayautobooker.vercel.app/",
      logo: {
        "@type": "ImageObject",
        url: "https://railwayautobooker.vercel.app/railway-icon.png",
        width: "512",
        height: "512",
      },
      sameAs: ["https://www.facebook.com/meetrifat", "https://wa.me/meetrifat.ai"],
      founder: {
        "@type": "Person",
        name: "MD Rifat",
        jobTitle: "Software Developer & Automation Specialist",
        url: "https://www.facebook.com/meetrifat",
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          url: "https://wa.me/meetrifat.ai",
          availableLanguage: ["Bengali", "English"],
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://railwayautobooker.vercel.app/#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://railwayautobooker.vercel.app/",
        },
      ],
    },
    {
      "@type": "VideoObject",
      "@id": "https://railwayautobooker.vercel.app/#video",
      name: "Railway Auto-Booker Live Video Demonstration",
      description:
        "Watch how Railway Auto-Booker automatically selects train seats, coaches, and proceeds to checkout in milliseconds on Bangladesh Railway portal.",
      thumbnailUrl: ["https://railwayautobooker.vercel.app/railway-thumbnail.webp"],
      uploadDate: "2026-10-22T08:00:00+06:00",
      contentUrl: "https://railwayautobooker.vercel.app/railway-demo.mp4",
      duration: "PT1M30S",
      inLanguage: "bn-BD",
      creator: { "@id": "https://railwayautobooker.vercel.app/#organization" },
      about: { "@id": "https://railwayautobooker.vercel.app/#software" },
    },
    {
      "@type": "FAQPage",
      "@id": "https://railwayautobooker.vercel.app/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "Railway Auto-Booker কী এবং এটি কীভাবে কাজ করে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "রেলওয়ে অটো-বুকার (Railway Auto-Booker) হলো বাংলাদেশ রেলওয়ের অফিশিয়াল ই-টিকিটিং ওয়েবসাইটের (eticket.railway.gov.bd) জন্য প্রস্তুতকৃত একটি হাই-স্পিড ব্রাউজার এক্সটেনশন। এটি সকাল ৮:০০ টা (পূর্বাঞ্চল) ও দুপুর ২:০০ টায় (পশ্চিমাঞ্চল) টিকিট ছাড়ার মুহূর্তে সার্ভার ঘড়ির সাথে মিলিসেকেন্ড নিখুঁত টাইমিংয়ে সিঙ্ক হয়ে স্বয়ংক্রিয়ভাবে ট্রেনের বগি, পছন্দের খালি সিট সিলেক্ট ও ওটিপি পেজে রিডাইরেক্ট করে। কম্পিউটার (Chrome, Edge, Brave) এবং অ্যান্ড্রয়েড মোবাইল (Kiwi Browser) উভয়েই এটি ১০০% ক্লায়েন্ট-সাইড লোকাল ও নিরাপদে কাজ করে।",
          },
        },
        {
          "@type": "Question",
          name: "Railway Auto-Booker কি আসলেই সকাল ৮:০০ টায় টিকিট কাটতে পারে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "হ্যাঁ, সম্পূর্ণ কার্যকর! এটি বাংলাদেশ রেলওয়ে সার্ভার ঘড়ির সাথে মিলি-সেকেন্ড নিখুঁতভাবে সিঙ্ক হয়ে ঠিক সকাল ৮:০০:০০ এবং দুপুর ২:০০:০০ টায় মিলি-সেকেন্ডে অটোমেটিক ট্রেনের বগি, সিট সিলেক্ট ও ওটিপি পেজে নিয়ে যায়। সাধারণ মানুষের ক্লিক করার চেয়ে এটি ৫০ গুণ দ্রুত কাজ করে।",
          },
        },
        {
          "@type": "Question",
          name: "অ্যান্ড্রয়েড মোবাইল ফোনে কীভাবে এক্সটেনশনটি ব্যবহার করব?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "গুগল প্লে-স্টোর থেকে Kiwi Browser ইনস্টল করুন। এরপর আমাদের দেওয়া জিপ ফাইলটি আনজিপ করে Kiwi ব্রাউজারের Extensions মেনু থেকে 'Developer Mode' অন করে 'Load unpacked'-এর মাধ্যমে এক্সটেনশনটি লোড করুন। মোবাইলেও এটি পিসির মতো সমান গতিতে কাজ করে।",
          },
        },
        {
          "@type": "Question",
          name: "আমার বাংলাদেশ রেলওয়ে অ্যাকাউন্ট কি ব্যান হওয়ার কোনো ঝুঁকি আছে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "না, সম্পূর্ণ নিরাপদ। এক্সটেনশনে হিউম্যানাইজড টাইম ডিলে ও স্মার্ট অ্যান্টি-ব্যান অ্যালগরিদম যুক্ত রয়েছে যা মানুষের সাধারণ ব্রাউজিং প্যাটার্ন বজায় রাখে। তাছাড়া এটি কোনো স্ক্র্যাপার নয়—সম্পূর্ণ লোকালভাবে আপনার নিজস্ব ব্রাউজারের ভেতরে কাজ করে।",
          },
        },
        {
          "@type": "Question",
          name: "পেমেন্ট করার পর লাইসেন্স কি কতক্ষণের মধ্যে পাব?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "বিকাশ বা নগদে পেমেন্ট সম্পন্ন করার পর আমাদের হোয়াটসঅ্যাপ বা ফেসবুক মেসেঞ্জারে ট্রানজেকশন আইডি পাঠালে তাৎক্ষণিকভাবে (১ থেকে ৫ মিনিটের মধ্যে) লাইসেন্স কি এবং ডাউনলোড লিঙ্ক প্রদান করা হয়।",
          },
        },
        {
          "@type": "Question",
          name: "আমার পছন্দের বগি বা সিট খালি না থাকলে কি টিকিট মিস হবে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "না! এক্সটেনশনটিতে স্মার্ট ফেইলসেফ ব্যাকআপ অপশন রয়েছে। আপনার পছন্দের নির্দিষ্ট সিট না পেলে এটি তাৎক্ষণিকভাবে উক্ত ক্লাসের অন্য যেকোনো খালি সিট স্বয়ংক্রিয়ভাবে লক করে নেয়, যাতে টিকিট পাওয়ার সুযোগ শতভাগ নিশ্চিত থাকে।",
          },
        },
        {
          "@type": "Question",
          name: "এক লাইসেন্স দিয়ে কয়টি ডিভাইসে চালানো যাবে?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "প্রতিটি লাইসেন্স কি একটি অনুমোদিত ডিভাইসে সক্রিয় করার জন্য বরাদ্দ। তবে ডিভাইস পরিবর্তন বা উইন্ডোজ রিলোড দিলে আমাদের সাপোর্টে যোগাযোগ করলে তাৎক্ষণিক মাইগ্রেশন সহায়তা দেওয়া হয়।",
          },
        },
      ],
    },
  ],
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Railway Auto-Booker — বাংলাদেশ রেলওয়ে টিকিট অটো বুকিং" },
      {
        name: "description",
        content:
          "বাংলাদেশ রেলওয়ে ট্রেনের টিকিট কাটার দ্রুততম এক্সটেনশন। সকাল ৮:০০ ও দুপুর ২:০০ টায় মিলিসেকেন্ডে অটোমেটিক বগি, সিট সিলেক্ট ও ফাস্ট চেকআউট।",
      },
      {
        name: "keywords",
        content:
          "railway auto booker, bangladesh railway ticket, eticket railway gov bd, train ticket auto booking, রেলওয়ে টিকিট অটো বুকিং",
      },
      { name: "author", content: "Railway Auto-Booker" },
      {
        name: "google-site-verification",
        content: "googlef62cf14d0321ed1e",
      },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
      { name: "theme-color", content: "#059669" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Railway Auto-Booker" },
      { property: "og:locale", content: "bn_BD" },
      { property: "og:url", content: "https://railwayautobooker.vercel.app/" },
      {
        property: "og:title",
        content: "Railway Auto-Booker — বাংলাদেশ রেলওয়ে টিকিট অটো বুকিং",
      },
      {
        property: "og:description",
        content:
          "সকাল ৮:০০ ও দুপুর ২:০০ টায় মিলিসেকেন্ডে বাংলাদেশ রেলওয়ের ট্রেনের টিকিট কাটুন সম্পূর্ণ অটোমেটিকভাবে। কম্পিউটার ও মোবাইল উভয় ডিভাইসেই কার্যকর।",
      },
      {
        property: "og:image",
        content: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      },
      { property: "og:image:type", content: "image/webp" },
      { property: "og:image:width", content: "1280" },
      { property: "og:image:height", content: "720" },
      { property: "og:image:alt", content: "Railway Auto-Booker Video Demo Thumbnail" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Railway Auto-Booker — বাংলাদেশ রেলওয়ে টিকিট অটো বুকিং" },
      {
        name: "twitter:description",
        content:
          "সকাল ৮:০০ ও দুপুর ২:০০ টায় মিলিসেকেন্ডে বাংলাদেশ রেলওয়ের ট্রেনের টিকিট কাটুন সম্পূর্ণ অটোমেটিকভাবে।",
      },
      {
        name: "twitter:image",
        content: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      },
    ],
    links: [
      { rel: "canonical", href: "https://railwayautobooker.vercel.app/" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(SCHEMA_DATA),
          }}
        />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.location.pathname.indexOf('/admin')===0)return;var v='';try{v=localStorage.getItem('rab_visitor_id')||'';if(!v){v='v_'+Math.random().toString(36).slice(2,10)+'_'+Date.now().toString(36);localStorage.setItem('rab_visitor_id',v);}}catch(e){v='v_p_'+Math.random().toString(36).slice(2,10);}var b=JSON.stringify({vid:v,path:window.location.pathname,ref:document.referrer||'',screen:(window.screen?window.screen.width+'x'+window.screen.height:'')});if(typeof fetch==='function'){fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true,cache:'no-store'}).catch(function(){});}window.__rab_tracked=true;}catch(e){}})();`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <AnalyticsTracker />
      <Toaster />
    </QueryClientProvider>
  );
}
