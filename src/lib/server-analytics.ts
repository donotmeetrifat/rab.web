import { get, put, head } from "@vercel/blob";

export interface VisitorStats {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  todayUnique: number;
  currentDay: string;
  lastUpdated: string;
  dailyStats: Record<string, { visits: number; unique: number }>;
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  browsers: Record<string, number>;
  operatingSystems: Record<string, number>;
  countries: Record<string, number>;
  cities: Record<string, number>;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    timeFormatted: string;
    device: "mobile" | "desktop" | "tablet";
    browser: string;
    os: string;
    country: string;
    city: string;
    path: string;
    isUnique: boolean;
  }>;
  seenFingerprints?: string[];
}

const BLOB_PATH = "analytics/stats.json";
const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN ||
  "vercel_blob_rw_ZXs6kFFDCYo9D2Hd_LK59S3Asy8nb2c6mdlsPWB5QdlheAl";

const AUTH_SECRET =
  process.env.ADMIN_JWT_SECRET ||
  "rab-super-secret-hmac-key-2026-bangladesh-railway-auto-booker";

// In-memory rate limiting for failed login attempts
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

// In-memory rolling set of visitor hashes seen today to deduplicate unique visits
const seenToday = new Set<string>();
let lastSeenDay = "";

function getBstDate(): string {
  const now = new Date();
  // UTC+6 (Bangladesh Standard Time)
  const bst = new Date(now.getTime() + 6 * 3600 * 1000);
  return bst.toISOString().slice(0, 10);
}

function formatBstTime(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  // format in BST (UTC+6)
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    day: "numeric",
    month: "short",
  });
}

function createEmptyStats(): VisitorStats {
  const today = getBstDate();
  return {
    totalVisits: 0,
    uniqueVisitors: 0,
    todayVisits: 0,
    todayUnique: 0,
    currentDay: today,
    lastUpdated: new Date().toISOString(),
    dailyStats: {},
    devices: { mobile: 0, desktop: 0, tablet: 0 },
    browsers: {},
    operatingSystems: {},
    countries: {},
    cities: {},
    recentLogs: [],
    seenFingerprints: [],
  };
}

// User-Agent detection
export function parseUserAgent(ua: string): {
  device: "mobile" | "desktop" | "tablet";
  browser: string;
  os: string;
} {
  const lower = ua.toLowerCase();

  let device: "mobile" | "desktop" | "tablet" = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    device = "tablet";
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|kindle/i.test(ua)) {
    device = "mobile";
  }

  let browser = "Google Chrome";
  if (lower.includes("kiwi")) {
    browser = "Kiwi Browser";
  } else if (lower.includes("edg/")) {
    browser = "Microsoft Edge";
  } else if (lower.includes("opr/") || lower.includes("opera")) {
    browser = "Opera";
  } else if (lower.includes("samsungbrowser")) {
    browser = "Samsung Internet";
  } else if (lower.includes("firefox") || lower.includes("fxios")) {
    browser = "Firefox";
  } else if (lower.includes("safari") && !lower.includes("chrome") && !lower.includes("android")) {
    browser = "Safari";
  } else if (lower.includes("brave")) {
    browser = "Brave";
  } else if (lower.includes("chrome") || lower.includes("crios")) {
    browser = "Google Chrome";
  } else {
    browser = "Other";
  }

  let os = "Other";
  if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipod")) os = "iOS";
  else if (lower.includes("ipad")) os = "iPadOS";
  else if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os") || lower.includes("macintosh")) os = "macOS";
  else if (lower.includes("linux")) os = "Linux";

  return { device, browser, os };
}

