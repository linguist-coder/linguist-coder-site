"""Verify the Eleventy build (_site/) against _baseline/manifest.json.

Run from repo root after `npm run build`:  python tools/verify_build.py
Exit 0 = all checks pass. Prints one line per failure.

Checks
 1. every post in the manifest exists at _site/<permalink> (32 files)
 2. the rendered page contains the post body verbatim between <!--BODY-START--> and <!--BODY-END-->
 3. feed.json (JSON Feed) has one item per post with content_html identical to the source body
 4. sitemap.xml lists every post URL and the home page
 5. a tag page exists for every label used by any post: _site/search/label/<label>/index.html
 6. a month archive exists for every YYYY/MM that has a post
 7. no reference to blogger.googleusercontent.com or blogspot.com remains anywhere in _site
 8. every same-site link in a post body (https://www.linguist-coder.com/... or /...) resolves to a file in _site
 9. CNAME, robots.txt, feed.xml, 404.html exist
"""
import json, pathlib, re, sys, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
man = json.loads((ROOT / "_baseline" / "manifest.json").read_text(encoding="utf-8"))
fails = []
def fail(msg): fails.append(msg); print("FAIL", msg)

def source_body(p):
    txt = (ROOT / p["file"]).read_text(encoding="utf-8")
    assert txt.startswith("---\n")
    end = txt.index("\n---\n", 4)
    return txt[end + 5:]

def resolve(path):
    path = urllib.parse.unquote(path.split("#")[0].split("?")[0])
    if path.endswith("/"): path += "index.html"
    f = SITE / path.lstrip("/")
    return f.is_file() or (SITE / path.lstrip("/") / "index.html").is_file()

bodies = {}
for p in man:
    body = source_body(p)
    bodies[p["path"]] = body
    f = SITE / p["path"].lstrip("/")
    if not f.is_file():
        fail(f"missing page {p['path']}"); continue
    html = f.read_text(encoding="utf-8")
    m = re.search(r"<!--BODY-START-->(.*?)<!--BODY-END-->", html, re.S)
    if not m: fail(f"no BODY markers in {p['path']}"); continue
    if m.group(1) != body:
        fail(f"body differs in {p['path']} (rendered {len(m.group(1))} chars vs source {len(body)})")
    for href in re.findall(r'href="([^"]+)"', body):
        if href.startswith("https://www.linguist-coder.com/"):
            href = href[len("https://www.linguist-coder.com"):]
        if href.startswith("/") and not resolve(href):
            fail(f"broken same-site link in {p['path']}: {href}")

fj = SITE / "feed.json"
if not fj.is_file(): fail("feed.json missing")
else:
    items = {urllib.parse.urlparse(i["url"]).path: i for i in json.loads(fj.read_text(encoding="utf-8"))["items"]}
    if len(items) != len(man): fail(f"feed.json has {len(items)} items, expected {len(man)}")
    for path, body in bodies.items():
        if path not in items: fail(f"feed.json lacks {path}")
        elif items[path].get("content_html") != body: fail(f"feed.json content differs for {path}")

sm = SITE / "sitemap.xml"
if not sm.is_file(): fail("sitemap.xml missing")
else:
    s = sm.read_text(encoding="utf-8")
    for p in man:
        if f"https://www.linguist-coder.com{p['path']}" not in s: fail(f"sitemap lacks {p['path']}")
    if "https://www.linguist-coder.com/</loc>" not in s: fail("sitemap lacks home page")

labels = sorted({t for p in man for t in p["tags"]})
for l in labels:
    if not (SITE / "search" / "label" / l / "index.html").is_file(): fail(f"tag page missing for label '{l}'")
months = sorted({p["path"][1:8] for p in man})
for ym in months:
    if not (SITE / ym / "index.html").is_file(): fail(f"month archive missing for {ym}")

for f in SITE.rglob("*"):
    if f.is_file() and f.suffix in (".html", ".xml", ".json", ".txt", ".css"):
        t = f.read_text(encoding="utf-8", errors="replace")
        if "blogger.googleusercontent.com" in t or "blogspot.com" in t:
            fail(f"blogger reference remains in {f.relative_to(SITE)}")

for name in ("CNAME", "robots.txt", "feed.xml", "404.html", "index.html"):
    if not (SITE / name).is_file(): fail(f"{name} missing")
cn = SITE / "CNAME"
if cn.is_file() and cn.read_text().strip() != "www.linguist-coder.com": fail("CNAME content wrong")

print(f"posts checked: {len(man)}  labels: {len(labels)}  months: {len(months)}  failures: {len(fails)}")
sys.exit(1 if fails else 0)
