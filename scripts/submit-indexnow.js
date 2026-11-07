/**
 * IndexNow submission script for Railway Auto-Booker
 * Submits updated URLs directly to Bing, Yandex, Naver, and Seznam via IndexNow API.
 * Usage: node scripts/submit-indexnow.js
 */

const HOST = "railwayautobooker.vercel.app";
const KEY = "c7b91e4a6d2f4918a38b5d0e2c4f1a7b";
const KEY_LOCATION = `https://${HOST}/c7b91e4a6d2f4918a38b5d0e2c4f1a7b.txt`;

const URL_LIST = [`https://${HOST}/`, `https://${HOST}/privacy`, `https://${HOST}/terms`];

async function submitIndexNow() {
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: URL_LIST,
  };

  const endpoints = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
  ];

  console.log(`[IndexNow] Submitting ${URL_LIST.length} URLs for ${HOST}...`);

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      console.log(`[IndexNow] ${endpoint} -> Status ${res.status} (${res.statusText || "OK"})`);
    } catch (err) {
      console.error(`[IndexNow] Failed at ${endpoint}:`, err.message);
    }
  }
}

submitIndexNow();
