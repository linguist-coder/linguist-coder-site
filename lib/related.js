// Build-time "Related posts": TF-IDF cosine similarity over title + labels + body text.
// No dependencies, deterministic. Rendered outside the <!--BODY-START--> markers so
// post bodies, feed.json and tools/verify_build.py stay byte-identical.
//
// Rules
//  - title and label tokens are weighted (TITLE_WEIGHT) because bodies are long and noisy
//  - posts already linked from the body (hand-written Related sections, inline links) are
//    skipped, so the block never repeats a link the author placed by hand
//  - ties break on newer post first, then URL, so the output is stable between builds
//  - `pins` forces the first entries for a post (curated from internal-links-a4.md §4);
//    the remainder is filled by score

const TITLE_WEIGHT = 4;
const MAX_RELATED = 3;
const SITE_URL = "https://www.linguist-coder.com";

// Curated first picks (slug -> slugs). Keys and values are permalinks.
// Source: executive-assistant repo references/internal-links-a4.md §4 rows 6-13.
const PINS = {
  "/2026/01/scaling-multilingual-dtp-by-automating_15.html": [
    "/2026/07/the-expensive-part-of-multilingual-dtp.html",
    "/2026/09/comparing-indesign-files-after.html",
  ],
  "/2026/01/scaling-multilingual-dtp-by-eliminating.html": [
    "/2026/07/your-first-indesign-script-which-pages.html",
    "/2026/09/your-second-indesign-script-condensing.html",
    "/2026/09/where-indesign-script-should-stop.html",
  ],
  "/2025/06/close-all-indesign-files-with-one-click.html": [
    "/2026/02/your-first-practical-indesign.html",
    "/2026/01/how-to-run-javascript-in-adobe-indesign.html",
  ],
  "/2026/07/how-print-pdf-should-be-built-from-html.html": [
    "/2026/04/why-toc-is-hard-to-automate-in-indesign.html",
    "/2026/01/scaling-multilingual-dtp-by-automating_21.html",
  ],
  "/2026/04/why-toc-is-hard-to-automate-in-indesign.html": [
    "/2026/07/how-print-pdf-should-be-built-from-html.html",
  ],
  "/2025/11/when-times-new-roman-suddenly-vanished.html": [
    "/2026/06/when-font-replacement-should-happen-at.html",
    "/2024/03/automatically-replacing-helvetica-fonts.html",
  ],
  "/2024/03/automatically-replacing-helvetica-fonts.html": [
    "/2026/06/when-font-replacement-should-happen-at.html",
    "/2025/11/when-times-new-roman-suddenly-vanished.html",
  ],
  "/2026/06/when-font-replacement-should-happen-at.html": [
    "/2024/03/automatically-replacing-helvetica-fonts.html",
    "/2025/11/when-times-new-roman-suddenly-vanished.html",
  ],
};

const STOP = new Set(`
a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having
he her here hers him his how i if in into is it its itself just let me more most my no nor not of off on once
only or other our ours out over own same she should so some such than that the their theirs them then there
these they this those through to too under until up very was we were what when where which while who whom why
will with would you your yours
one two three first second next last new old way ways thing things something anything everything
get gets got make makes made take takes use used using uses need needs needed want wants
like even still yet already much many well back also often usually sometimes always never
does done doing say says said see seen look looks looking come comes came go goes went know knows
here there where than then now later before after because while though although however whether
into onto within without across along around behind beyond inside outside toward towards
file files document documents page pages script scripts case cases example examples time times
indesign adobe
`.trim().split(/\s+/));

function stripHtml(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
}

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}

function bodyLinks(html) {
  const out = new Set();
  const re = /href=["'](?:https?:\/\/(?:www\.)?linguist-coder\.com)?(\/20\d\d\/\d\d\/[^"'#?]+)["']/gi;
  let m;
  while ((m = re.exec(String(html)))) out.add(m[1]);
  return out;
}

