const COOKIE_NAME = "physoc_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function hash(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function renderForm({ failed = false, redirect = "/" } = {}) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhySoc Studio</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#07140E; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  form { width:min(360px,90vw); padding:40px 36px; border-radius:20px;
    background:rgba(191,243,106,0.04); border:1px solid rgba(191,243,106,0.24); }
  h1 { margin:0 0 6px; font-size:20px; color:#FAFAFA; }
  p { margin:0 0 24px; font-size:14px; color:#9CA89F; }
  input { width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px;
    border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06);
    color:#FAFAFA; font-size:15px; }
  input:focus { outline:2px solid #BFF36A; }
  button { width:100%; margin-top:16px; padding:12px 14px; border-radius:10px; border:none;
    background:#BFF36A; color:#07140E; font-weight:600; font-size:15px; cursor:pointer; }
  .error { margin:14px 0 0; font-size:13px; color:#FF8A8A; }
</style>
</head>
<body>
  <form method="POST" action="/__auth">
    <h1>PhySoc Studio</h1>
    <p>Enter the committee password to continue.</p>
    <input type="password" name="password" autofocus required autocomplete="current-password">
    <input type="hidden" name="redirect" value="${redirect.replace(/"/g, "&quot;")}">
    <button type="submit">Enter</button>
    ${failed ? '<p class="error">Wrong password, try again.</p>' : ""}
  </form>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html;charset=utf-8" } });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const expected = await hash(env.SITE_PASSWORD || "");

  if (request.method === "POST" && url.pathname === "/__auth") {
    const form = await request.formData();
    const submitted = await hash(String(form.get("password") || ""));
    const redirect = String(form.get("redirect") || "/");
    if (submitted === expected) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: redirect,
          "Set-Cookie": `${COOKIE_NAME}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
        },
      });
    }
    return renderForm({ failed: true, redirect });
  }

  if (getCookie(request, COOKIE_NAME) === expected) {
    return next();
  }

  return renderForm({ redirect: url.pathname + url.search });
}
