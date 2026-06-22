# 博客后台正式部署指南

本文档说明如何把后台管理功能部署到正式博客域名：

```text
后台页面：https://blog.ivanwz.com/admin/
后台 API：https://blog.ivanwz.com/api/*
```

后台页面由 Cloudflare Pages 发布，后台 API 由 Cloudflare Worker 提供。后台通过 GitHub OAuth 登录，只允许 `wangzheivan` 账号访问；保存文章、上传图片、修改配置时，Worker 会通过 GitHub API 直接提交到 `main` 分支。

## 1. 推送 main 分支代码

在本地确认当前分支是 `main`：

```bash
git branch --show-current
```

构建检查：

```bash
npm run build
```

提交并推送：

```bash
git status
git add .
git commit -m "add admin console to main"
git push origin main
```

Cloudflare Pages 会自动部署。部署成功后，先访问：

```text
https://blog.ivanwz.com/admin/
```

此时页面应该能打开，但 API 和登录还不能用，因为 Worker 还没有配置。

## 2. 创建 GitHub OAuth App

进入 GitHub：

```text
GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

填写：

```text
Application name: Ivan Blog Admin
Homepage URL: https://blog.ivanwz.com
Authorization callback URL: https://blog.ivanwz.com/api/auth/callback
```

创建后记录两项：

```text
Client ID
Client Secret
```

`Client Secret` 只显示一次，请保存到安全位置，后面会写入 Cloudflare Worker Secret。

## 3. 创建 GitHub Fine-Grained Token

进入 GitHub：

```text
GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token
```

建议配置：

```text
Token name: Ivan Blog Admin Worker
Resource owner: wangzheivan
Repository access: Only select repositories
Selected repository: wangzheivan/myblog
Expiration: 自行选择，建议先 90 天或 180 天
```

Repository permissions：

```text
Contents: Read and write
Metadata: Read-only
```

生成后复制 token，后面会作为 Worker Secret：

```text
GITHUB_TOKEN
```

## 4. 创建 Cloudflare Worker

进入 Cloudflare Dashboard：

```text
Workers & Pages -> Create application -> Create Worker
```

Worker 名称建议：

```text
ivan-blog-admin-api
```

创建完成后，可以选择两种部署方式。

方式 A：用 Wrangler 部署，推荐：

```bash
cd worker
copy wrangler.toml.example wrangler.toml
wrangler deploy
```

方式 B：在 Cloudflare 网页编辑器中粘贴 `worker/src/index.js` 内容。

推荐方式 A，因为后续更新 Worker 更方便。

## 5. 配置 Worker 变量

### 5.1 普通变量

如果使用 `wrangler.toml`，确认内容类似：

```toml
name = "ivan-blog-admin-api"
main = "src/index.js"
compatibility_date = "2026-06-22"

[vars]
GITHUB_OWNER = "wangzheivan"
GITHUB_REPO = "myblog"
GITHUB_TARGET_BRANCH = "main"
ALLOWED_GITHUB_LOGIN = "wangzheivan"
```

如果在 Cloudflare 网页配置：

```text
Worker -> Settings -> Variables and Secrets -> Add variable
```

添加：

```text
GITHUB_OWNER=wangzheivan
GITHUB_REPO=myblog
GITHUB_TARGET_BRANCH=main
ALLOWED_GITHUB_LOGIN=wangzheivan
```

### 5.2 Secret

使用 Wrangler：

```bash
cd worker
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_OAUTH_CLIENT_ID
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

填写关系：

```text
GITHUB_TOKEN = GitHub Fine-Grained Token
GITHUB_OAUTH_CLIENT_ID = GitHub OAuth App Client ID
GITHUB_OAUTH_CLIENT_SECRET = GitHub OAuth App Client Secret
SESSION_SECRET = 32 位以上随机字符串
```

如果在 Cloudflare 网页配置：

```text
Worker -> Settings -> Variables and Secrets -> Add secret
```

逐个添加上面的四项。

## 6. 绑定 Worker 路由

进入 Cloudflare：

```text
Workers & Pages -> ivan-blog-admin-api -> Settings -> Domains & Routes -> Add route
```

添加路由：

```text
blog.ivanwz.com/api/*
```

Zone 选择你的域名：

```text
ivanwz.com
```

保存后，访问：

```text
https://blog.ivanwz.com/api/me
```

未登录时应返回：

```json
{"error":"Unauthorized"}
```

如果返回 404 或 Cloudflare 错误，说明 Worker 路由没有绑定成功。

## 7. 验证后台登录

访问：

```text
https://blog.ivanwz.com/admin/
```

点击 GitHub 登录。

正常流程：

1. 跳转到 GitHub 授权页面。
2. 授权后跳回 `https://blog.ivanwz.com/admin/`。
3. 右上角显示已登录账号。

如果出现 OAuth callback 错误，重点检查 GitHub OAuth App 的 callback URL 是否是：

```text
https://blog.ivanwz.com/api/auth/callback
```

## 8. 验证内容写入

登录后台后测试：

1. 新建一篇草稿文章。
2. 点击保存。
3. 打开 GitHub 仓库 `wangzheivan/myblog`。
4. 确认 `main` 分支出现 `admin:` 开头的 commit。
5. 确认文章文件出现在：

```text
content/posts/<category>/<slug>.md
```

Cloudflare Pages 会自动重新部署。

## 9. 验证图片上传

后台上传一张图片后，GitHub 中应出现：

```text
static/uploads/YYYY/MM/<filename>
```

后台会生成 Markdown 图片路径，例如：

```markdown
![image](/uploads/2026/06/example.png)
```

复制后可粘贴到文章正文中。

## 10. 回退方法

如果后台功能影响前台博客，可以回退后台提交。

查看提交：

```bash
git log --oneline
```

回退指定提交：

```bash
git revert <commit-sha>
git push origin main
```

Cloudflare Pages 会重新部署，恢复到回退后的版本。

## 11. 注意事项

- 不要提交 `worker/wrangler.toml`。
- 不要提交 `worker/.dev.vars`。
- 不要把 GitHub Token、OAuth Secret、Session Secret 写入仓库。
- `GITHUB_TARGET_BRANCH` 当前应为 `main`。
- 后台写入的是 GitHub 仓库内容，不是数据库。
- 所有后台保存动作都会生成 GitHub commit，方便审计和回退。
