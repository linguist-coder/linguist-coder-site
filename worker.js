// Runs only for requests that do not match a file exactly (html_handling: "none").
// Maps "/" and "/dir/" to "/dir/index.html", and "/dir" (no extension, no slash) to the same,
// returning 200 without a redirect so no URL on the site ever redirects.
// Serves /404.html with status 404 for everything else (not_found_handling is "none" on purpose:
// with "404-page" the platform handles browser navigations itself and this worker never runs).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const lastSegment = p.slice(p.lastIndexOf("/") + 1);
    let candidate = null;
    if (p.endsWith("/")) candidate = p + "index.html";
    else if (!lastSegment.includes(".")) candidate = p + "/index.html";
    if (candidate) {
      url.pathname = candidate;
      const res = await env.ASSETS.fetch(new Request(url.toString(), request));
      if (res.status !== 404) return res;
    }
    const direct = await env.ASSETS.fetch(request);
    if (direct.status !== 404) return direct;
    url.pathname = "/404.html";
    const nf = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
    return new Response(nf.body, { status: 404, headers: nf.headers });
  },
};
