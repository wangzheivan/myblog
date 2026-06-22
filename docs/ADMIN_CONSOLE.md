# 博客后台管理说明

本分支新增一个轻量博客后台，目标是在不影响 `main` 正式站点的前提下，通过网页管理 Hugo 内容。

## 架构

- 管理前端：`admin/`
- 构建脚本：`scripts/build-admin.mjs`
- Worker API：`worker/src/index.js`
- Worker 示例配置：`worker/wrangler.toml.example`
- 内容写入：GitHub API 提交到 `feature/admin-console`

构建时会先生成 Hugo 站点，然后把 `admin/` 复制到 `public/admin/`。

```bash
npm run build
```

## GitHub OAuth

在 GitHub 创建 OAuth App：

- Homepage URL：`https://blog.ivanwz.com`
- Authorization callback URL：`https://blog.ivanwz.com/api/auth/callback`

预览环境测试时，callback URL 需要换成 Cloudflare Pages Preview 域名，例如：

```text
https://<preview-domain>/api/auth/callback
```

## GitHub Token

创建 fine-grained token，并只授权 `wangzheivan/myblog`：

- Repository permissions：Contents Read and write
- Metadata Read-only

第一阶段 Worker 写入目标分支：

```text
feature/admin-console
```

## Worker 环境变量

复制 `worker/wrangler.toml.example` 为 `worker/wrangler.toml`，不要提交真实密钥。

普通变量：

```toml
GITHUB_OWNER = "wangzheivan"
GITHUB_REPO = "myblog"
GITHUB_TARGET_BRANCH = "feature/admin-console"
ALLOWED_GITHUB_LOGIN = "wangzheivan"
```

Secret：

```bash
cd worker
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_OAUTH_CLIENT_ID
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` 建议使用 32 位以上随机字符串。

## Cloudflare 路由

推荐把 Worker 绑定到同域名 `/api/*`：

```text
blog.ivanwz.com/api/*
```

这样后台页面可通过相对路径访问 API：

```text
https://blog.ivanwz.com/admin/
```

## 后台能力

当前第一版支持：

- 上传 Markdown 并保存到 `content/posts/<category>/<slug>.md`
- 编辑文章 Front Matter 和正文
- 上传图片到 `static/uploads/YYYY/MM/`
- 管理 `content/pages/about.md`
- 管理部分站点信息和 Blowfish 常用 UI 配置

所有保存动作都会生成 GitHub commit，commit message 使用 `admin:` 前缀。

## 合并到 main 前

确认后台可用后：

1. 在 Cloudflare Pages Preview 验证后台读写。
2. 确认 `main` 正式站点不受影响。
3. 合并 `feature/admin-console` 到 `main`。
4. 将 Worker 的 `GITHUB_TARGET_BRANCH` 改为 `main`。
