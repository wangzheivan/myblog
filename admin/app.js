const API = "/api";
const state = {
  me: null,
  articlePath: "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showNotice(message, type = "info") {
  const notice = $("#notice");
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.classList.remove("hidden");
  window.setTimeout(() => notice.classList.add("hidden"), 4500);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (response.status === 401) {
    setLocked();
    throw new Error("需要登录");
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || response.statusText);
  return data;
}

function setLocked() {
  state.me = null;
  $("#session-label").textContent = "未登录";
  $("#login-button").classList.remove("hidden");
  $("#logout-button").classList.add("hidden");
  $("#locked").classList.remove("hidden");
  $$(".view").forEach((view) => view.classList.add("hidden"));
}

function setUnlocked(me) {
  state.me = me;
  $("#session-label").textContent = `已登录：${me.login}`;
  $("#login-button").classList.add("hidden");
  $("#logout-button").classList.remove("hidden");
  $("#locked").classList.add("hidden");
  switchView("articles");
}

function login() {
  window.location.href = `${API}/auth/login`;
}

async function logout() {
  await request("/auth/logout", { method: "POST" });
  setLocked();
}

function switchView(name) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  $$(".view").forEach((view) => view.classList.add("hidden"));
  $(`#${name}-view`).classList.remove("hidden");

  const titles = {
    articles: ["文章管理", "上传 Markdown，编辑 Front Matter，并提交到 GitHub 分支。"],
    uploads: ["图片管理", "上传图片到 static/uploads，并复制 Markdown 引用路径。"],
    pages: ["页面管理", "编辑关于页等固定页面内容。"],
    settings: ["站点设置", "管理站点信息和 Blowfish 常用 UI 配置。"],
  };
  $("#view-title").textContent = titles[name][0];
  $("#view-subtitle").textContent = titles[name][1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function listValue(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function frontMatter(fields) {
  const lines = [
    "---",
    `title: "${fields.title.replaceAll('"', '\\"')}"`,
    `date: ${fields.date || today()}`,
    `lastmod: ${today()}`,
    `description: "${(fields.description || "").replaceAll('"', '\\"')}"`,
    `slug: "${fields.slug}"`,
    `categories: [${listValue(fields.categories).map((item) => `"${item}"`).join(", ")}]`,
    `tags: [${listValue(fields.tags).map((item) => `"${item}"`).join(", ")}]`,
  ];
  if (fields.series) lines.push(`series: "${fields.series.replaceAll('"', '\\"')}"`);
  lines.push(`draft: ${fields.draft ? "true" : "false"}`);
  if (fields.cover) lines.push(`cover: "${fields.cover}"`);
  lines.push('author: "Ivan"', "---", "");
  return lines.join("\n");
}

function parseMarkdown(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const index = line.indexOf(":");
    if (index === -1) return;
    meta[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^"|"$/g, "");
  });
  return { meta, body: match[2] };
}

function fillArticleForm(article = {}) {
  const form = $("#article-form");
  form.title.value = article.title || "";
  form.slug.value = article.slug || slugify(article.title || "");
  form.categoryDir.value = article.categoryDir || "uncategorized";
  form.categories.value = article.categories || "";
  form.tags.value = article.tags || "";
  form.series.value = article.series || "";
  form.date.value = article.date || today();
  form.cover.value = article.cover || "";
  form.description.value = article.description || "";
  form.body.value = article.body || "";
  form.draft.checked = Boolean(article.draft);
  state.articlePath = article.path || "";
  $("#article-path").textContent = state.articlePath || "新文章";
}

async function loadArticles() {
  const list = $("#article-list");
  list.innerHTML = '<p class="muted">加载中...</p>';
  const data = await request("/articles");
  list.innerHTML = "";
  data.articles.forEach((article) => {
    const button = document.createElement("button");
    button.className = "item";
    button.innerHTML = `<strong>${article.title || article.name}</strong><small>${article.path}</small>`;
    button.addEventListener("click", async () => {
      const detail = await request(`/articles/${encodeURIComponent(article.path)}`);
      const parsed = parseMarkdown(detail.content);
      fillArticleForm({
        path: detail.path,
        title: parsed.meta.title || article.title,
        slug: parsed.meta.slug || "",
        categoryDir: article.categoryDir || "uncategorized",
        categories: (parsed.meta.categories || "").replace(/^\[|\]$/g, "").replaceAll('"', ""),
        tags: (parsed.meta.tags || "").replace(/^\[|\]$/g, "").replaceAll('"', ""),
        series: parsed.meta.series || "",
        date: parsed.meta.date || today(),
        cover: parsed.meta.cover || "",
        description: parsed.meta.description || "",
        draft: parsed.meta.draft === "true",
        body: parsed.body,
      });
    });
    list.append(button);
  });
}

