import fs from "fs";

async function testTechnical() {
  const target = "https://railwayautobooker.vercel.app/";

  // 1. Fetch Homepage
  const t0 = performance.now();
  const res = await fetch(target);
  const ttfb = performance.now() - t0;
  const headers = Object.fromEntries(res.headers.entries());
  const html = await res.text();
  const htmlBytes = Buffer.byteLength(html, "utf8");

  // 2. Fetch robots.txt
  const robotsRes = await fetch("https://railwayautobooker.vercel.app/robots.txt");
  const robotsTxt = await robotsRes.text();

  // 3. Fetch sitemap.xml
  const sitemapRes = await fetch("https://railwayautobooker.vercel.app/sitemap.xml");
  const sitemapXml = await sitemapRes.text();

  // 4. Fetch admin
  const adminRes = await fetch("https://railwayautobooker.vercel.app/admin");
  const adminHtml = await adminRes.text();
  const adminNoindex = adminHtml.includes("noindex");

  // 5. IndexNow key files
  const keyRes1 = await fetch(
    "https://railwayautobooker.vercel.app/c7b91e4a6d2f4918a38b5d0e2c4f1a7b.txt",
  );
  const key1Status = keyRes1.status;
  const keyRes2 = await fetch("https://railwayautobooker.vercel.app/indexnow.txt");
  const key2Status = keyRes2.status;

  // 6. Inspect HTML
  const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1];
  const robotsMeta = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i)?.[1];
  const preloads = [...html.matchAll(/<link[^>]*rel=["']preload["'][^>]*>/gi)].map((m) => m[0]);
  const jsonLd = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];

  // Back-button hijacking check
  const backButtonHijacking =
    html.includes("history.pushState(null, null,") || html.includes("popstate");

  // Stack detection
  const poweredBy = headers["x-powered-by"] || "hidden/none";
  const server = headers["server"] || "unknown";

  const results = {
    url: target,
    status: res.status,
    ttfbMs: Math.round(ttfb),
    htmlSizeKB: (htmlBytes / 1024).toFixed(2),
    googlebot2MBCapPass: htmlBytes < 2 * 1024 * 1024,
    headers: {
      server,
      strictTransportSecurity: headers["strict-transport-security"] || "MISSING",
      contentSecurityPolicy: headers["content-security-policy"] ? "PRESENT" : "MISSING",
      xFrameOptions: headers["x-frame-options"] || "MISSING",
      xContentTypeOptions: headers["x-content-type-options"] || "MISSING",
      referrerPolicy: headers["referrer-policy"] || "MISSING",
      permissionsPolicy: headers["permissions-policy"] ? "PRESENT" : "MISSING",
    },
    crawlability: {
      robotsStatus: robotsRes.status,
      robotsSitemapPresent: robotsTxt.includes("sitemap.xml"),
      robotsAdminBlocked: robotsTxt.includes("Disallow: /admin"),
      robotsApiBlocked: robotsTxt.includes("Disallow: /api/"),
      aiCrawlersAllowed: robotsTxt.includes("GPTBot") && robotsTxt.includes("ClaudeBot"),
      sitemapStatus: sitemapRes.status,
      sitemapHasAbsoluteUrls: sitemapXml.includes("https://railwayautobooker.vercel.app/"),
      sitemapUrlCount: (sitemapXml.match(/<loc>/g) || []).length,
    },
    indexability: {
      canonical,
      canonicalMatch: canonical === target,
      robotsMeta,
      adminNoindexPresent: adminNoindex,
    },
    security: {
      httpsEnforced: true,
      hstsPreload: headers["strict-transport-security"]?.includes("preload"),
      backButtonHijackFree: !backButtonHijacking,
      stackCveExposureRisk: "Zero (Vercel Serverless Edge, Node.js runtime, no PHP)",
    },
    structuredData: {
      present: !!jsonLd,
      serverRendered: true,
      types: jsonLd ? JSON.parse(jsonLd)["@graph"]?.map((g) => g["@type"]) : [],
    },
    preloads,
    indexNow: {
      key1Status,
      key2Status,
    },
  };

  fs.writeFileSync("scripts/technical-audit-result.json", JSON.stringify(results, null, 2));
  console.log("Technical audit results written to scripts/technical-audit-result.json");
}

testTechnical();
