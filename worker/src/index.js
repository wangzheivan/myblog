const SESSION_COOKIE = "ivan_blog_admin";
const STATE_COOKIE = "ivan_blog_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 8;

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });

const text = (value, init = {}) =>
  new Response(value, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(init.headers || {}),
    },
  });

function requiredEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(input) {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function signSession(env, payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(await hmac(requiredEnv(env, "SESSION_SECRET"), body));
  return `${body}.${signature}`;
}

async function verifySession(env, token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = base64UrlEncode(await hmac(requiredEnv(env, "SESSION_SECRET"), body));
  if (signature !== expected) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      }),
  );
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax"];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { location, ...headers } });
}

function redirectWithCookies(location, cookies) {
  const headers = new Headers({ location });
  cookies.forEach((value) => headers.append("set-cookie", value));
  return new Response(null, { status: 302, headers });
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function githubHeaders(env) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${requiredEnv(env, "GITHUB_TOKEN")}`,
    "content-type": "application/json",
    "user-agent": "ivan-blog-admin",
    "x-github-api-version": "2022-11-28",
  };
}

function repoBase(env) {
  return `https://api.github.com/repos/${requiredEnv(env, "GITHUB_OWNER")}/${requiredEnv(env, "GITHUB_REPO")}`;
}

async function github(env, path, init = {}) {
  const response = await fetch(`${repoBase(env)}${path}`, {
    ...init,
    headers: { ...githubHeaders(env), ...(init.headers || {}) },
  });
  const textBody = await response.text();
  const data = textBody ? JSON.parse(textBody) : null;
  if (!response.ok) throw new Error(data?.message || `GitHub API failed: ${response.status}`);
  return data;
}

function normalizeBranch(env) {
  return env.GITHUB_TARGET_BRANCH || "main";
}

async function getFile(env, path) {
  const ref = encodeURIComponent(normalizeBranch(env));
  const data = await github(env, `/contents/${path}?ref=${ref}`);
  const content = new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\s/g, "")), (char) => char.charCodeAt(0)));
  return { path, sha: data.sha, content };
}

async function putFile(env, path, content, message) {
  const branch = normalizeBranch(env);
  let sha;
  try {
    sha = (await getFile(env, path)).sha;
  } catch (error) {
    sha = undefined;
  }

  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));

  return github(env, `/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: btoa(binary),
      branch,
      sha,
    }),
  });
}

async function putBinaryFile(env, path, base64, message) {
  const branch = normalizeBranch(env);
  let sha;
  try {
    sha = (await github(env, `/contents/${path}?ref=${encodeURIComponent(branch)}`)).sha;
  } catch (error) {
    sha = undefined;
  }
  return github(env, `/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: base64, branch, sha }),
  });
}

async function listTree(env) {
  const branch = normalizeBranch(env);
  const ref = await github(env, `/git/ref/heads/${branch}`);
  const tree = await github(env, `/git/trees/${ref.object.sha}?recursive=1`);
  return tree.tree || [];
}

function titleFromMarkdown(content, fallback) {
  const match = content.match(/^---\s*\n[\s\S]*?\ntitle:\s*"?([^"\n]+)"?\s*\n[\s\S]*?\n---/);
  return match?.[1]?.trim() || fallback;
}

function safePath(path) {
  const decoded = decodeURIComponent(path || "");
  if (!decoded || decoded.includes("..") || decoded.startsWith("/") || decoded.includes("\\")) {
    throw new Error("Invalid path");
  }
  return decoded;
}

function sanitizeSlug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatDatePath() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}`;
}

function setTomlValue(source, key, value) {
  const serialized =
    typeof value === "boolean" ? String(value) : `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const pattern = new RegExp(`^(${key}\\s*=\\s*).*$`, "m");
  return pattern.test(source) ? source.replace(pattern, `$1${serialized}`) : `${source.trimEnd()}\n${key} = ${serialized}\n`;
}

function setTomlSectionValue(source, section, key, value) {
  const marker = `[${section}]`;
  const index = source.indexOf(marker);
  if (index === -1) return `${source.trimEnd()}\n\n${marker}\n  ${key} = "${value}"\n`;
  const nextIndex = source.slice(index + marker.length).search(/\n\[/);
  const end = nextIndex === -1 ? source.length : index + marker.length + nextIndex;
  const before = source.slice(0, index);
  const block = source.slice(index, end);
  const after = source.slice(end);
  const serialized =
    typeof value === "boolean" ? String(value) : `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  const pattern = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`, "m");
  const nextBlock = pattern.test(block)
    ? block.replace(pattern, `$1${serialized}`)
    : `${block.trimEnd()}\n  ${key} = ${serialized}\n`;
  return `${before}${nextBlock}${after}`;
}