// posts: [{ url, title, tags, body, date }]
function computeRelated(posts, { max = MAX_RELATED, pins = PINS } = {}) {
  const docs = posts.map((p) => {
    const tf = new Map();
    const add = (w, weight) => tf.set(w, (tf.get(w) || 0) + weight);
    for (const w of tokens(p.title)) add(w, TITLE_WEIGHT);
    for (const w of tokens((p.tags || []).join(" "))) add(w, TITLE_WEIGHT);
    for (const w of tokens(stripHtml(p.body))) add(w, 1);
    return { ...p, tf, links: bodyLinks(p.body) };
  });

  const df = new Map();
  for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length;
  const idf = (w) => Math.log(1 + N / df.get(w));

  for (const d of docs) {
    d.vec = new Map();
    let norm = 0;
    for (const [w, n] of d.tf) {
      const v = (1 + Math.log(n)) * idf(w);
      d.vec.set(w, v);
      norm += v * v;
    }
    d.norm = Math.sqrt(norm) || 1;
  }

  const cosine = (a, b) => {
    let dot = 0;
    const [s, l] = a.vec.size < b.vec.size ? [a, b] : [b, a];
    for (const [w, v] of s.vec) {
      const u = l.vec.get(w);
      if (u) dot += v * u;
    }
    return dot / (a.norm * b.norm);
  };

  const byUrl = new Map(docs.map((d) => [d.url, d]));
  for (const d of docs) {
    const chosen = [];
    for (const url of pins[d.url] || []) {
      const t = byUrl.get(url);
      if (t && t !== d && !d.links.has(url) && !chosen.includes(t)) chosen.push(t);
    }
    const scored = docs
      .filter((t) => t !== d && !d.links.has(t.url) && !chosen.includes(t))
      .map((t) => ({ t, s: cosine(d, t) }))
      .sort((x, y) => y.s - x.s || y.t.date - x.t.date || (x.t.url < y.t.url ? -1 : 1));
    for (const { t } of scored) {
      if (chosen.length >= max) break;
      chosen.push(t);
    }
    d.chosen = chosen.slice(0, max);
    d.pinned = (pins[d.url] || []).length;
  }

  // Orphan rescue: a post nobody links to (neither from a body nor from a computed block)
  // is placed into the block of its closest neighbour, replacing that block's weakest
  // unpinned pick. This keeps every post reachable by at least one in-content link.
  const inbound = new Map(docs.map((d) => [d.url, 0]));
  for (const d of docs) {
    for (const url of d.links) if (inbound.has(url) && url !== d.url) inbound.set(url, inbound.get(url) + 1);
    for (const t of d.chosen) inbound.set(t.url, inbound.get(t.url) + 1);
  }
  for (const orphan of docs.filter((d) => inbound.get(d.url) === 0)) {
    const hosts = docs
      .filter((d) => d !== orphan && !d.links.has(orphan.url) && !d.chosen.includes(orphan))
      .map((d) => ({ d, s: cosine(d, orphan) }))
      .sort((x, y) => y.s - x.s || y.d.date - x.d.date || (x.d.url < y.d.url ? -1 : 1));
    const host = hosts[0]?.d;
    if (!host) continue;
    if (host.chosen.length < max) host.chosen.push(orphan);
    else if (host.chosen.length > host.pinned) host.chosen[host.chosen.length - 1] = orphan;
    else continue;
    host.rescued = orphan.url;
  }

  const result = new Map();
  for (const d of docs) {
    result.set(
      d.url,
      d.chosen.map((t) => ({ url: t.url, title: t.title, score: cosine(d, t), rescued: d.rescued === t.url }))
    );
  }
  return result;
}

module.exports = { computeRelated, bodyLinks, PINS, SITE_URL };

// CLI: node lib/related.js  -> prints the picks for every post
if (require.main === module) {
  const fs = require("node:fs");
  const path = require("node:path");
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const f = path.join(dir, e.name);
      return e.isDirectory() ? walk(f) : [f];
    });
  const posts = walk(path.join(__dirname, "..", "src", "posts"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => {
      const src = fs.readFileSync(f, "utf8");
      const end = src.indexOf("\n---\n", 4);
      const front = src.slice(4, end);
      const value = (name) => front.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim() || "";
      return {
        url: JSON.parse(value("permalink")),
        title: JSON.parse(value("title")),
        tags: JSON.parse(value("tags") || "[]"),
        date: new Date(value("date")),
        body: src.slice(end + 5),
      };
    });
  const rel = computeRelated(posts);
  for (const p of [...posts].sort((a, b) => a.url < b.url ? -1 : 1)) {
    console.log(`\n${p.url}  [${p.title}]`);
    for (const r of rel.get(p.url)) console.log(`   ${r.score.toFixed(3)}  ${r.url}${r.rescued ? "  (rescued orphan)" : ""}`);
  }
}
