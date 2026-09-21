"""Export the Blogger feed into Eleventy source files, preserving Blogger URL paths.

Output (relative to repo root):
  src/posts/YYYY/MM/<slug>.html   post body verbatim (only image src/href rewritten) + front matter
  src/images/YYYY/MM/<slug>/NN.ext   images downloaded from blogger.googleusercontent.com
  _baseline/feed.json              raw feed as fetched
  _baseline/manifest.json          per post: path, sha256 of raw body, sha256 of rewritten body, image map

Re-runnable. Run from repo root:  python tools/export_blogger.py
"""
import hashlib, json, os, re, sys, urllib.request, pathlib, mimetypes

FEED = "https://www.linguist-coder.com/feeds/posts/default?alt=json&max-results=500"
ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
BASE = ROOT / "_baseline"
IMG_HOST = "https://blogger.googleusercontent.com/"

def sha(s): return hashlib.sha256(s.encode("utf-8")).hexdigest()

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(), r.headers.get_content_type()

def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)

def main():
    BASE.mkdir(exist_ok=True)
    raw, _ = fetch(FEED)
    (BASE / "feed.json").write_bytes(raw)
    feed = json.loads(raw.decode("utf-8"))["feed"]
    entries = feed["entry"]
    manifest = []
    for e in entries:
        url = [l["href"] for l in e["link"] if l["rel"] == "alternate"][0]
        path = url.replace("https://www.linguist-coder.com", "")
        m = re.fullmatch(r"/(\d{4})/(\d{2})/([^/]+)\.html", path)
        assert m, path
        yyyy, mm, slug = m.groups()
        title = e["title"]["$t"]
        published = e["published"]["$t"]
        updated = e["updated"]["$t"]
        labels = [c["term"] for c in e.get("category", [])]
        body = e["content"]["$t"]
        raw_sha = sha(body)

        # images: download every blogger.googleusercontent.com URL that appears in src= or href=
        urls = []
        for u in re.findall(r'(?:src|href)="(' + re.escape(IMG_HOST) + r'[^"]+)"', body):
            if u not in urls: urls.append(u)
        imgmap = {}
        if urls:
            imgdir = SRC / "images" / yyyy / mm / slug
            imgdir.mkdir(parents=True, exist_ok=True)
            n = 0
            for u in urls:
                # Blogger serves several sizes of one image (…/s320/x.png vs …/s1853/x.png).
                # Key by the trailing filename so the anchor (full size) and the img (thumb) share one local file
                # when they point at the same source; download the largest requested variant.
                fname = u.rsplit("/", 1)[-1]
                # new-style URLs (…/img/a/<id>=w188-h78) carry the size as a suffix on the id: strip it for the key
                key = fname.split("=")[0]
                if key not in imgmap:
                    n += 1
                    data, ctype = fetch(u)
                    ext = os.path.splitext(fname)[1] or (mimetypes.guess_extension(ctype) or ".bin")
                    local = imgdir / f"{n:02d}{ext}"
                    local.write_bytes(data)
                    imgmap[key] = {"local": f"/images/{yyyy}/{mm}/{slug}/{n:02d}{ext}", "sources": []}
                imgmap[key]["sources"].append(u)
            # replace longer URLs first: "<id>" is a prefix of "<id>=w188-h78" and would leave the suffix behind
            for key, v in imgmap.items():
                for u in sorted(v["sources"], key=len, reverse=True):
                    body = body.replace(u, v["local"])
        # sanity: nothing from the image host may remain
        assert IMG_HOST not in body, path

        out = SRC / "posts" / yyyy / mm / f"{slug}.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        fm = "\n".join([
            "---",
            f"title: {yaml_str(title)}",
            f"date: {published}",
            f"updated: {updated}",
            f"permalink: {yaml_str(path)}",
            f"tags: {json.dumps(labels, ensure_ascii=False)}",
            f"bloggerId: {yaml_str(e['id']['$t'])}",
            "layout: post.njk",
            "---",
            "",
        ])
        out.write_text(fm + body, encoding="utf-8", newline="\n")
        manifest.append({
            "path": path, "title": title, "published": published, "updated": updated, "tags": labels,
            "raw_sha256": raw_sha, "rewritten_sha256": sha(body), "raw_len": len(e["content"]["$t"]),
            "images": imgmap, "file": str(out.relative_to(ROOT)).replace("\\", "/"),
        })
        print(f"{published[:10]} {path} imgs={len(imgmap)}")
    (BASE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print("posts:", len(manifest))

if __name__ == "__main__":
    main()
