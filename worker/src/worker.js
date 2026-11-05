const ORIGIN = "https://abundance-protocol.onrender.com";
const MOUNT = "/abundance";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Strip the /abundance mount point before forwarding to the origin app,
    // which is rooted at /.
    let originPath = url.pathname.slice(MOUNT.length);
    if (originPath === "") originPath = "/";

    const originUrl = new URL(originPath + url.search, ORIGIN);

    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });
    originRequest.headers.set("Host", new URL(ORIGIN).host);
    originRequest.headers.set("X-Forwarded-Host", url.host);
    originRequest.headers.set("X-Forwarded-Proto", "https");

    const response = await fetch(originRequest);

    const headers = new Headers(response.headers);

    // Rewrite any redirect the app issues (e.g. /app, /login) back onto
    // the public /abundance path so the browser stays on humanplanetmedia.com.
    const location = headers.get("Location");
    if (location) {
      const loc = new URL(location, ORIGIN);
      if (loc.host === new URL(ORIGIN).host) {
        headers.set("Location", MOUNT + loc.pathname + loc.search);
      }
    }

    const contentType = headers.get("Content-Type") || "";
    if (contentType.includes("text/html")) {
      const rewriter = new HTMLRewriter()
        .on("a", new AttrRewriter("href"))
        .on("form", new AttrRewriter("action"))
        .on("img", new AttrRewriter("src"))
        .on("script", new AttrRewriter("src"))
        .on("link", new AttrRewriter("href"))
        .on("audio", new AttrRewriter("src"))
        .on("video", new AttrRewriter("src"))
        .on("source", new AttrRewriter("src"));

      return rewriter.transform(
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

class AttrRewriter {
  constructor(attr) {
    this.attr = attr;
  }
  element(el) {
    const val = el.getAttribute(this.attr);
    if (val && val.startsWith("/") && !val.startsWith("//") && !val.startsWith(MOUNT)) {
      el.setAttribute(this.attr, MOUNT + val);
    }
  }
}
