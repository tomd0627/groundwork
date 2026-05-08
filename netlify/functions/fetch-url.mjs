export default async (request, context) => {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const url = new URL(request.url).searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return Response.json(
      { error: "Only http and https URLs are supported." },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Groundwork-Audit-Bot/1.0 (+https://groundwork.netlify.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return Response.json(
        { error: "Request timed out. The target server did not respond within 10 seconds." },
        { status: 504 }
      );
    }
    return Response.json(
      { error: "Could not reach the target URL. Check that it is publicly accessible." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return Response.json(
      { error: `The target server returned ${res.status} ${res.statusText}.` },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return Response.json(
      {
        error: `Expected HTML but got ${contentType.split(";")[0]}. This tool only audits HTML pages.`,
      },
      { status: 422 }
    );
  }

  let html;
  try {
    html = await res.text();
  } catch {
    return Response.json(
      { error: "Failed to read the response body from the target server." },
      { status: 502 }
    );
  }

  if (!html.trim()) {
    return Response.json(
      { error: "The target page returned an empty response." },
      { status: 422 }
    );
  }

  return Response.json(
    { html },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};
