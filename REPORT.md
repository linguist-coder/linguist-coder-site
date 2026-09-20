# Build report

## Generator

- Eleventy: `3.1.6`

## Acceptance verification

Exact output from `python tools/verify_build.py` after `npm ci && npm run build`:

```text
note: no CNAME (expected before the DNS switch)
posts checked: 32  labels: 10  months: 12  failures: 0
```

## Generated paths under `_site/` (top two levels)

```text
2024/
2024/03/
2025/
2025/06/
2025/11/
2026/
2026/01/
2026/02/
2026/03/
2026/04/
2026/05/
2026/06/
2026/07/
2026/08/
2026/09/
404.html
cdn/
cdn/assets/
css/
css/site.css
feed.json
feed.xml
images/
images/2026/
index.html
robots.txt
search/
search/label/
sitemap.xml
```

## Visual checks

Checked the home page and the four specified posts at 1280px and 390px browser viewport widths. The document scroll width did not exceed the client width. The large tables remain horizontally scrollable within the post column. Images and YouTube iframes remain within the post column.

390px screenshots saved in `_report/`:

- `how-print-pdf-390.png`
- `font-replacement-390.png`
- `external-links-390.png`
- `high-instability-390.png`

## Uncompleted items

None.
