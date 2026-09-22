const fs = require("node:fs");
const path = require("node:path");

const SITE_URL = "https://www.linguist-coder.com";
const { computeRelated } = require("./lib/related");

function stripHtml(value = "") {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value) {
  const words = stripHtml(value).split(/\s+/).filter(Boolean).slice(0, 40);
  return `${words.join(" ")}…`;
}

function dateParts(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function calendarKey(value) {
  const p = dateParts(value);
  return `${p.year}-${p.month}-${p.day}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Body of a post as written in src/posts (front matter stripped). Read from disk rather than
// templateContent, which is not available for posts that have not been rendered yet.
function rawBody(inputPath) {
  const source = fs.readFileSync(inputPath, "utf8");
  const end = source.indexOf("\n---\n", 4);
  return end === -1 ? source : source.slice(end + 5);
}

let relatedCache = { key: "", map: new Map() };
function relatedFor(posts, url) {
  const key = posts.map((post) => post.inputPath).sort().join("|");
  if (relatedCache.key !== key) {
    const docs = posts.map((post) => ({
      url: post.url,
      title: post.data.title,
      tags: post.data.tags || [],
      date: new Date(post.data.date),
      body: rawBody(post.inputPath),
    }));
    relatedCache = { key, map: computeRelated(docs) };
  }
  return relatedCache.map.get(url) || [];
}

function newest(posts) {
  return [...posts].sort((a, b) => b.date - a.date);
}

module.exports = function (eleventyConfig) {
  eleventyConfig.setServerOptions({ showVersion: false });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });

  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi.getFilteredByGlob("src/posts/**/*.html")
  );

  eleventyConfig.addFilter("excerpt", excerpt);
  eleventyConfig.addFilter("readableDate", formatDate);
  eleventyConfig.addFilter("isLaterDay", (updated, published) =>
    calendarKey(updated) > calendarKey(published)
  );
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));
  eleventyConfig.addFilter("isoDate", (value) => new Date(value).toISOString());
  eleventyConfig.addFilter("xml", xmlEscape);
  eleventyConfig.addFilter("bodyFromPage", (html = "") => {
    const match = String(html).match(/<!--BODY-START-->([\s\S]*?)<!--BODY-END-->/);
    return match ? match[1] : String(html);
  });
  eleventyConfig.addFilter("absoluteUrl", (value) => {
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `${SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
  });
  eleventyConfig.addFilter("firstImage", (html = "") => {
    const match = String(html).match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    return match ? match[1] : "";
  });
  // Thumbnail for lists: first <img> in the body, else the YouTube poster of the first embedded video
  // (this is what Blogger's media:thumbnail did for these posts), else nothing.
  eleventyConfig.addFilter("thumbnail", (html = "") => {
    const img = String(html).match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (img) return img[1];
    const yt = String(html).match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/i);
    if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
    return "";
  });
  eleventyConfig.addFilter("newest", newest);
  eleventyConfig.addFilter("withLabel", (posts, label) =>
    newest(posts.filter((post) => Array.isArray(post.data.tags) && post.data.tags.includes(label)))
  );
  eleventyConfig.addFilter("inMonth", (posts, month) =>
    newest(posts.filter((post) => post.url.startsWith(`/${month}/`)))
  );
  eleventyConfig.addFilter("allLabels", (posts) => {
    const counts = new Map();
    for (const post of posts) {
      for (const label of post.data.tags || []) counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
  });
  eleventyConfig.addFilter("allMonths", (posts) => {
    const counts = new Map();
    for (const post of posts) {
      const month = post.url.slice(1, 8);
      counts.set(month, (counts.get(month) || 0) + 1);
    }
    return [...counts].sort(([a], [b]) => b.localeCompare(a)).map(([value, count]) => {
      const [year, month] = value.split("/");
      const name = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(`${year}-${month}-01T00:00:00Z`));
      return { value, name, count };
    });
  });
  eleventyConfig.addFilter("monthName", (value) => {
    const [year, month] = String(value).split("/");
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${year}-${month}-01T00:00:00Z`));
  });
  eleventyConfig.addFilter("related", relatedFor);
  eleventyConfig.addFilter("neighbors", (posts, url) => {
    const ordered = [...posts].sort((a, b) => a.date - b.date);
    const index = ordered.findIndex((post) => post.url === url);
    return {
      previous: index > 0 ? ordered[index - 1] : null,
      next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null,
    };
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    htmlTemplateEngine: false,
    markdownTemplateEngine: "njk",
    templateFormats: ["html", "njk", "md"],
  };
};
