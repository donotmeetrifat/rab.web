import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Lock, EyeOff, ServerOff, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "প্রাইভেসি পলিসি (Privacy Policy) — Railway Auto-Booker" },
      {
        name: "description",
        content:
          "Railway Auto-Booker এর প্রাইভেসি পলিসি। জানুন কীভাবে আপনার তথ্য সম্পূর্ণ লোকাল ব্রাউজারে নিরাপদ ও ব্যক্তিগত থাকে।",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "প্রাইভেসি পলিসি — Railway Auto-Booker" },
      {
        property: "og:description",
        content:
          "Railway Auto-Booker এর প্রাইভেসি পলিসি। জানুন কীভাবে আপনার তথ্য সম্পূর্ণ লোকাল ব্রাউজারে নিরাপদ ও ব্যক্তিগত থাকে।",
      },
      { property: "og:url", content: "https://railwayautobooker.vercel.app/privacy" },
      {
        property: "og:image",
        content: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "প্রাইভেসি পলিসি — Railway Auto-Booker" },
      {
        name: "twitter:description",
        content:
          "Railway Auto-Booker এর প্রাইভেসি পলিসি। জানুন কীভাবে আপনার তথ্য সম্পূর্ণ লোকাল ব্রাউজারে নিরাপদ ও ব্যক্তিগত থাকে।",
      },
      {
        name: "twitter:image",
        content: "https://railwayautobooker.vercel.app/railway-thumbnail.webp",
      },
    ],
    links: [{ rel: "canonical", href: "https://railwayautobooker.vercel.app/privacy" }],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
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
            <Shield className="h-3.5 w-3.5" />
            <span>গোপনীয়তা ও ডেটা সুরক্ষা</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            প্রাইভেসি পলিসি (Privacy Policy)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">সর্বশেষ আপডেট: ২২ অক্টোবর, ২০২৬</p>
        </div>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <span>১. আমাদের গোপনীয়তার মূল অঙ্গীকার</span>
            </h2>
            <p>
              Railway Auto-Booker আপনার ব্যক্তিগত তথ্যের সর্বোচ্চ গোপনীয়তা রক্ষা করতে দায়বদ্ধ।
              আমাদের এক্সটেনশনটি এমনভাবে তৈরি করা হয়েছে যাতে এটি{" "}
              <strong>১০০% লোকালভাবে আপনার নিজস্ব ব্রাউজারের ভেতর কার্যকর থাকে</strong>।
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ServerOff className="h-5 w-5 text-primary" />
              <span>২. কোন কোন তথ্য আমরা কখনো সংগ্রহ বা প্রেরণ করি না</span>
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>বাংলাদেশ রেলওয়ের পাসওয়ার্ড বা ওটিপি:</strong> আপনার লগইন পাসওয়ার্ড বা
                  বিকাশ/নগদ ওটিপি কখনোই কোনো সার্ভারে পাঠানো হয় না।
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>জাতীয় পরিচয়পত্র (NID) বা পেমেন্ট পিন:</strong> আপনার আর্থিক বা ব্যক্তিগত
                  পরিচয় সংক্রান্ত কোনো সংবেদনশীল তথ্য জমা রাখা হয় না।
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>ব্রাউজিং ইতিহাস:</strong> eticket.railway.gov.bd সাইট ব্যতীত অন্য কোনো
                  সাইটের কোনো ডেটা এক্সটেনশন অ্যাক্সেস করে না।
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-primary" />
              <span>৩. লোকাল স্টোরেজ (Local Storage) ব্যবহার</span>
            </h2>
            <p>
              এক্সটেনশনের সেটিংস যেমন: আপনার পছন্দের ট্রেনের নাম, বগি, সিট রেঞ্জ, যাত্রীর নাম
              ইত্যাদি তথ্য শুধুমাত্র আপনার ডিভাইসের ব্রাউজার মেমোরিতে (
              <code>chrome.storage.local</code>) সংরক্ষিত থাকে। আপনি যেকোনো সময় এক্সটেনশনটি মুছে
              ফেললে এই তথ্যগুলো স্বয়ংক্রিয়ভাবে মুছে যায়।
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              ৪. অ্যানোনিমাস ওয়েবসাইট ট্র্যাকিং
            </h2>
            <p>
              শুধুমাত্র আমাদের ল্যান্ডিং পেজের কার্যকারিতা ও ভিজিটর সংখ্যা পর্যবেক্ষণের জন্য
              ব্রাউজার টাইপ ও স্ক্রিন রেজোলিউশনের মতো কিছু সাধারণ অ্যানোনিমাস (নামহীন) টেকনিক্যাল
              ডেটা প্রসেস করা হয়। এতে কোনো ব্যক্তিগত পরিচয়যুক্ত তথ্য থাকে না।
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">৫. যোগাযোগ</h2>
            <p>
              প্রাইভেসি সম্পর্কিত যেকোনো জিজ্ঞাসা বা সহায়তার জন্য সরাসরি আমাদের সাথে যোগাযোগ করতে
              পারেন:
            </p>
            <p className="font-semibold text-primary">
              WhatsApp:{" "}
              <a
                href="https://wa.me/meetrifat.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                wa.me/meetrifat.ai
              </a>
              <br />
              Facebook:{" "}
              <a
                href="https://www.facebook.com/meetrifat"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                facebook.com/meetrifat
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Railway Auto-Booker. All rights reserved.</span>
          <Link to="/terms" className="hover:text-foreground underline">
            টার্মস অব সার্ভিস
          </Link>
        </div>
      </main>
    </div>
  );
}
