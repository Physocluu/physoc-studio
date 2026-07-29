const COOKIE_NAME = "physoc_auth";
const USER_COOKIE_NAME = "physoc_user";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const LOGIN_TTL = 60 * 60 * 24 * 180; // keep login records 180 days

async function hash(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
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
  label { display:block; font-size:12px; color:#9CA89F; margin:14px 0 6px; }
  label:first-of-type { margin-top:0; }
  input { width:100%; box-sizing:border-box; padding:12px 14px; border-radius:10px;
    border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.06);
    color:#FAFAFA; font-size:15px; }
  input:focus { outline:2px solid #BFF36A; }
  button { width:100%; margin-top:20px; padding:12px 14px; border-radius:10px; border:none;
    background:#BFF36A; color:#07140E; font-weight:600; font-size:15px; cursor:pointer; }
  .error { margin:14px 0 0; font-size:13px; color:#FF8A8A; }
</style>
</head>
<body>
  <form method="POST" action="/__auth">
    <h1>PhySoc Studio</h1>
    <p>Enter your name and the committee password to continue.</p>
    <label for="name">Name</label>
    <input id="name" type="text" name="name" autofocus required autocomplete="name">
    <label for="password">Password</label>
    <input id="password" type="password" name="password" required autocomplete="current-password">
    <input type="hidden" name="redirect" value="${redirect.replace(/"/g, "&quot;")}">
    <button type="submit">Enter</button>
    ${failed ? '<p class="error">Wrong password, try again.</p>' : ""}
  </form>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html;charset=utf-8" } });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function renderAdmin(env) {
  const list = await env.STUDIO_LOGINS.list({ prefix: "login:", limit: 500 });
  const entries = list.keys
    .map((k) => ({ time: k.metadata?.time || "", name: k.metadata?.name || "(unknown)" }))
    .sort((a, b) => (a.time < b.time ? 1 : -1));

  const rows = entries
    .map(
      (e) =>
        `<tr><td>${escapeHtml(new Date(e.time).toLocaleString("en-GB", { timeZone: "Europe/London" }))}</td><td>${escapeHtml(e.name)}</td></tr>`
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhySoc Studio — logins</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:40px 24px; background:#07140E; color:#FAFAFA;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  p { color:#9CA89F; font-size:14px; margin:0 0 24px; }
  a { color:#BFF36A; }
  table { border-collapse:collapse; width:100%; max-width:640px; }
  th, td { text-align:left; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.1); font-size:14px; }
  th { color:#9CA89F; font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; }
</style>
</head>
<body>
  <h1>Recent logins</h1>
  <p>${entries.length} recorded &middot; <a href="/">back to Studio</a></p>
  <table>
    <thead><tr><th>Time (UK)</th><th>Name</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="2">No logins recorded yet.</td></tr>'}</tbody>
  </table>
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
    const name = String(form.get("name") || "").trim().slice(0, 80);
    const submitted = await hash(String(form.get("password") || ""));
    const redirect = String(form.get("redirect") || "/");

    if (submitted === expected && name) {
      const time = new Date().toISOString();
      await env.STUDIO_LOGINS.put(`login:${Date.now()}:${crypto.randomUUID()}`, "", {
        metadata: { name, time },
        expirationTtl: LOGIN_TTL,
      });

      const headers = new Headers({ Location: redirect });
      headers.append("Set-Cookie", `${COOKIE_NAME}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
      headers.append("Set-Cookie", `${USER_COOKIE_NAME}=${encodeURIComponent(name)}; Path=/; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
      return new Response(null, { status: 302, headers });
    }
    return renderForm({ failed: true, redirect });
  }

  if (getCookie(request, COOKIE_NAME) !== expected) {
    return renderForm({ redirect: url.pathname + url.search });
  }

  if (url.pathname === "/admin") {
    return renderAdmin(env);
  }

  return next();
}
