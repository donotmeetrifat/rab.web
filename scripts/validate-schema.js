import https from "node:https";

https
  .get("https://railwayautobooker.vercel.app/", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      // 1. Extract JSON-LD scripts
      const jsonLdRegex =
        /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      const jsonLdBlocks = [];
      let match;
      while ((match = jsonLdRegex.exec(data)) !== null) {
        try {
          jsonLdBlocks.push(JSON.parse(match[1]));
        } catch (err) {
          jsonLdBlocks.push({ parseError: err.message, raw: match[1] });
        }
      }

      // 2. Check Microdata
      const microdataMatches = data.match(/itemscope|itemprop|itemtype/gi) || [];

      // 3. Check RDFa
      const rdfaMatches = data.match(/typeof=|vocab=|property=/gi) || [];

      const report = {
        liveUrl: "https://railwayautobooker.vercel.app/",
        statusCode: res.statusCode,
        jsonLdBlockCount: jsonLdBlocks.length,
        jsonLdBlocks,
        microdataDetected: microdataMatches.length > 0,
        rdfaDetected: rdfaMatches.length > 0,
      };

      console.log(JSON.stringify(report, null, 2));
    });
  })
  .on("error", (err) => {
    console.error("Error fetching live URL:", err.message);
  });
