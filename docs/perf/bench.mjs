// Local micro-benchmarks approximating Memlace runtime hot-paths.
// Node 20+; no browser APIs required. Times are wall-clock ms.
import { performance } from 'node:perf_hooks';

const rng = (() => { let s = 0x9E3779B9; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; })();
const words = ['react','vite','typescript','memory','vector','embedding','chatgpt','claude','gemini','perplexity','deepseek','copilot','indexeddb','dexie','search','knowledge','prompt','context','token','stream','http','fetch','worker','service','popup','panel','provider','adapter','observer','markdown','regex','entity','summary','backup','import','export','offline','local','privacy','secure'];
const rw = () => words[Math.floor(rng() * words.length)];
const makeMsg = () => Array.from({ length: 40 + Math.floor(rng()*120) }, rw).join(' ');
const makeConv = (i) => ({
  id: `c${i}`, title: `Conversation ${i} ${rw()} ${rw()}`, provider: ['chatgpt','claude','gemini'][i%3],
  createdAt: Date.now() - i*1000,
  messages: Array.from({ length: 6 + Math.floor(rng()*20) }, (_, j) => ({ id: `m${i}-${j}`, role: j%2?'assistant':'user', content: makeMsg() })),
});

// Extractor stand-in (regex entity scan, similar shape to knowledge/extractor)
const ENTITY_RE = /\b(react|vite|typescript|dexie|indexeddb|chatgpt|claude|gemini|perplexity|deepseek|copilot|prompt|embedding|vector|token)\b/gi;
function extract(conv) {
  const text = conv.messages.map(m => m.content).join(' ');
  const ents = new Map();
  for (const m of text.matchAll(ENTITY_RE)) {
    const k = m[0].toLowerCase();
    ents.set(k, (ents.get(k)||0) + 1);
  }
  return ents;
}

// Naive tokenized index (mirrors in-memory search fallback)
function buildIndex(convs) {
  const idx = new Map(); // token -> Set<convId>
  for (const c of convs) {
    const text = (c.title + ' ' + c.messages.map(m=>m.content).join(' ')).toLowerCase();
    for (const t of text.split(/\W+/)) {
      if (!t || t.length < 3) continue;
      let s = idx.get(t); if (!s) { s = new Set(); idx.set(t, s); } s.add(c.id);
    }
  }
  return idx;
}
function search(idx, q) {
  const toks = q.toLowerCase().split(/\W+/).filter(t => t.length >= 3);
  if (!toks.length) return [];
  let acc = null;
  for (const t of toks) {
    const s = idx.get(t) ?? new Set();
    if (acc === null) acc = new Set(s);
    else for (const id of acc) if (!s.has(id)) acc.delete(id);
    if (!acc.size) break;
  }
  return [...(acc ?? [])];
}

function time(label, fn) {
  const t0 = performance.now(); const r = fn(); const dt = performance.now() - t0;
  return { label, ms: +dt.toFixed(2), r };
}

const sizes = [100, 500, 1000, 5000, 10000];
const rows = [];
for (const n of sizes) {
  const gen = time(`gen n=${n}`, () => Array.from({ length: n }, (_, i) => makeConv(i)));
  const convs = gen.r;
  const idx = time(`index n=${n}`, () => buildIndex(convs));
  const qWarm = time(`search-warm n=${n}`, () => search(idx.r, 'claude prompt embedding'));
  // repeat search a few times, take median
  const runs = [];
  for (let k = 0; k < 20; k++) runs.push(time(`s n=${n} k=${k}`, () => search(idx.r, ['claude prompt','vector token','react vite','memory context'][k%4])).ms);
  runs.sort((a,b)=>a-b);
  const median = runs[10];
  const extractOne = time(`extract 1`, () => extract(convs[0])).ms;
  const extractAll = time(`extract all n=${n}`, () => { for (const c of convs) extract(c); }).ms;
  const jsonSer = time(`json-stringify n=${n}`, () => JSON.stringify(convs)).ms;
  const jsonBytes = Buffer.byteLength(JSON.stringify(convs));
  const jsonParse = time(`json-parse n=${n}`, () => JSON.parse(JSON.stringify(convs))).ms;
  rows.push({
    n,
    gen_ms: gen.ms,
    index_ms: idx.ms,
    search_median_ms: median,
    search_warm_ms: qWarm.ms,
    extract_one_ms: extractOne,
    extract_all_ms: extractAll,
    export_json_ms: jsonSer.ms,
    import_json_ms: jsonParse.ms,
    export_size_mb: +(jsonBytes / (1024*1024)).toFixed(2),
    rss_mb: +(process.memoryUsage().rss / (1024*1024)).toFixed(1),
  });
}
console.log(JSON.stringify(rows, null, 2));
