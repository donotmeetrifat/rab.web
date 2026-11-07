import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://railwayautobooker.vercel.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().split("T")[0];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <image:image>
      <image:loc>${BASE_URL}/railway-thumbnail.webp</image:loc>
    </image:image>
    <image:image>
      <image:loc>${BASE_URL}/railway-icon.png</image:loc>
    </image:image>
    <video:video>
      <video:thumbnail_loc>${BASE_URL}/railway-thumbnail.webp</video:thumbnail_loc>
      <video:title>Railway Auto-Booker Live Video Demonstration</video:title>
      <video:description>Watch how Railway Auto-Booker automatically selects train seats, coaches, and proceeds to checkout in milliseconds on Bangladesh Railway portal.</video:description>
      <video:content_loc>${BASE_URL}/railway-demo.mp4</video:content_loc>
      <video:player_loc>${BASE_URL}/</video:player_loc>
      <video:duration>90</video:duration>
      <video:publication_date>2026-10-22T08:00:00+06:00</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>
  <url>
    <loc>${BASE_URL}/privacy</loc>
    <lastmod>${today}</lastmod>
  </url>
  <url>
    <loc>${BASE_URL}/terms</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600, must-revalidate",
          },
        });
      },
    },
  },
});
