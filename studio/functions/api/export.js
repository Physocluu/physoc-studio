const MAX_HTML = 8_000_000;

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });
  if (!env.CF_ACCOUNT_ID || !env.CF_BROWSER_TOKEN) {
    return new Response("Chromium export is not configured.", { status: 503 });
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_HTML) return new Response("Export payload is too large.", { status: 413 });

  let input;
  try {
    input = await request.json();
  } catch {
    return new Response("Invalid export request.", { status: 400 });
  }

  const width = Number(input.width);
  const height = Number(input.height);
  const html = String(input.html || "");
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || width > 2000 || height < 320 || height > 2400) {
    return new Response("Invalid export dimensions.", { status: 400 });
  }
  if (!html.includes('id="export-root"') || html.length > MAX_HTML || /<(script|iframe|object|embed)\b/i.test(html)) {
    return new Response("Invalid export HTML.", { status: 400 });
  }

  const upstream = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID)}/browser-rendering/screenshot`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_BROWSER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      html,
      selector: "#export-root",
      viewport: { width, height, deviceScaleFactor: 1 },
      screenshotOptions: { type: "png", omitBackground: true, captureBeyondViewport: false },
      waitForTimeout: 500,
    }),
  });

  if (!upstream.ok) {
    console.error("Browser Run export failed", upstream.status, await upstream.text());
    return new Response("Chromium export failed.", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${String(input.name || "physoc").replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.png"`,
    },
  });
}