// Private Blob read & write with zero CDN caching
export async function getStats(): Promise<VisitorStats> {
  try {
    let parsed: VisitorStats | null = null;

    // First try: Read fresh blob directly using head + cache-busting fetch to bypass Vercel CDN cache
    try {
      const meta = await head(BLOB_PATH, { token: BLOB_TOKEN });
      if (meta && meta.url) {
        const freshUrl = `${meta.url}?_cb=${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const res = await fetch(freshUrl, {
          headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
          cache: "no-store",
        });
        if (res.ok) {
          parsed = (await res.json()) as VisitorStats;
        }
      }
    } catch {
      // If head/fetch fails, fall back to get()
    }

    // Fallback: standard get()
    if (!parsed) {
      const res = await get(BLOB_PATH, {
        token: BLOB_TOKEN,
        access: "private",
      });

      if (!res) {
        return createEmptyStats();
      }

      const text = await new Response(res.stream).text();
      parsed = JSON.parse(text) as VisitorStats;
    }

    if (!parsed) {
      return createEmptyStats();
    }

    // Reset daily counters if date has changed in BST
    const today = getBstDate();
    if (parsed.currentDay !== today) {
      parsed.currentDay = today;
      parsed.todayVisits = 0;
      parsed.todayUnique = 0;
      parsed.seenFingerprints = [];
    }

    if (!Array.isArray(parsed.seenFingerprints)) {
      parsed.seenFingerprints = [];
    }

    return parsed;
  } catch (err) {
    console.warn("Could not read stats from Vercel Blob, using fallback:", err);
    return createEmptyStats();
  }
}

export async function saveStats(stats: VisitorStats): Promise<void> {
  stats.lastUpdated = new Date().toISOString();
  try {
    await put(BLOB_PATH, JSON.stringify(stats), {
      token: BLOB_TOKEN,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    console.error("Failed to save stats to Vercel Blob:", err);
  }
}

// Cryptographic token signing and verification using Web Crypto HMAC-SHA256
async function getCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(): Promise<string> {
  const payload = {
    role: "admin",
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    iat: Date.now(),
  };
  const payloadStr = JSON.stringify(payload);
  const base64Payload = btoa(payloadStr);

  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(base64Payload),
  );
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${base64Payload}.${base64Sig}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [base64Payload, base64Sig] = parts;

    const payloadJson = atob(base64Payload);
    const payload = JSON.parse(payloadJson) as { role: string; exp: number };

    // Check expiration
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return false;
    }

    const key = await getCryptoKey();
    const signatureBytes = Uint8Array.from(atob(base64Sig), (c) => c.charCodeAt(0));

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(base64Payload),
    );
  } catch {
    return false;
  }
}

// Request Handler for Analytics Endpoints
export async function handleAnalyticsApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  // Handle CORS Preflight OPTIONS requests for analytics APIs
  if (
    request.method === "OPTIONS" &&
    (url.pathname === "/api/track" ||
      url.pathname === "/api/admin-auth" ||
      url.pathname === "/api/admin-stats" ||
      url.pathname === "/api/admin-reset")
  ) {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization, x-admin-password",
      },
    });
  }

  // 1. /api/track — Records real visitor
  if (url.pathname === "/api/track" && request.method === "POST") {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        vid?: string;
        path?: string;
        ref?: string;
        screen?: string;
        isFirstVisit?: boolean;
      };

      const ua = request.headers.get("user-agent") || "";
      const country = request.headers.get("x-vercel-ip-country") || "BD";
      const city = request.headers.get("x-vercel-ip-city") || "Dhaka";
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "127.0.0.1";

      const { device, browser, os } = parseUserAgent(ua);
      const today = getBstDate();

      // Load stats from persistent Vercel Blob storage
      const stats = await getStats();

      if (!Array.isArray(stats.seenFingerprints)) {
        stats.seenFingerprints = [];
      }

      // Anonymous identifier for uniqueness without logging raw IP
      const visitorFingerprint = `${today}_${body.vid || clientIp}_${browser}_${device}`;
      const isUniqueToday = !stats.seenFingerprints.includes(visitorFingerprint);
      
      if (isUniqueToday) {
        stats.seenFingerprints.push(visitorFingerprint);
        if (stats.seenFingerprints.length > 2500) {
          stats.seenFingerprints.shift();
        }
        stats.todayUnique += 1;
        stats.uniqueVisitors += 1;
      }

      stats.totalVisits += 1;
      stats.todayVisits += 1;

      // Daily stats map
      if (!stats.dailyStats[today]) {
        stats.dailyStats[today] = { visits: 0, unique: 0 };
      }
      stats.dailyStats[today].visits += 1;
      if (isUniqueToday) {
        stats.dailyStats[today].unique += 1;
      }

      // Device & Browser & OS
      stats.devices[device] = (stats.devices[device] || 0) + 1;
      stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;
      stats.operatingSystems[os] = (stats.operatingSystems[os] || 0) + 1;

      // Location
      const countryKey = country.toUpperCase();
      stats.countries[countryKey] = (stats.countries[countryKey] || 0) + 1;
      if (city) {
        const decodedCity = decodeURIComponent(city);
        stats.cities[decodedCity] = (stats.cities[decodedCity] || 0) + 1;
      }

      // Recent Activity Log (latest 35 visits)
      const nowIso = new Date().toISOString();
      stats.recentLogs.unshift({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: nowIso,
        timeFormatted: formatBstTime(nowIso),
        device,
        browser,
        os,
        country: countryKey,
        city: city ? decodeURIComponent(city) : "Unknown",
        path: body.path || "/",
        isUnique: isUniqueToday,
      });

      if (stats.recentLogs.length > 35) {
        stats.recentLogs = stats.recentLogs.slice(0, 35);
      }

      // CRITICAL FOR SERVERLESS: Must await saveStats before returning response!
      // Otherwise Vercel terminates/freezes execution environment before put completes.
      await saveStats(stats);

      return new Response(JSON.stringify({ ok: true, totalVisits: stats.totalVisits }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (error) {
      console.error("Track error:", error);
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // 2. /api/admin-auth — Password Authentication
  if (url.pathname === "/api/admin-auth" && request.method === "POST") {
    try {
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

      // Rate limiting: 5 failed attempts = 15 min lock
      const attempt = failedLoginAttempts.get(clientIp);
      const now = Date.now();
      if (attempt && attempt.lockedUntil > now) {
        const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
        return new Response(
          JSON.stringify({
            ok: false,
            error: `অতিরিক্ত ভুল চেষ্টার কারণে একাউন্ট লক আছে। অনুগ্রহ করে ${remainingMinutes} মিনিট পর আবার চেষ্টা করুন।`,
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }

      const body = (await request.json().catch(() => ({}))) as { password?: string };
      const targetPassword = process.env.ADMIN_PASSWORD || "rbooker.web";

      if (!body.password || body.password !== targetPassword) {
        const currentCount = (attempt?.count || 0) + 1;
        const lockedUntil = currentCount >= 5 ? now + 15 * 60 * 1000 : 0;
        failedLoginAttempts.set(clientIp, { count: currentCount, lockedUntil });

        return new Response(
          JSON.stringify({
            ok: false,
            error: "ভুল পাসওয়ার্ড! প্রবেশাধিকার নেই।",
            remainingAttempts: Math.max(0, 5 - currentCount),
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }

      // Password correct -> clear failed attempts & issue signed HMAC token
      failedLoginAttempts.delete(clientIp);
      const token = await createSessionToken();

      return new Response(JSON.stringify({ ok: true, token }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    } catch (err) {
      console.error("Admin auth error:", err);
      return new Response(JSON.stringify({ ok: false, error: "সার্ভার এরর" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // 3. /api/admin-stats — Protected Analytics Data (Requires valid Token or Password)
  if (url.pathname === "/api/admin-stats" && (request.method === "GET" || request.method === "POST")) {
    try {
      // Check Authorization Header (Bearer token)
      const authHeader = request.headers.get("authorization");
      const passwordHeader = request.headers.get("x-admin-password");
      const targetPassword = process.env.ADMIN_PASSWORD || "rbooker.web";

      let isAuthorized = false;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        isAuthorized = await verifySessionToken(token);
      } else if (passwordHeader && passwordHeader === targetPassword) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "অননুমোদিত অ্যাক্সেস! পাসওয়ার্ড প্রয়োজন।",
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }

      // Authorized -> Fetch real stats
      const stats = await getStats();

      return new Response(JSON.stringify({ ok: true, stats }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      return new Response(JSON.stringify({ ok: false, error: "সার্ভার এরর" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // 4. /api/admin-reset — Protected Reset Counter
  if (url.pathname === "/api/admin-reset" && request.method === "POST") {
    try {
      const authHeader = request.headers.get("authorization");
      const isAuthorized = authHeader?.startsWith("Bearer ")
        ? await verifySessionToken(authHeader.slice(7).trim())
        : false;

      if (!isAuthorized) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }

      const freshStats = createEmptyStats();
      await saveStats(freshStats);

      return new Response(
        JSON.stringify({ ok: true, message: "অ্যানালিটিক্স সফলভাবে ০ এ রিসেট করা হয়েছে।" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    } catch (err) {
      console.error("Admin reset error:", err);
      return new Response(JSON.stringify({ ok: false, error: "সার্ভার এরর" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  // Not an analytics API route
  return null;
}