async function saveArticle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form).entries());
  fields.draft = form.draft.checked;
  const slug = fields.slug || slugify(fields.title);
  const categoryDir = fields.categoryDir || "uncategorized";
  const path = state.articlePath || `content/posts/${categoryDir}/${slug}.md`;
  const content = `${frontMatter({ ...fields, slug })}${fields.body}`;
  await request(`/articles/${encodeURIComponent(path)}`, {
    method: state.articlePath ? "PUT" : "POST",
    body: JSON.stringify({ path, content }),
  });
  state.articlePath = path;
  $("#article-path").textContent = path;
  showNotice("文章已提交到 GitHub 分支");
  await loadArticles();
}

async function uploadMarkdown(event) {
  const file = event.target.files[0];
  if (!file) return;
  const raw = await file.text();
  const parsed = parseMarkdown(raw);
  fillArticleForm({
    title: parsed.meta.title || file.name.replace(/\.(md|markdown)$/i, ""),
    slug: parsed.meta.slug || slugify(file.name.replace(/\.(md|markdown)$/i, "")),
    categoryDir: "uncategorized",
    categories: (parsed.meta.categories || "").replace(/^\[|\]$/g, "").replaceAll('"', ""),
    tags: (parsed.meta.tags || "").replace(/^\[|\]$/g, "").replaceAll('"', ""),
    series: parsed.meta.series || "",
    date: parsed.meta.date || today(),
    cover: parsed.meta.cover || "",
    description: parsed.meta.description || "",
    draft: parsed.meta.draft === "true",
    body: parsed.body,
  });
  showNotice("Markdown 已载入编辑器，点击保存后提交");
}

async function loadUploads() {
  const grid = $("#upload-list");
  grid.innerHTML = '<p class="muted">加载中...</p>';
  const data = await request("/uploads");
  grid.innerHTML = "";
  data.uploads.forEach((item) => {
    const card = document.createElement("article");
    card.className = "media-card";
    const publicPath = `/${item.path.replace(/^static\//, "")}`;
    card.innerHTML = `<img src="${publicPath}" alt=""><code>![image](${publicPath})</code>`;
    card.addEventListener("click", async () => {
      await navigator.clipboard.writeText(`![image](${publicPath})`);
      showNotice("Markdown 图片路径已复制");
    });
    grid.append(card);
  });
}

async function uploadImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  await request("/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      base64: btoa(binary),
    }),
  });
  showNotice("图片已上传");
  await loadUploads();
}

async function loadAbout() {
  const data = await request(`/articles/${encodeURIComponent("content/pages/about.md")}`);
  $("#about-editor").value = data.content;
}

async function saveAbout() {
  await request(`/articles/${encodeURIComponent("content/pages/about.md")}`, {
    method: "PUT",
    body: JSON.stringify({ path: "content/pages/about.md", content: $("#about-editor").value }),
  });
  showNotice("关于页已保存");
}

function fillSettings(settings) {
  const form = $("#settings-form");
  Object.entries(settings).forEach(([key, value]) => {
    if (!form.elements[key]) return;
    if (form.elements[key].type === "checkbox") form.elements[key].checked = Boolean(value);
    else form.elements[key].value = value ?? "";
  });
}

async function loadSettings() {
  const data = await request("/site-config");
  fillSettings(data.settings);
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const settings = Object.fromEntries(new FormData(form).entries());
  ["enableSearch", "enableCodeCopy", "showTableOfContents", "showReadingTime", "showWordCount"].forEach((key) => {
    settings[key] = form.elements[key].checked;
  });
  await request("/site-config", { method: "PUT", body: JSON.stringify({ settings }) });
  showNotice("站点设置已提交");
}

async function boot() {
  $("#login-button").addEventListener("click", login);
  $("#locked-login").addEventListener("click", login);
  $("#logout-button").addEventListener("click", logout);
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  $("#new-article").addEventListener("click", () => fillArticleForm({ date: today() }));
  $("#refresh-articles").addEventListener("click", loadArticles);
  $("#article-form").addEventListener("submit", saveArticle);
  $("#markdown-file").addEventListener("change", uploadMarkdown);
  $("#image-file").addEventListener("change", uploadImage);
  $("#refresh-uploads").addEventListener("click", loadUploads);
  $("#load-about").addEventListener("click", loadAbout);
  $("#save-about").addEventListener("click", saveAbout);
  $("#load-settings").addEventListener("click", loadSettings);
  $("#settings-form").addEventListener("submit", saveSettings);

  try {
    const me = await request("/me");
    setUnlocked(me);
    await Promise.all([loadArticles(), loadUploads(), loadSettings()]);
  } catch (error) {
    setLocked();
  }
}

boot().catch((error) => showNotice(error.message, "error"));
