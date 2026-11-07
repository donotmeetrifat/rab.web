import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, AlertTriangle, ShieldCheck, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "শর্তাবলী (Terms of Service) — Railway Auto-Booker" },
      {
        name: "description",
        content:
          "Railway Auto-Booker ব্যবহারের নিয়মাবলী ও শর্তাবলী (Terms of Service)। লাইসেন্স নীতিমালা ও ডিসক্লেইমার।",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "শর্তাবলী — Railway Auto-Booker" },
      {
        property: "og:description",
        content:
          "Railway Auto-Booker ব্যবহারের নিয়মাবলী ও শর্তাবলী (Terms of Service)। লাইসেন্স নীতিমালা ও ডিসক্লেইমার।",
      },
      { property: "og:url", content: "https://railwayautobooker.vercel.app/terms" },
      {
        property: "og:image",
        content: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "শর্তাবলী — Railway Auto-Booker" },
      {
        name: "twitter:description",
        content:
          "Railway Auto-Booker ব্যবহারের নিয়মাবলী ও শর্তাবলী (Terms of Service)। লাইসেন্স নীতিমালা ও ডিসক্লেইমার।",
      },
      {
        name: "twitter:image",
        content: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      },
    ],
    links: [{ rel: "canonical", href: "https://railwayautobooker.vercel.app/terms" }],
  }),
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>হোমে ফিরে যান</span>
          </Link>
          <span className="font-bold text-foreground text-sm sm:text-base">
            Railway <span className="text-primary">Auto-Booker</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-8 border-b border-border pb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary mb-3">
            <FileText className="h-3.5 w-3.5" />
            <span>ব্যবহারের নিয়ম ও শর্তাবলী</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            টার্মস অব সার্ভিস (Terms of Service)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">সর্বশেষ আপডেট: ২২ অক্টোবর, ২০২৬</p>
        </div>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed text-foreground/90">
          {/* DISCLAIMER BOX */}
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>গুরুত্বপূর্ণ ডিসক্লেইমার (Disclaimer)</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
              Railway Auto-Booker একটি সম্পূর্ণ স্বাধীন থার্ড-পার্টি ব্রাউজার ইউটিলিটি এক্সটেনশন।
              এটি বাংলাদেশ রেলওয়ে (Bangladesh Railway), গণপ্রজাতন্ত্রী বাংলাদেশ সরকার অথবা
              সহজ-সিনেসিস-ভিনসেন জেভি (Shohoz)-এর কোনো আনুষ্ঠানিক সেবা নয় এবং এদের সাথে কোনো প্রকার
              প্রাতিষ্ঠানিক সংশ্লিষ্টতা নেই। এটি সাধারণ যাত্রীদের সুবিধার্থে ব্রাউজারে
              স্বয়ংক্রিয়ভাবে দ্রুত ফর্ম পূরণের একটি সহায়ক টুল মাত্র।
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>১. সেবার পরিধি ও ব্যবহার</span>
            </h2>
            <p>
              Railway Auto-Booker ব্রাউজারের অভ্যন্তরে ক্লায়েন্ট-সাইড অটোমেশন প্রক্রিয়ায় কাজ করে।
              সকাল ৮:০০ টা ও দুপুর ২:০০ টায় টিকিট ছাড়ার মুহূর্তে এটি ব্যবহারকারীর পূর্বনির্ধারিত
              পছন্দের তথ্য স্বয়ংক্রিয়ভাবে ইনপুট করে ওটিপি ও পেমেন্ট ধাপে দ্রুত পৌঁছে দিতে সাহায্য
              করে।
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              ২. লাইসেন্স ও মেয়াদের শর্তাবলী
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>
                প্রতিটি সাবস্ক্রিপশন প্যাকেজের মেয়াদ (যেমন ৩০ দিন, ৯০ দিন, ১৮০ দিন) লাইসেন্স কি
                প্রথম অ্যাক্টিভেশনের দিন থেকে গণনা করা হবে।
              </li>
              <li>
                একটি লাইসেন্স কি অনুমোদিত ডিভাইসে ব্যবহারের জন্য প্রযোজ্য। লাইসেন্স অন্য কারো কাছে
                হস্তান্তরযোগ্য নয়।
              </li>
              <li>
                মেয়াদ শেষ হওয়ার পর পুনরায় রিনিউ বা নতুন প্ল্যান গ্রহণ করে এক্সটেনশন সচল রাখা যাবে।
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              ৩. ব্যবহারকারীর দায়িত্ব
            </h2>
            <p>
              ব্যবহারকারীকে অবশ্যই eticket.railway.gov.bd পোর্টালে নিজস্ব বৈধ অ্যাকাউন্ট ও জাতীয়
              পরিচয়পত্র অনুযায়ী প্রকৃত যাত্রীর তথ্য প্রদান করতে হবে। টিকিট ক্রয়ের চূড়ান্ত অর্থ
              পরিশোধ (বিকাশ/নগদ/কার্ড) ব্যবহারকারীকে নিজস্ব ওটিপি ভেরিফিকেশনের মাধ্যমে সম্পন্ন করতে
              হবে।
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <span>৪. সাপোর্ট ও সহায়তা</span>
            </h2>
            <p>
              ইনস্টলেশন বা লাইসেন্স সম্পর্কিত যেকোনো সমস্যার জন্য আমাদের সাপোর্ট টিম হোয়াটসঅ্যাপ ও
              ফেসবুক মেসেঞ্জারে সার্বক্ষণিক সহায়তা প্রদান করে। কোনো কারণে লাইসেন্স কি কাজ না করলে
              তাৎক্ষণিকভাবে নতুন কি রিপ্লেস করে দেওয়া হয়।
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Railway Auto-Booker. All rights reserved.</span>
          <Link to="/privacy" className="hover:text-foreground underline">
            প্রাইভেসি পলিসি
          </Link>
        </div>
      </main>
    </div>
  );
}
