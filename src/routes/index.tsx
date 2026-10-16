import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
  Maximize,
  Menu,
  MessageCircle,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Train,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Button3D, button3dClass } from "@/components/ui/button-3d";

export const Route = createFileRoute("/")({
  component: RailwayAutoBookerLandingPage,
});

/** Shared focus-ring class — visible only on keyboard focus. */
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Official Contact URLs */
const WHATSAPP_USERNAME = "meetrifat.ai";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_USERNAME}?text=${encodeURIComponent("আসসালামু আলাইকুম! আমি BD Railway Auto-Booker এক্সটেনশনটির সাবস্ক্রিপশন নিতে চাই।")}`;
const FACEBOOK_LINK = "https://www.facebook.com/meetrifat";

function BrandWordmark({
  className = "",
  iconSize = "h-8 w-8",
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
        alt="Railway Auto-Booker"
        className={`${iconSize} rounded-[8px] object-cover shrink-0 shadow-xs border border-primary/20`}
      />
      <span className={`font-bold tracking-tight text-foreground ${textSize}`}>
        Railway <span className="text-primary">Auto-Booker</span>
      </span>
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

const SHARED_BENEFITS = [
  "সকাল ৮:০০ ও দুপুর ২:০০ টার রাশ আওয়ার টিকিট অটো-বুকিং",
  "কম্পিউটার (Chrome, Edge, Brave) ও মোবাইল (Kiwi) সাপোর্ট",
  "পছন্দের বগি ও সিট রেঞ্জ অনুযায়ী অটোমেটিক সিট সিলেকশন",
  "স্বয়ংক্রিয়ভাবে যাত্রীর তথ্য পূরণ ও ওটিপি পেজে রিডাইরেক্ট",
  "বাংলাদেশ রেলওয়ের সকল আন্তঃনগর ট্রেনের জন্য কার্যকর",
  "লাইসেন্স কি অ্যাক্টিভেশন ও তাৎক্ষণিক ইনস্টলেশন সহায়তা",
];

const SHORT_TERM_PLANS = [
  {
    id: "3-days",
    name: "৩ দিনের পাস",
    badge: "টেস্ট / ১টি ট্রিপ",
    price: "৳ ৭৯",
    period: "৩ দিনের জন্য ভ্যালিড",
    subtitle: "টেস্ট করার জন্য বা ১টি ট্রিপের টিকিট কাটার জন্য উপযুক্ত",
    isPopular: false,
  },
  {
    id: "7-days",
    name: "৭ দিনের পাস",
    badge: "যাওয়া ও আসার টিকিট",
    price: "৳ ১৪৯",
    period: "৭ দিনের জন্য ভ্যালিড",
    subtitle: "এক সপ্তাহে যাওয়া ও আসার টিকিট নিশ্চিন্তে কাটুন",
    isPopular: false,
  },
  {
    id: "15-days",
    name: "১৫ দিনের পাস",
    badge: "শর্ট-টার্ম ট্রিপ",
    price: "৳ ১৯৯",
    period: "১৫ দিনের জন্য ভ্যালিড",
    subtitle: "স্বল্পমেয়াদী একাধিক ভ্রমণের জন্য সুবিধাজনক",
    isPopular: false,
  },
];

const REGULAR_PLANS = [
  {
    id: "30-days",
    name: "৩০ দিন (১ মাস)",
    badge: "🔥 মোস্ট পপুলার / বেস্ট ভ্যালু",
    price: "৳ ২৪৯",
    period: "১ মাসের ভ্যালিডিটি",
    subtitle: "সবচেয়ে জনপ্রিয় প্যাকেজ — নিয়মিত ভ্রমণকারীদের সেরা পছন্দ",
    isPopular: true,
  },
  {
    id: "90-days",
    name: "৯০ দিন (৩ মাস)",
    badge: "Save ৳১৫০",
    price: "৳ ৫৯৯",
    period: "৩ মাসের ভ্যালিডিটি",
    subtitle: "দীর্ঘমেয়াদী ট্রিপ ও ফ্যামিলি টিকিটের জন্য সেরা সাশ্রয়ী",
    isPopular: false,
  },
  {
    id: "180-days",
    name: "১৮০ দিন (৬ মাস)",
    badge: "Save ৳৫০০",
    price: "৳ ৯৯৯",
    period: "৬ মাসের ভ্যালিডিটি",
    subtitle: "অর্ধবার্ষিক প্যাকেজ — প্রতি মাসে ব্যাপক সাশ্রয়",
    isPopular: false,
  },
  {
    id: "365-days",
    name: "১ বছর (৩৬৫ দিন)",
    badge: "ভিআইপি মেম্বারশিপ",
    price: "৳ ১,৭৯৯",
    period: "১ বছরের ভ্যালিডিটি",
    subtitle: "সারা বছর আনলিমিটেড টিকিট কাটার ফুল ভিআইপি অ্যাক্সেস",
    isPopular: false,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "সকাল ৮:০০ ও দুপুর ২:০০ টার মিলি-সেকেন্ড অটো-ট্রিগার",
    body: "বাংলাদেশ রেলওয়ে সার্ভার ঘড়ির সাথে মিলিসেকেন্ড নিখুঁত সিঙ্ক। টিকিট ছাড়ার সাথে সাথে মানুষের চেয়ে ৫০ গুণ দ্রুত টিকিট সার্চ ও সিলেক্ট করে।",
  },
  {
    icon: Smartphone,
    title: "কম্পিউটার ও মোবাইল উভয় ডিভাইসে সাপোর্ট",
    body: "পিসিতে গুগল ক্রোম, এজ, ব্রেভ ব্রাউজার ছাড়াও অ্যান্ড্রয়েড মোবাইলে Kiwi Browser-এর মাধ্যমে সমান দ্রুততায় মোবাইল থেকেই টিকিট কাটতে পারবেন।",
  },
  {
    icon: Train,
    title: "স্মার্ট সিট ও বগি (Coach) অটো-সিলেকশন",
    body: "আপনার পছন্দের ক্লাস (Snigdha, S_CHAIR, AC), বগি এবং সিট রেঞ্জ (যেমন ২০-৫০) দিয়ে রাখলে পরিবারের জন্য এক সারির খালি সিট স্বয়ংক্রিয়ভাবে লক করে।",
  },
  {
    icon: Clock,
    title: "অটো ওটিপি ও দ্রুত পেমেন্ট পেজ জাম্প",
    body: "যাত্রীর নাম, বয়স ও তথ্য স্বয়ংক্রিয়ভাবে টাইপ করে সেকেন্ডের মধ্যে ওটিপি পেজে নিয়ে যায়, যাতে বিকাশ/নগদে পেমেন্ট করে দ্রুত কনফার্ম করা যায়।",
  },
  {
    icon: ShieldCheck,
    title: "১০০% লোকাল, প্রাইভেট ও নিরাপদ",
    body: "সম্পূর্ণ ব্রাউজারের ভেতর লোকালভাবে কাজ করে। আপনার কোনো পাসওয়ার্ড, তথ্য বা ওটিপি কোনো সার্ভারে পাঠানো হয় না। সম্পূর্ণ নিরাপদ।",
  },
  {
    icon: RotateCcw,
    title: "ফেইলসেফ ব্যাকআপ ও অ্যান্টি-ব্যান প্রযুক্তি",
    body: "পছন্দের সিট খালি না থাকলে সাথে সাথে অন্য খালি সিট সিলেক্ট করার ব্যাকআপ অপশন রয়েছে। সাথে আছে হিউম্যানাইজড টাইম ডিলে যা আইপি ব্লক প্রতিরোধ করে।",
  },
];

const PC_INSTALL_STEPS = [
  {
    step: "১",
    title: "ফাইলটি আনজিপ (Unzip) করুন",
    details: [
      "ডাউনলোড করা 'Railway Auto Booker.zip' ফাইলের ওপর মাউসের রাইট ক্লিক করুন।",
      "'Extract All...' বা 'Extract to Railway Auto Booker' অপশনে ক্লিক করে ফোল্ডারটি আনজিপ করুন।",
      "আনজিপ করার পর ভেতরে থাকা মূল এক্সটেনশন ফাইলগুলোর ফোল্ডারটি দেখতে পাবেন।",
    ],
  },
  {
    step: "২",
    title: "ক্রোম বা ব্রাউজারের এক্সটেনশন পেজে যান",
    details: [
      "কম্পিউটারে Google Chrome, Edge, Brave বা Opera ব্রাউজার ওপেন করুন।",
      "ব্রাউজারের অ্যাড্রেস বারে লিখুন: chrome://extensions এবং Enter চাপুন।",
      "(অথবা ব্রাউজারের উপরে ডান পাশে থাকা ৩-ডট মেনু > Extensions > Manage Extensions-এ যান)।",
    ],
  },
  {
    step: "৩",
    title: "Developer Mode চালু করুন",
    details: [
      "Extensions পেজের উপরে ডান কোনায় 'Developer mode' নামের একটি সুইচ/টগল বাটন দেখতে পাবেন।",
      "টগল বাটনটিতে ক্লিক করে এটি চালু (ON) করে দিন।",
    ],
  },
  {
    step: "৪",
    title: "এক্সটেনশনটি ব্রাউজারে লোড করুন (Load unpacked)",
    details: [
      "Extensions পেজের উপরে বাম পাশে থাকা 'Load unpacked' বাটনে ক্লিক করুন।",
      "একটি ফাইল উইন্ডো ওপেন হবে, সেখান থেকে ধাপ ১-এ আনজিপ করা ফোল্ডারটি সিলেক্ট করে 'Select Folder' বাটনে ক্লিক করুন।",
      "সাথে সাথে BD Railway Auto-Booker এক্সটেনশনটি আপনার ব্রাউজারে সফলভাবে ইনস্টল হয়ে যাবে!",
    ],
  },
  {
    step: "৫",
    title: "এক্সটেনশনটি পিন করুন ও লাইসেন্স কি দিয়ে অ্যাক্টিভ করুন",
    details: [
      "ব্রাউজারের উপরে ডান পাশে পাজল আইকনে (🧩 Extensions Icon) ক্লিক করে পিন (📌 Pin) আইকনে চাপুন, যাতে ট্রেনের লোগোটি সবসময় সামনে দেখা যায়।",
      "এবার ট্রেনের লোগোতে ক্লিক করলে সাইডপ্যানেল ওপেন হবে। আমাদের থেকে পাওয়া লাইসেন্স কি-টি 'Enter License Key' বক্সে বসিয়ে 'Activate Key' বাটনে চাপুন।",
      "স্ট্যাটাস 'ACTIVE' হয়ে যাবে! এখন eticket.railway.gov.bd ওয়েবসাইটে গিয়ে সকাল ৮:০০ টায় নিমেষেই টিকিট কাটুন।",
    ],
  },
];

const MOBILE_INSTALL_STEPS = [
  {
    step: "১",
    title: "প্লে-স্টোর থেকে Kiwi Browser ইনস্টল করুন",
    details: [
      "সাধারণ Chrome মোবাইল অ্যাপে ব্রাউজার এক্সটেনশন সাপোর্ট করে না, তাই প্রথমে আপনার অ্যান্ড্রয়েড ফোনে Google Play Store ওপেন করুন।",
      "সার্চ বারে 'Kiwi Browser' লিখে সার্চ করুন এবং অ্যাপটি ফোনে ইনস্টল করে ওপেন করুন।",
      "(Kiwi Browser ক্রোম ইঞ্জিনে তৈরি এবং এতে কম্পিউটার এক্সটেনশন স্মুথলি চলে)।",
    ],
  },
  {
    step: "২",
    title: "জিপ ফাইলটি ফোনে আনজিপ (Extract) করুন",
    details: [
      "আমাদের পাঠানো 'Railway Auto Booker.zip' ফাইলটি আপনার ফোনে ডাউনলোড করুন।",
      "আপনার ফোনের File Manager (ফাইল ম্যানেজার) বা ZArchiver অ্যাপ ব্যবহার করে জিপ ফাইলটি 'Extract' বা 'Unzip' করে একটি ফোল্ডারে রাখুন।",
      "ফোল্ডারটির অবস্থান মনে রাখুন যাতে ব্রাউজার থেকে সহজে সিলেক্ট করতে পারেন।",
    ],
  },
  {
    step: "৩",
    title: "Kiwi Browser-এ Extensions মেনু ওপেন করুন",
    details: [
      "ফোনে Kiwi Browser অ্যাপটি ওপেন করুন।",
      "ব্রাউজারের উপরে ডানদিকের ৩-ডট (⋮) মেনু আইকনে ট্যাপ করুন।",
      "মেনুর তালিকা থেকে 'Extensions' (এক্সটেনশনস) অপশনটিতে ট্যাপ করুন।",
    ],
  },
  {
    step: "৪",
    title: "Developer Mode অন করে এক্সটেনশনটি লোড করুন",
    details: [
      "Extensions পেজের উপরে থাকা 'Developer mode' অপশনটি ট্যাপ করে অন (ON) করুন।",
      "এবার উপরে থাকা '+(from .zip / .crx / folder)' বাটনে ট্যাপ করুন।",
      "আপনার ফাইল ম্যানেজার থেকে ধাপ ২-এ আনজিপ করা ফোল্ডারটি সিলেক্ট করুন। সাথে সাথে এক্সটেনশনটি ইনস্টল হয়ে যাবে!",
    ],
  },
  {
    step: "৫",
    title: "অটো-বুকার ওপেন করে লাইসেন্স দিয়ে টিকিট কাটুন",
    details: [
      "Kiwi Browser-এর উপরে ৩-ডট (⋮) মেনুতে ট্যাপ করে স্ক্রল করে একদম নিচে নামুন।",
      "তালিকার একদম নিচে 'Railway Auto Booker' দেখতে পাবেন, সেটিতে ট্যাপ করুন (সাইডপ্যানেল ওপেন হবে)।",
      "আপনার লাইসেন্স কি বসিয়ে 'Activate Key' দিন। এরপর Kiwi Browser-এই eticket.railway.gov.bd তে লগইন করে টিকিট বুক করুন!",
    ],
  },
];

const DEFAULT_VIDEO_DURATION = 35.8;

function formatVideoTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function CleanVideoPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(DEFAULT_VIDEO_DURATION);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [flashFeedback, setFlashFeedback] = useState<"play" | "pause" | null>(null);

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync video duration & state on mount and video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncDuration = () => {
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      } else {
        setDuration(DEFAULT_VIDEO_DURATION);
      }
    };

    if (video.readyState >= 1) {
      syncDuration();
    }

    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("canplay", syncDuration);

    return () => {
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("canplay", syncDuration);
    };
  }, []);

  const triggerFlash = (type: "play" | "pause") => {
    setFlashFeedback(type);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashFeedback(null);
    }, 450);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.ended || isEnded) {
      video.currentTime = 0;
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsEnded(false);
          triggerFlash("play");
        })
        .catch(() => {});
    } else if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsEnded(false);
          triggerFlash("play");
        })
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
      triggerFlash("pause");
    }
  };

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (isPlaying && !isDragging) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, isDragging]);

  const handleUserActivity = () => {
    resetHideTimer();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !isDragging) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 600);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    }
  };

  const handleProgress = () => {
    const video = videoRef.current;
    const dur =
      video && video.duration && isFinite(video.duration) && video.duration > 0
        ? video.duration
        : duration;
    if (video && video.buffered.length > 0 && dur > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBufferedPercent(Math.min(100, (bufferedEnd / dur) * 100));
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setIsEnded(true);
    setShowControls(true);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted || volume === 0) {
      const restoreVol = volume === 0 ? 1 : volume;
      video.muted = false;
      video.volume = restoreVol;
      setIsMuted(false);
      setVolume(restoreVol);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const video = videoRef.current;
    if (video) {
      video.volume = newVol;
      const muted = newVol === 0;
      setIsMuted(muted);
      video.muted = muted;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const seekToClientX = (clientX: number) => {
    const video = videoRef.current;
    const scrubBar = scrubBarRef.current;
    if (!video || !scrubBar) return;
    const rect = scrubBar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickPos = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percentage = clickPos / rect.width;
    const totalDuration =
      video.duration && isFinite(video.duration) && video.duration > 0
        ? video.duration
        : duration;
    const targetTime = Math.max(0, Math.min(totalDuration, percentage * totalDuration));
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleScrubMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    seekToClientX(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    if (e.touches[0]) {
      seekToClientX(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isDragging && e.touches[0]) {
      seekToClientX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleScrubMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubBarRef.current) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pos = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setHoverX(pos);
    const totalDuration =
      videoRef.current &&
      videoRef.current.duration &&
      isFinite(videoRef.current.duration) &&
      videoRef.current.duration > 0
        ? videoRef.current.duration
        : duration;
    setHoverTime((pos / rect.width) * totalDuration);
  };

  const handleScrubMouseLeave = () => {
    setHoverTime(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        seekToClientX(e.clientX);
      }
    };
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, duration]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
      }
    }
  };

  const effectiveDuration = duration > 0 ? duration : DEFAULT_VIDEO_DURATION;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  return (
    <div className="relative mx-auto max-w-4xl group/player select-none">
      {/* Subtle ambient emerald glow behind frame */}
      <div
        className="pointer-events-none absolute -inset-1 sm:-inset-1.5 rounded-[28px] bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-600/20 blur-xl opacity-75 transition-opacity duration-700 group-hover/player:opacity-100"
        aria-hidden="true"
      />

      {/* Premium Outer Gradient Border Frame */}
      <div className="relative rounded-[22px] sm:rounded-[26px] p-[2.5px] sm:p-[3px] bg-gradient-to-b from-primary/70 via-border/90 to-primary/35 shadow-[0_20px_50px_-12px_rgba(5,150,105,0.22)] transition-all duration-500 hover:shadow-[0_28px_65px_-10px_rgba(5,150,105,0.32)]">
        {/* Inner Video Container (can go Fullscreen) */}
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseMove={handleUserActivity}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={handleMouseLeave}
          className="relative overflow-hidden rounded-[19.5px] sm:rounded-[23px] bg-black aspect-video group/frame focus:outline-none"
        >
          {/* Main Video Element — direct src for instant metadata loading */}
          <video
            ref={videoRef}
            src="/railway-demo.mp4"
            playsInline
            preload="metadata"
            poster="/railway-thumbnail.png"
            className="w-full h-full object-cover bg-black block cursor-pointer"
            onClick={togglePlay}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            onEnded={handleEnded}
            onPlay={() => {
              setIsPlaying(true);
              setIsEnded(false);
            }}
            onPause={() => setIsPlaying(false)}
          >
            আপনার ব্রাউজার ভিডিও প্লে করতে সমর্থন করে না।
          </video>

          {/* Video Thumbnail Overlay (visible before first play) */}
          {!isPlaying && currentTime === 0 && !isEnded && (
            <img
              src="/railway-thumbnail.png"
              alt="Railway Auto-Booker Video Thumbnail"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[2] select-none"
            />
          )}

          {/* Center Play/Pause Flash Animation on Video Click */}
          {flashFeedback && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-black/70 backdrop-blur-md border border-white/25 text-white flex items-center justify-center shadow-2xl transition-all scale-110">
                {flashFeedback === "play" ? (
                  <Play className="h-8 w-8 ml-1 fill-white text-white drop-shadow" />
                ) : (
                  <Pause className="h-8 w-8 fill-white text-white drop-shadow" />
                )}
              </div>
            </div>
          )}

          {/* Big Center Play Button Overlay when Paused */}
          {!isPlaying && !isEnded && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1.5px] transition-all duration-300 cursor-pointer group-hover/frame:bg-black/25 z-10"
              role="button"
              tabIndex={-1}
              aria-label="ভিডিও চালু করুন"
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute -inset-2.5 sm:-inset-3 rounded-full bg-emerald-500/35 blur-md animate-pulse" />
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.55)] ring-4 ring-white/25 transition-transform duration-300 hover:scale-110 active:scale-95">
                  <Play className="h-8 w-8 sm:h-10 sm:w-10 ml-1 fill-white text-white drop-shadow" />
                </div>
              </div>
            </div>
          )}

          {/* Big Center Replay Button Overlay when Ended */}
          {isEnded && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300 cursor-pointer z-10"
              role="button"
              tabIndex={-1}
              aria-label="ভিডিও আবার চালু করুন"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <span className="absolute -inset-2.5 sm:-inset-3 rounded-full bg-emerald-500/40 blur-md animate-pulse" />
                  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.6)] ring-4 ring-white/25 transition-transform duration-300 hover:scale-110 active:scale-95">
                    <RotateCcw className="h-8 w-8 sm:h-9 sm:w-9 text-white drop-shadow" />
                  </div>
                </div>
                <span className="text-white text-sm sm:text-base font-bold drop-shadow tracking-wide">
                  আবার দেখুন
                </span>
              </div>
            </div>
          )}

          {/* Clean Integrated Video Controls Bar (NO box, NO bg card, NO 1080p text) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-x-0 bottom-0 z-20 px-3 sm:px-5 pb-2.5 sm:pb-3.5 pt-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex flex-col justify-end transition-all duration-300 ${
              showControls || !isPlaying
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-2 pointer-events-none"
            }`}
          >
            {/* Custom Interactive Scrubber / Seekbar */}
            <div
              ref={scrubBarRef}
              onMouseDown={handleScrubMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseMove={handleScrubMouseMove}
              onMouseLeave={handleScrubMouseLeave}
              className="relative h-5 w-full flex items-center cursor-pointer group/scrub"
            >
              {/* Hover Time Tooltip */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 border border-white/20 text-[10px] font-mono text-white pointer-events-none shadow-md z-30"
                  style={{ left: `${hoverX}px` }}
                >
                  {formatVideoTime(hoverTime)}
                </div>
              )}

              {/* Track Background */}
              <div className="h-1 sm:h-1.5 w-full rounded-full bg-white/25 group-hover/scrub:h-2 transition-all relative overflow-hidden">
                {/* Buffer progress bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all"
                  style={{ width: `${bufferedPercent}%` }}
                />
                {/* Played progress bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Glowing Thumb Knob */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-white shadow-[0_0_10px_rgba(16,185,129,0.9)] ring-2 ring-emerald-400 scale-0 group-hover/scrub:scale-100 transition-transform duration-150 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Left Group: Play/Pause, Volume, Time */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                {/* Play/Pause Button */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg text-white hover:text-emerald-400 active:scale-95 transition-all focus:outline-none"
                  aria-label={isPlaying ? "বিরতি দিন (Pause)" : "চালু করুন (Play)"}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-white text-white drop-shadow" />
                  ) : (
                    <Play className="h-5 w-5 fill-white text-white ml-0.5 drop-shadow" />
                  )}
                </button>

                {/* Volume Button + Expanding Slider */}
                <div className="group/vol flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg text-white hover:text-emerald-400 active:scale-95 transition-all focus:outline-none"
                    aria-label={isMuted || volume === 0 ? "আনমিউট করুন" : "মিউট করুন"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5 text-red-400 drop-shadow" />
                    ) : (
                      <Volume2 className="h-5 w-5 text-white drop-shadow" />
                    )}
                  </button>

                  <div className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 transition-all duration-200 overflow-hidden flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-20 h-1 sm:h-1.5 accent-emerald-400 bg-white/30 rounded-lg cursor-pointer"
                      aria-label="ভলিউম নিয়ন্ত্রণ"
                    />
                  </div>
                </div>

                {/* Clean Time Display: 0:07 / 0:35 */}
                <div className="font-mono text-xs sm:text-[13px] text-white/90 font-medium tracking-wider flex items-center gap-1.5 select-none drop-shadow">
                  <span className="text-white font-semibold">{formatVideoTime(currentTime)}</span>
                  <span className="text-white/50">/</span>
                  <span className="text-white/80">{formatVideoTime(effectiveDuration)}</span>
                </div>
              </div>

              {/* Right Group: Fullscreen */}
              <div className="flex items-center">
                {/* Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg text-white hover:text-emerald-400 active:scale-95 transition-all focus:outline-none"
                  aria-label={isFullscreen ? "ফুলস্ক্রিন থেকে প্রস্থান" : "ফুলস্ক্রিন"}
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5 text-white drop-shadow" />
                  ) : (
                    <Maximize className="h-5 w-5 text-white drop-shadow" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RailwayAutoBookerLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [installTab, setInstallTab] = useState<"pc" | "mobile">("pc");

  const navLinks = [
    { href: "#pricing", label: "সাবস্ক্রিপশন প্ল্যান" },
    { href: "#video-demo", label: "ভিডিও ডেমো" },
    { href: "#features", label: "ফিচারসমূহ" },
    { href: "#install", label: "ইনস্টলেশন গাইড" },
    { href: "#contact", label: "যোগাযোগ ও ক্রয়" },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground font-sans antialiased">
      {/* Top sticky navigation bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between px-5 sm:px-6 md:h-[72px] md:px-8">
          <a
            href="/"
            aria-label="Railway Auto-Booker — হোম"
            className={"inline-flex items-center leading-none rounded-lg " + focusRing}
          >
            <BrandWordmark iconSize="h-8 w-8 sm:h-9 sm:w-9" textSize="text-xl sm:text-2xl" />
          </a>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex lg:gap-8">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={"transition-colors hover:text-foreground font-medium text-[15px] " + focusRing}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Header Action Button */}
          <div className="hidden md:flex items-center gap-3">
            <a href="#pricing" className={button3dClass("sm", `gap-1.5 font-medium ${focusRing}`)}>
              <span>প্যাকেজ দেখুন</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            aria-label={menuOpen ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className={
              "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-[color:var(--surface)] md:hidden " +
              focusRing
            }
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
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
                      "flex min-h-11 items-center rounded-md px-3 text-base font-medium text-foreground/90 transition-colors hover:bg-[color:var(--surface)] " +
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
                className={button3dClass("md", "w-full justify-center text-sm")}
              >
                প্যাকেজ ও মূল্য তালিকা
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 sm:px-6 md:px-8">
        {/* HERO SECTION */}
        <section className="pt-12 pb-14 sm:pt-16 sm:pb-18 md:pt-20 md:pb-22">
          <div className="mx-auto max-w-3xl text-center">
            {/* Animated Pill Badge */}
            <div className="hero-pill mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-foreground/90 shadow-xs">
              <span
                className="h-2 w-2 rounded-full bg-primary"
                style={{ animation: "pill-dot 2.4s cubic-bezier(0.4,0,0.6,1) infinite" }}
                aria-hidden
              />
              <span className="tracking-tight text-emerald-800 dark:text-emerald-300">
                eticket.railway.gov.bd এর জন্য দ্রুততম অটোমেশন · সকাল ৮:০০ টার টিকিট নিশ্চিন্তে কাটুন
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-balance text-[clamp(2.15rem,6.5vw,3.85rem)] font-bold leading-[1.22] tracking-tight">
              বাংলাদেশ রেলওয়ের ট্রেনের টিকিট কাটুন
              <br />
              <span className="text-primary bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 bg-clip-text text-transparent">
                মিলিসেকেন্ডে, সম্পূর্ণ অটোমেটিক!
              </span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-[17px] md:text-lg">
              সহজ ও সুপারফাস্ট ব্রাউজার এক্সটেনশন—যা সকাল ৮:০০ টা ও দুপুর ২:০০ টার টিকিট ছাড়ার মুহূর্তে সার্ভার স্পিডে স্বয়ংক্রিয়ভাবে স্টেশন সার্চ, বগি ও সিট সিলেক্ট করে ওটিপি ও পেমেন্ট পেজে নিয়ে যায়। কম্পিউটার ও মোবাইল উভয় ডিভাইসেই ব্যবহারযোগ্য!
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex w-full flex-col items-stretch gap-3.5 sm:mt-10 sm:flex-row sm:items-center sm:justify-center">
              <a
                href="#pricing"
                className={button3dClass(
                  "lg",
                  "w-full sm:w-auto min-h-12 gap-2 text-base shadow-md font-semibold",
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>সাবস্ক্রিপশন প্যাকেজসমূহ দেখুন</span>
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
                <span>ভিডিও ডেমো দেখুন</span>
              </a>
            </div>

          </div>
        </section>

        {/* CLEAN VIDEO BOX SECTION (Dedicated Video Player Spot) */}
        <section id="video-demo" className="pb-16 sm:pb-20 md:pb-24 scroll-mt-24">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                <Play className="h-3 w-3 fill-primary" />
                <span>লাইভ প্র্যাকটিক্যাল ডেমো</span>
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
                ভিডিওতে দেখুন কীভাবে কাজ করে
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                সকাল ৮:০০ টায় কীভাবে চোখের পলকে অটোমেটিকভাবে টিকিট কনফার্ম হয় তা সরাসরি দেখুন।
              </p>
            </div>

            {/* Video Box Container */}
            <CleanVideoPlayer />
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="mb-10 max-w-2xl sm:mb-14">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1 text-xs font-bold text-primary mb-3">
              <Zap className="h-3.5 w-3.5" />
              <span>শক্তিশালী অটোমেশন ফিচারসমূহ</span>
            </div>
            <h2 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
              ম্যানুয়ালি টিকিট কাটার চেয়ে অটো-বুকার কেন বেশি কার্যকর?
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
              সকাল ৮:০০ টায় টিকিট সার্ভার ওপেন হওয়ার মুহূর্তে ম্যানুয়ালি ক্লিক করতে করতে সিট শেষ হয়ে যায়। অটো-বুকার প্রতিটি ধাপ স্বয়ংক্রিয়ভাবে দ্রুত সম্পন্ন করে আপনার টিকিট পাওয়ার সুযোগ নিশ্চিত করে।
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const IconComp = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-border bg-[color:var(--surface)] p-6 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <IconComp className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-foreground">
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1 text-xs font-semibold text-primary mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>সহজ ও সাশ্রয়ী সাবস্ক্রিপশন প্ল্যান</span>
            </div>
            <h2 className="text-[clamp(1.85rem,4.5vw,2.75rem)] font-bold tracking-tight">
              BD Railway Auto-Booker এর সাবস্ক্রিপশন প্ল্যানসমূহ
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              সব প্যাকেজেই সব ফিচার সমানভাবে অন্তর্ভুক্ত। শুধু আপনার প্রয়োজন অনুযায়ী মেয়াদের প্যাকেজটি বেছে নিন।
            </p>
          </div>

          {/* PART 1: REGULAR & LONG TERM PACKAGES (MOST POPULAR) */}
          <div className="mb-14">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-border">
              <span className="text-amber-500 font-bold text-lg">⭐</span>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                রেগুলার ও লং-টার্ম প্যাকেজ (সবচেয়ে জনপ্রিয়)
              </h3>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
              {REGULAR_PLANS.map((plan) => (
                <BanglaPricingCard key={plan.id} plan={plan} />
              ))}
            </div>
          </div>

          {/* PART 2: TRIAL & SHORT TERM PLANS */}
          <div>
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-border">
              <span className="text-blue-500 font-bold text-lg">🚀</span>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                ট্রায়াল ও শর্ট-টার্ম প্ল্যান
              </h3>
            </div>

            <div className="grid gap-6 md:grid-cols-3 items-stretch">
              {SHORT_TERM_PLANS.map((plan) => (
                <BanglaPricingCard key={plan.id} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        {/* INSTALLATION GUIDE SECTION */}
        <section id="install" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-12">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1 text-xs font-bold text-primary mb-3">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>সহজ ইনস্টলেশন নির্দেশিকা</span>
              </div>
              <h2 className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
                মাত্র ২ মিনিটে এক্সটেনশনটি সেটআপ করে নিন
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                কম্পিউটারে গুগল ক্রোম ব্রাউজার অথবা অ্যান্ড্রয়েড মোবাইলে Kiwi Browser ব্যবহার করে সহজেই সেটআপ করতে পারবেন।
              </p>
            </div>

            {/* Interactive Tab Switcher for PC vs Android Mobile */}
            <div className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setInstallTab("pc")}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer ${focusRing} ${
                  installTab === "pc"
                    ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02] border border-primary"
                    : "border border-border/80 bg-[color:var(--surface)] text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Laptop className={`h-4 w-4 ${installTab === "pc" ? "text-white" : "text-primary"}`} />
                <span>কম্পিউটার (Google Chrome, Edge, Brave, Opera)</span>
              </button>

              <button
                type="button"
                onClick={() => setInstallTab("mobile")}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer ${focusRing} ${
                  installTab === "mobile"
                    ? "bg-primary text-white shadow-md shadow-primary/20 scale-[1.02] border border-primary"
                    : "border border-border/80 bg-[color:var(--surface)] text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Smartphone className={`h-4 w-4 ${installTab === "mobile" ? "text-white" : "text-primary"}`} />
                <span>অ্যান্ড্রয়েড মোবাইল (Kiwi Browser)</span>
              </button>
            </div>

            {/* Beginner guidance notice based on selected tab */}
            {installTab === "mobile" ? (
              <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:p-5 text-xs sm:text-sm text-foreground flex items-start gap-3 shadow-2xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs mt-0.5">
                  📱
                </span>
                <p className="leading-relaxed">
                  <strong>মোবাইল ব্যবহারকারীদের জন্য নির্দেশনা:</strong> মোবাইলের সাধারণ গুগল ক্রোম অ্যাপে এক্সটেনশন চলে না। তাই অ্যান্ড্রয়েডে টিকিট কাটতে প্লে-স্টোর থেকে সম্পূর্ণ ফ্রি <strong>Kiwi Browser</strong> ইনস্টল করতে হবে। নিচে নতুনদের জন্য খুব সহজ ভাষায় ৫টি ধাপ দেওয়া হলো:
                </p>
              </div>
            ) : (
              <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-xs sm:text-sm text-foreground flex items-start gap-3 shadow-2xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs mt-0.5">
                  💻
                </span>
                <p className="leading-relaxed">
                  <strong>কম্পিউটার ব্যবহারকারীদের জন্য নির্দেশনা:</strong> Google Chrome, Microsoft Edge, Brave বা Opera ব্রাউজারে মাত্র ২ মিনিটে নিচের ৫টি সহজ ধাপ অনুসরণ করে এক্সটেনশনটি সেটআপ করে নিতে পারবেন:
                </p>
              </div>
            )}

            {/* Steps list */}
            <div className="space-y-4">
              {(installTab === "pc" ? PC_INSTALL_STEPS : MOBILE_INSTALL_STEPS).map((s) => (
                <div
                  key={s.step}
                  className="rounded-2xl border border-border bg-[color:var(--surface)] p-5 sm:p-6 transition-all hover:border-primary/40 shadow-xs"
                >
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-sm shadow-xs">
                      {s.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-foreground">{s.title}</h3>
                      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
                        {s.details.map((detail, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-1 font-bold">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEDICATED CONTACT & PURCHASE SECTION */}
        <section id="contact" className="border-t border-border py-14 sm:py-16 md:py-20 scroll-mt-20">
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 via-[color:var(--surface)] to-background p-8 sm:p-12 md:p-14 text-center max-w-4xl mx-auto shadow-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3.5 py-1 text-xs font-bold text-primary">
              <MessageCircle className="h-4 w-4" />
              <span>তাৎক্ষণিক লাইসেন্স ডেলিভারি ও সাপোর্ট</span>
            </span>

            <h2 className="mt-4 text-balance text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight">
              আপনার ট্রেনের টিকিট এখনই সহজে ও দ্রুত কনফার্ম করুন
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
              পছন্দের প্যাকেজটি নিতে বা যেকোনো তথ্যের জন্য সরাসরি আমাদের হোয়াটসঅ্যাপ বা ফেসবুক মেসেঞ্জারে যোগাযোগ করুন। পেমেন্ট সম্পন্ন করার পর সাথে সাথে লাইসেন্স কি ও সেটআপ ফাইল প্রদান করা হবে।
            </p>

            {/* Highly Polished WhatsApp and Facebook Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-whatsapp w-full sm:flex-1 min-h-13 inline-flex items-center justify-center gap-2.5 rounded-xl px-5 sm:px-6 py-3.5 text-sm sm:text-base font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
              >
                <WhatsAppIcon className="h-5 w-5 shrink-0" />
                <span>WhatsApp এ মেসেজ দিন</span>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
              </a>

              <a
                href={FACEBOOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-3d-facebook w-full sm:flex-1 min-h-13 inline-flex items-center justify-center gap-2.5 rounded-xl px-5 sm:px-6 py-3.5 text-sm sm:text-base font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
              >
                <FacebookIcon className="h-5 w-5 shrink-0" />
                <span>Facebook এ যোগাযোগ করুন</span>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
              </a>
            </div>
          </div>
        </section>

        {/* OFFICIAL DISCLAIMER SECTION */}
        <section className="border-t border-border py-10 sm:py-12 bg-muted/20 rounded-2xl my-8 p-6 sm:p-8">
          <div className="max-w-3xl mx-auto">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>ডিসক্লেইমার / Disclaimer</span>
            </h4>
            <ol className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed list-decimal list-inside">
              <li>এই এক্সটেনশনটি ব্যবহারকারীদের টিকিট খোঁজা ও সিট নির্বাচন প্রক্রিয়া দ্রুততর করার জন্য তৈরি একটি সহায়ক টুল।</li>
              <li>টিকিটের প্রাপ্যতা সম্পূর্ণভাবে বাংলাদেশ রেলওয়ের (eticket.railway.gov.bd) অফিশিয়াল সার্ভারের ওপর নির্ভরশীল।</li>
              <li>পেমেন্ট সম্পন্ন করা এবং মোবাইল ওটিপি (OTP) সাবমিট করার দায়িত্ব ব্যবহারকারীর নিজস্ব।</li>
              <li>এই সফটওয়্যারটি বাংলাদেশ রেলওয়ের কোনো অফিশিয়াল সেবা নয়, এটি একটি স্বাধীন অটোমেশন অ্যাসিস্ট্যান্ট টুল।</li>
            </ol>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border bg-[color:var(--surface)]/70">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 md:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/railway-icon.png"
                alt="Railway Auto-Booker"
                className="h-6 w-6 rounded-md object-cover"
              />
              <span className="font-bold text-foreground text-sm">Railway Auto-Booker</span>
              <span className="text-xs text-muted-foreground">· সুপারফাস্ট রেলওয়ে টিকিট অটোমেশন</span>
            </div>

            <div className="flex items-center gap-5 text-xs font-semibold">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
              <a
                href={FACEBOOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 dark:text-blue-400"
              >
                <FacebookIcon className="h-3.5 w-3.5" />
                <span>Facebook</span>
              </a>
              <a href="#pricing" className="text-primary hover:underline">
                প্ল্যানসমূহ
              </a>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Railway Auto-Booker. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

/** BANGLA PRICING CARD COMPONENT */
function BanglaPricingCard({
  plan,
}: {
  plan: {
    id: string;
    name: string;
    badge: string;
    price: string;
    period: string;
    subtitle: string;
    isPopular: boolean;
  };
}) {
  return (
    <div
      className={
        "relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all duration-300 " +
        (plan.isPopular
          ? "border-primary bg-[color:var(--surface)] shadow-xl ring-2 ring-primary/30 md:scale-[1.03]"
          : "border-border bg-[color:var(--surface)] hover:border-primary/50 shadow-xs")
      }
    >
      {plan.isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1 text-[11px] font-bold text-white shadow-md whitespace-nowrap">
          {plan.badge}
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-lg font-bold text-foreground">{plan.name}</h4>
          {!plan.isPopular && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {plan.badge}
            </span>
          )}
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{plan.subtitle}</p>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl sm:text-[27px] xl:text-3xl font-extrabold text-foreground whitespace-nowrap shrink-0">
            {plan.price}
          </span>
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
            / {plan.period}
          </span>
        </div>

        {/* Benefits list (Same across all plans as requested) */}
        <div className="mt-5 border-t border-border/80 pt-4">
          <p className="text-xs font-bold text-muted-foreground mb-2.5">
            সকল সুবিধা অন্তর্ভুক্ত:
          </p>
          <ul className="space-y-2 text-xs">
            {SHARED_BENEFITS.map((feat) => (
              <li key={feat} className="flex items-start gap-2 text-foreground/90 leading-snug">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Upgraded, high-contrast Buy Buttons */}
      <div className="mt-6 space-y-2 pt-4 border-t border-border/80">
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-3d-whatsapp flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-xs hover:scale-102 transition-transform"
        >
          <WhatsAppIcon className="h-4 w-4" />
          <span>হোয়াটসঅ্যাপে কিনুন</span>
        </a>

        <a
          href={FACEBOOK_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-3d-facebook flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-xs hover:scale-102 transition-transform"
        >
          <FacebookIcon className="h-4 w-4" />
          <span>ফেসবুকে মেসেজ দিন</span>
        </a>
      </div>
    </div>
  );
}
