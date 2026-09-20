# linguist-coder.com

Static source of https://www.linguist-coder.com (migrated from Blogger, 2026-09).
Eleventy + GitHub Pages. Blogger URL paths are preserved exactly (`/YYYY/MM/slug.html`).

- `src/posts/YYYY/MM/*.html` — post bodies as exported from Blogger (front matter + verbatim HTML). Do not reformat.
- `src/images/` — images self-hosted (downloaded from blogger.googleusercontent.com by `tools/export_blogger.py`).
- `_baseline/` — the fetched feed and a manifest with sha256 of every body. `tools/verify_build.py` checks the build against it.
- Design and decisions: executive-assistant repo `references/blog-migration/`.

```
npm install
npm run build          # -> _site/
python tools/verify_build.py
```