function readTomlValue(source, key) {
  const match = source.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
  if (!match) return "";
  const raw = match[1].trim();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"|"$/g, "");
}

function readTomlSectionValue(source, section, key) {
  const marker = `[${section}]`;
  const index = source.indexOf(marker);
  if (index === -1) return "";
  const nextIndex = source.slice(index + marker.length).search(/\n\[/);
  const end = nextIndex === -1 ? source.length : index + marker.length + nextIndex;
  return readTomlValue(source.slice(index, end), key);
}

async function requireUser(request, env) {
  const session = await verifySession(env, parseCookies(request)[SESSION_COOKIE]);
  if (!session) return null;
  if (session.login !== requiredEnv(env, "ALLOWED_GITHUB_LOGIN")) return null;
  return session;
}

async function handleLogin(request, env) {
  const state = randomToken();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", requiredEnv(env, "GITHUB_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", `${new URL(request.url).origin}/api/auth/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return redirect(url.toString(), { "set-cookie": cookie(STATE_COOKIE, state, { maxAge: 600 }) });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || parseCookies(request)[STATE_COOKIE] !== state) return text("Invalid OAuth state", { status: 400 });

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: requiredEnv(env, "GITHUB_OAUTH_CLIENT_ID"),
      client_secret: requiredEnv(env, "GITHUB_OAUTH_CLIENT_SECRET"),
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  const token = await tokenResponse.json();
  if (!token.access_token) return text("OAuth token exchange failed", { status: 400 });

  const userResponse = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${token.access_token}`, "user-agent": "ivan-blog-admin" },
  });
  const user = await userResponse.json();
  if (user.login !== requiredEnv(env, "ALLOWED_GITHUB_LOGIN")) return text("Forbidden", { status: 403 });

  const session = await signSession(env, {
    login: user.login,
    avatarUrl: user.avatar_url,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });
  return redirectWithCookies("/admin/", [
      cookie(SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE }),
      cookie(STATE_COOKIE, "", { maxAge: 0 }),
  ]);
}

async function handleArticles(env) {
  const tree = await listTree(env);
  const articles = tree
    .filter((item) => item.type === "blob")
    .filter((item) => item.path.startsWith("content/posts/") && item.path.endsWith(".md") && !item.path.endsWith("_index.md"))
    .map((item) => {
      const segments = item.path.split("/");
      return {
        path: item.path,
        name: segments.at(-1),
        categoryDir: segments.at(-2),
        title: segments.at(-1).replace(/\.md$/, ""),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  return json({ articles });
}

async function handleUploads(env) {
  const tree = await listTree(env);
  const uploads = tree
    .filter((item) => item.type === "blob")
    .filter((item) => item.path.startsWith("static/uploads/") && !item.path.endsWith(".gitkeep"))
    .map((item) => ({ path: item.path, name: item.path.split("/").at(-1) }))
    .sort((a, b) => b.path.localeCompare(a.path));
  return json({ uploads });
}

async function handleSiteConfigGet(env) {
  const [hugo, params, language] = await Promise.all([
    getFile(env, "config/_default/hugo.toml"),
    getFile(env, "config/_default/params.toml"),
    getFile(env, "config/_default/languages.zh-cn.toml"),
  ]);
  return json({
    settings: {
      siteTitle: readTomlValue(hugo.content, "title"),
      description: readTomlValue(language.content, "description"),
      authorName: readTomlValue(language.content, "name"),
      authorEmail: readTomlValue(language.content, "email"),
      headline: readTomlValue(language.content, "headline"),
      authorBio: readTomlValue(language.content, "bio"),
      colorScheme: readTomlValue(params.content, "colorScheme"),
      defaultAppearance: readTomlValue(params.content, "defaultAppearance"),
      homepageLayout: readTomlSectionValue(params.content, "homepage", "layout"),
      enableSearch: readTomlValue(params.content, "enableSearch"),
      enableCodeCopy: readTomlValue(params.content, "enableCodeCopy"),
      showTableOfContents: readTomlValue(params.content, "showTableOfContents"),
      showReadingTime: readTomlValue(params.content, "showReadingTime"),
      showWordCount: readTomlValue(params.content, "showWordCount"),
    },
  });
}

async function handleSiteConfigPut(request, env) {
  const { settings } = await request.json();
  const [hugo, params, language] = await Promise.all([
    getFile(env, "config/_default/hugo.toml"),
    getFile(env, "config/_default/params.toml"),
    getFile(env, "config/_default/languages.zh-cn.toml"),
  ]);

  let nextHugo = hugo.content;
  let nextParams = params.content;
  let nextLanguage = language.content;

  if ("siteTitle" in settings) nextHugo = setTomlValue(nextHugo, "title", settings.siteTitle);
  if ("colorScheme" in settings) nextParams = setTomlValue(nextParams, "colorScheme", settings.colorScheme);
  if ("defaultAppearance" in settings) nextParams = setTomlValue(nextParams, "defaultAppearance", settings.defaultAppearance);
  if ("homepageLayout" in settings) nextParams = setTomlSectionValue(nextParams, "homepage", "layout", settings.homepageLayout);
  ["enableSearch", "enableCodeCopy"].forEach((key) => {
    if (key in settings) nextParams = setTomlValue(nextParams, key, Boolean(settings[key]));
  });
  ["showTableOfContents", "showReadingTime", "showWordCount"].forEach((key) => {
    if (key in settings) nextParams = setTomlSectionValue(nextParams, "article", key, Boolean(settings[key]));
  });
  if ("description" in settings) nextLanguage = setTomlValue(nextLanguage, "description", settings.description);
  if ("authorName" in settings) nextLanguage = setTomlSectionValue(nextLanguage, "params.author", "name", settings.authorName);
  if ("authorEmail" in settings) nextLanguage = setTomlSectionValue(nextLanguage, "params.author", "email", settings.authorEmail);
  if ("headline" in settings) nextLanguage = setTomlSectionValue(nextLanguage, "params.author", "headline", settings.headline);
  if ("authorBio" in settings) nextLanguage = setTomlSectionValue(nextLanguage, "params.author", "bio", settings.authorBio);

  await Promise.all([
    nextHugo !== hugo.content ? putFile(env, hugo.path, nextHugo, "admin: update site title") : null,
    nextParams !== params.content ? putFile(env, params.path, nextParams, "admin: update theme settings") : null,
    nextLanguage !== language.content ? putFile(env, language.path, nextLanguage, "admin: update language settings") : null,
  ]);
  return json({ ok: true });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");

  if (path === "auth/login") return handleLogin(request, env);
  if (path === "auth/callback") return handleCallback(request, env);

  const user = await requireUser(request, env);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });

  if (path === "auth/logout" && request.method === "POST") {
    return json({ ok: true }, { headers: { "set-cookie": cookie(SESSION_COOKIE, "", { maxAge: 0 }) } });
  }
  if (path === "me") return json({ login: user.login, avatarUrl: user.avatarUrl });
  if (path === "articles" && request.method === "GET") return handleArticles(env);
  if (path.startsWith("articles/") && request.method === "GET") {
    return json(await getFile(env, safePath(path.replace(/^articles\//, ""))));
  }
  if (path.startsWith("articles/") && ["POST", "PUT"].includes(request.method)) {
    const body = await request.json();
    const filePath = safePath(body.path || path.replace(/^articles\//, ""));
    if (!filePath.startsWith("content/")) throw new Error("Only content files can be edited through this endpoint");
    await putFile(env, filePath, body.content || "", `admin: update ${filePath}`);
    return json({ ok: true, path: filePath });
  }
  if (path === "uploads" && request.method === "GET") return handleUploads(env);
  if (path === "uploads" && request.method === "POST") {
    const body = await request.json();
    const name = sanitizeSlug(body.filename || "upload.bin");
    const filePath = `static/uploads/${formatDatePath()}/${name}`;
    await putBinaryFile(env, filePath, body.base64, `admin: upload ${name}`);
    return json({ ok: true, path: filePath });
  }
  if (path === "site-config" && request.method === "GET") return handleSiteConfigGet(env);
  if (path === "site-config" && request.method === "PUT") return handleSiteConfigPut(request, env);

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) return json({ error: "Not found" }, { status: 404 });
      return await handleApi(request, env);
    } catch (error) {
      return json({ error: error.message || "Internal error" }, { status: 500 });
    }
  },
};
