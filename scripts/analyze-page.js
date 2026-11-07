import fs from "fs";

async function run() {
  const res = await fetch("https://railwayautobooker.vercel.app/");
  const html = await res.text();

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const metaDescMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
  );
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  const ogDesc = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
  );
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
  const ogUrl = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i);
  const twitterCard = html.match(
    /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i,
  );
  const twitterTitle = html.match(
    /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i,
  );
  const twitterDesc = html.match(
    /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i,
  );
  const twitterImage = html.match(
    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i,
  );

  // Preloads & fonts
  const preloads = [...html.matchAll(/<link[^>]*rel=["']preload["'][^>]*>/gi)].map((m) => m[0]);
  const preconnects = [...html.matchAll(/<link[^>]*rel=["']preconnect["'][^>]*>/gi)].map(
    (m) => m[0],
  );

  // Headings
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );
  const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );
  const h4s = [...html.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );

  // Images
  const imgs = [...html.matchAll(/<img([^>]+)>/gi)].map((m) => {
    const src = m[1].match(/src=["']([^"']*)["']/i)?.[1];
    const alt = m[1].match(/alt=["']([^"']*)["']/i)?.[1];
    const w = m[1].match(/width=["']?(\d+)["']?/i)?.[1];
    const h = m[1].match(/height=["']?(\d+)["']?/i)?.[1];
    return { src, alt, width: w, height: h };
  });

  // Schema
  const schemaMatches = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  let schemas = [];
  for (const sm of schemaMatches) {
    try {
      schemas.push(JSON.parse(sm[1]));
    } catch (e) {
      schemas.push({ error: "Invalid JSON" });
    }
  }

  // Links
  const links = [...html.matchAll(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(
    (m) => ({
      href: m[1],
      text: m[2].replace(/<[^>]+>/g, "").trim(),
    }),
  );

  const internalLinks = links.filter(
    (l) =>
      l.href.startsWith("/") ||
      l.href.startsWith("#") ||
      l.href.includes("railwayautobooker.vercel.app"),
  );
  const externalLinks = links.filter(
    (l) => l.href.startsWith("http") && !l.href.includes("railwayautobooker.vercel.app"),
  );

  // Word count
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = bodyText.split(" ").filter(Boolean);

  const report = {
    url: "https://railwayautobooker.vercel.app/",
    title: titleMatch?.[1],
    titleLength: titleMatch?.[1]?.length,
    metaDescription: metaDescMatch?.[1],
    descLength: metaDescMatch?.[1]?.length,
    canonical: canonicalMatch?.[1],
    robots: robotsMatch?.[1],
    og: {
      title: ogTitle?.[1],
      description: ogDesc?.[1],
      image: ogImage?.[1],
      url: ogUrl?.[1],
    },
    twitter: {
      card: twitterCard?.[1],
      title: twitterTitle?.[1],
      description: twitterDesc?.[1],
      image: twitterImage?.[1],
    },
    preloads,
    preconnects,
    h1s,
    h2s,
    h3s,
    h4s,
    images: imgs,
    schemas,
    internalLinksCount: internalLinks.length,
    internalLinks,
    externalLinksCount: externalLinks.length,
    externalLinks,
    approxWords: words.length,
  };

  fs.writeFileSync("scripts/page-analysis-result.json", JSON.stringify(report, null, 2));
  console.log("Analysis saved to scripts/page-analysis-result.json");
}

run();
