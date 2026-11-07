import https from "node:https";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({
            url,
            status: res.statusCode,
            headers: res.headers,
            body: data,
          }),
        );
      })
      .on("error", reject);
  });
}

async function run() {
  console.log("--- Analyzing Live Sitemap & Robots.txt ---");

  // 1. Fetch robots.txt
  const robots = await fetchUrl("https://railwayautobooker.vercel.app/robots.txt");
  console.log("Robots.txt status:", robots.status);
  const sitemapDeclMatch = robots.body.match(/Sitemap:\s*(.+)/i);
  const declaredSitemap = sitemapDeclMatch ? sitemapDeclMatch[1].trim() : null;
  console.log("Robots.txt declared sitemap:", declaredSitemap);

  // 2. Fetch sitemap.xml
  const sitemapUrl = declaredSitemap || "https://railwayautobooker.vercel.app/sitemap.xml";
  const sitemap = await fetchUrl(sitemapUrl);
  console.log("Sitemap.xml status:", sitemap.status);
  console.log("Content-Type:", sitemap.headers["content-type"]);
  console.log("Content-Length:", sitemap.body.length, "bytes");

  // 3. Parse URLs
  const urlMatches = [...sitemap.body.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  console.log(`Found ${urlMatches.length} <url> entries`);

  const parsedUrls = [];
  for (const m of urlMatches) {
    const block = m[1];
    const locMatch = block.match(/<loc>(.*?)<\/loc>/);
    const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);
    const changefreqMatch = block.match(/<changefreq>(.*?)<\/changefreq>/);
    const priorityMatch = block.match(/<priority>(.*?)<\/priority>/);

    const loc = locMatch ? locMatch[1].trim() : null;
    const lastmod = lastmodMatch ? lastmodMatch[1].trim() : null;
    const changefreq = changefreqMatch ? changefreqMatch[1].trim() : null;
    const priority = priorityMatch ? priorityMatch[1].trim() : null;

    parsedUrls.push({ loc, lastmod, changefreq, priority });
  }

  // 4. Validate each URL status code
  console.log("\n--- Checking HTTP status of each URL in sitemap ---");
  const results = [];
  for (const item of parsedUrls) {
    if (item.loc) {
      try {
        const pageRes = await fetchUrl(item.loc);
        results.push({
          ...item,
          status: pageRes.status,
          hasCanonical: pageRes.body.includes('rel="canonical"'),
          canonicalMatch: pageRes.body.includes(`href="${item.loc}"`),
          isNoindexed: pageRes.body.includes("noindex"),
        });
      } catch (err) {
        results.push({ ...item, status: "ERROR", error: err.message });
      }
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
