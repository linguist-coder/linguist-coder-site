const fs = require("node:fs");
const path = require("node:path");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const postsDir = path.join(process.cwd(), "src", "posts");
const posts = walk(postsDir).filter((file) => file.endsWith(".html")).map((file) => {
  const source = fs.readFileSync(file, "utf8");
  const front = source.slice(4, source.indexOf("\n---\n", 4));
  const value = (name) => front.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim() || "";
  return {
    permalink: JSON.parse(value("permalink")),
    tags: JSON.parse(value("tags")),
  };
});

const labels = [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) => a.localeCompare(b));
const months = [...new Set(posts.map((post) => post.permalink.slice(1, 8)))].sort().reverse();

module.exports = {
  url: "https://www.linguist-coder.com",
  title: "Linguist Coder",
  subtitle: "Structural Automation for Multilingual Production",
  labels,
  months,
};
