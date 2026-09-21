// Runs only for requests that do not match a file exactly (html_handling: "none").
// Maps "/" and "/dir/" to "/dir/index.html", and "/dir" (no extension, no slash) to the same,
// returning 200 without a redirect so no URL on the site ever redirects.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const lastSegment = p.slice(p.lastIndexOf("/") + 1);
    if (p.endsWith("/")) {
      url.pathname = p + "index.html";
    } else if (!lastSegment.includes(".")) {
      url.pathname = p + "/index.html";
    } else {
      return env.ASSETS.fetch(request);
    }
    const res = await env.ASSETS.fetch(new Request(url.toString(), request));
    if (res.status === 404) return env.ASSETS.fetch(request); // fall through to the 404 page
    return res;
  },
};
