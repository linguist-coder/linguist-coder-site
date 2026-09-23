# linguist-coder.com

Static source of https://www.linguist-coder.com (migrated from Blogger, 2026-09).
Eleventy, hosted as a Cloudflare Worker with static assets (`wrangler.jsonc` + `worker.js`; Workers Builds connected to this repo: build `npm run build`, deploy `npx wrangler deploy`). Not Cloudflare Pages: Pages redirects `/foo.html` to `/foo`, which would put a redirect on every Blogger-era URL. `html_handling: "none"` plus `worker.js` serves every URL at 200 with no redirects. GitHub Actions only builds and verifies. Blogger URL paths are preserved exactly (`/YYYY/MM/slug.html`).

- `src/posts/YYYY/MM/*.html` — post bodies as exported from Blogger (front matter + verbatim HTML). Do not reformat.
- `src/images/` — images self-hosted (downloaded from blogger.googleusercontent.com by `tools/export_blogger.py`).
- `lib/related.js` — build-time "Related posts" block (TF-IDF over title + labels + body, 3 links, skips links already in the body, orphan rescue so every post has an inbound link). Rendered by `src/_includes/post.njk` outside the BODY markers, so bodies and feeds stay byte-identical. `node lib/related.js` prints the picks. Curated first picks live in `PINS`.
- `_baseline/` — the fetched feed and a manifest with sha256 of every body. `tools/verify_build.py` checks the build against it.
- Design and decisions: executive-assistant repo `references/blog-migration/`.

```
npm install
npm run build          # -> _site/
python tools/verify_build.py
```

## Adding a new post

1. `src/posts/YYYY/MM/<slug>.html`: front matter (`title`, `date`, `updated`, `permalink`, `tags`, `layout: post.njk`; no `bloggerId`) + HTML body, LF line endings. Escape `<` `>` inside `<pre><code>`.
2. Add an entry at the top of `_baseline/manifest.json` (sha256 and `raw_len` of the body after the front matter). Keep the file's format: `json.dumps(..., ensure_ascii=False, indent=1)`, LF, no trailing newline. Without the entry, check 3 fails (feed item count).
3. `npm run build && python tools/verify_build.py`, then push to `main`. Workers Builds deploys; confirm at `/feed.json`.
