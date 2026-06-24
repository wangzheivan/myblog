# Stack 主题使用与配置指南

本文档记录当前博客在 Hugo Stack 主题下的项目结构、关键配置项、页面装修方式、文章上传规则和部署流程。

当前站点：

- 主题：Hugo Stack
- 主题目录：`themes/hugo-theme-stack`
- 主域名：`https://blog.ivanwz.com/`
- 部署平台：Cloudflare Pages
- 内容管理方式：本地 Markdown + Git 推送
- 后台管理：已移除，当前为纯静态博客

## 1. 当前项目结构

```text
.
├── config/
│   └── _default/
│       ├── hugo.toml
│       ├── languages.zh-cn.toml
│       ├── markup.toml
│       ├── menus.zh-cn.toml
│       └── params.toml
├── content/
│   ├── archives/
│   │   └── index.md
│   ├── search/
│   │   └── index.md
│   ├── pages/
│   │   └── about.md
│   ├── posts/
│   │   ├── linux/
│   │   ├── cloud-native/
│   │   ├── ai/
│   │   ├── devops/
│   │   ├── k8s/
│   │   ├── Observability/
│   │   ├── Rancher/
│   │   └── rke2/
│   ├── categories/
│   ├── tags/
│   └── series/
├── static/
│   ├── uploads/
│   ├── images/
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── mylogo.png
│   └── _headers
├── assets/
│   ├── logo-dark.png
│   ├── logo-light.png
│   └── mylogo.png
├── themes/
│   └── hugo-theme-stack/
├── package.json
└── .gitmodules
```

常用目录说明：

| 目录 | 用途 |
|---|---|
| `content/posts/` | 技术文章目录 |
| `content/pages/` | 固定页面，例如关于页 |
| `content/search/index.md` | Stack 搜索页入口 |
| `content/archives/index.md` | Stack 归档页入口 |
| `static/uploads/` | 文章图片、附件等静态资源 |
| `static/mylogo.png` | Stack 侧边栏头像/站点 logo |
| `static/favicon-32x32.png` | 浏览器标签页图标 |
| `config/_default/` | Hugo 与 Stack 主题配置 |
| `themes/hugo-theme-stack/` | Stack 主题子模块，不建议直接修改 |

## 2. 配置文件说明

### 2.1 `config/_default/hugo.toml`

这是 Hugo 站点主配置，控制域名、主题、语言、分页、分类体系、URL 规则等。

关键配置：

```toml
baseURL = "https://blog.ivanwz.com/"
locale = "zh-CN"
defaultContentLanguage = "zh-cn"
title = "云原生技术栈"
theme = "hugo-theme-stack"
hasCJKLanguage = true
summaryLength = 120
```

常见修改：

| 配置项 | 作用 | 示例 |
|---|---|---|
| `baseURL` | 正式访问域名 | `https://blog.ivanwz.com/` |
| `title` | 站点名称 | `云原生技术栈` |
| `theme` | 当前主题 | `hugo-theme-stack` |
| `hasCJKLanguage` | 中文字数统计优化 | `true` |
| `summaryLength` | 摘要长度 | `120` |

分类体系：

```toml
[taxonomies]
  category = "categories"
  tag = "tags"
  series = "series"
```

这表示文章中可以继续使用：

```yaml
categories: ["Kubernetes"]
tags: ["RKE2", "Harbor"]
series: "RKE2 实践"
```

文章链接规则：

```toml
[permalinks]
  posts = "/posts/:sections/:slug/"
```

例如：

```text
content/posts/rke2/demo.md
slug: "install-rke2"
```

最终 URL：

```text
/posts/rke2/install-rke2/
```

### 2.2 `config/_default/languages.zh-cn.toml`

这是中文语言配置。

```toml
disabled = false
locale = "zh-CN"
label = "简体中文"
weight = 1
title = "云原生技术栈"

[params]
  description = "专注 Linux、云原生、AI 与工程实践的中文技术博客。"
```

常见修改：

| 配置项 | 作用 |
|---|---|
| `title` | 当前语言下的站点标题 |
| `description` | SEO 描述、Open Graph 描述 |
| `label` | 多语言切换时显示的语言名称 |

当前站点只有中文，不需要额外配置英文语言。

### 2.3 `config/_default/params.toml`

这是 Stack 主题最重要的配置文件，控制侧边栏、深浅色、文章页、小部件、评论、图片处理等。

#### 站点描述与 favicon

```toml
description = "专注 Linux、云原生、AI 与工程实践的中文技术博客。"
mainSections = ["posts"]
rssFullContent = true
favicon = "/favicon-32x32.png"
```

说明：

| 配置项 | 作用 |
|---|---|
| `description` | 站点描述 |
| `mainSections` | 首页主文章来源 |
| `rssFullContent` | RSS 是否输出全文 |
| `favicon` | 浏览器标签页图标 |

#### 侧边栏

```toml
[sidebar]
  compact = false
  avatar = "mylogo.png"
  subtitle = "Linux · Cloud Native · AI"
```

说明：

| 配置项 | 作用 |
|---|---|
| `compact` | 是否使用紧凑侧边栏 |
| `avatar` | 侧边栏头像/logo |
| `subtitle` | 站点副标题 |

如果要换 logo：

1. 替换 `static/mylogo.png`
2. 替换 `static/favicon-32x32.png`
3. 替换 `static/favicon-16x16.png`
4. 替换 `static/apple-touch-icon.png`
5. 重新构建并部署
6. 浏览器强刷或清理站点缓存

#### 文章页

```toml
[article]
  headingAnchor = true
  math = false
  toc = true
  readingTime = true
```

说明：

| 配置项 | 作用 |
|---|---|
| `headingAnchor` | 标题显示锚点链接 |
| `math` | 是否启用数学公式 |
| `toc` | 是否默认显示文章目录 |
| `readingTime` | 是否显示阅读时间 |

单篇文章也可以在 Front Matter 中覆盖：

```yaml
toc: false
math: true
```

#### 文章列表

```toml
[article.list]
  showTags = true
```

控制首页、分类页、标签页等列表中是否显示标签。

#### 右侧小部件

```toml
[widgets]
  [[widgets.homepage]]
    type = "search"

  [[widgets.homepage]]
    type = "archives"
    [widgets.homepage.params]
      limit = 5

  [[widgets.homepage]]
    type = "categories"
    [widgets.homepage.params]
      limit = 10

  [[widgets.homepage]]
    type = "tag-cloud"
    [widgets.homepage.params]
      limit = 20

  [[widgets.page]]
    type = "toc"
```

说明：

| 小部件 | 作用 |
|---|---|
| `search` | 搜索框 |
| `archives` | 归档列表 |
| `categories` | 分类列表 |
| `tag-cloud` | 标签云 |
| `toc` | 文章页目录 |

如果不想在首页右侧显示标签云，可以删除：

```toml
[[widgets.homepage]]
  type = "tag-cloud"
```

如果想让文章页不显示右侧目录，可以删除：

```toml
[[widgets.page]]
  type = "toc"
```

#### 深色/浅色主题

```toml
[colorScheme]
  toggle = true
  default = "auto"
```

说明：

| 配置项 | 作用 |
|---|---|
| `toggle` | 是否显示深浅色切换按钮 |
| `default` | 默认主题，可选 `auto`、`light`、`dark` |

常见选择：

```toml
default = "auto"
```

跟随系统。

```toml
default = "dark"
```

默认深色。

```toml
default = "light"
```

默认浅色。

#### 评论

当前关闭评论：

```toml
[comments]
  enabled = false
  provider = "giscus"
```

后续如果要启用 Giscus，需要配置：

```toml
[comments]
  enabled = true
  provider = "giscus"

  [comments.giscus]
    repo = "wangzheivan/myblog"
    repoID = "你的 repoID"
    category = "Announcements"
    categoryID = "你的 categoryID"
    mapping = "pathname"
    lightTheme = "light"
    darkTheme = "dark"
    reactionsEnabled = 1
    emitMetadata = 0
    inputPosition = "top"
    lang = "zh-CN"
```

### 2.4 `config/_default/menus.zh-cn.toml`

这是导航菜单和社交链接配置。

主菜单示例：

```toml
[[main]]
  name = "文章"
  identifier = "posts"
  url = "/posts/"
  weight = 20
  [main.params]
    icon = "archives"
```

字段说明：

| 字段 | 作用 |
|---|---|
| `name` | 菜单显示名称 |
| `identifier` | 菜单唯一标识 |
| `url` | 点击跳转地址 |
| `weight` | 排序，数字越小越靠前 |
| `icon` | Stack 内置图标名称 |

社交链接示例：

```toml
[[social]]
  name = "GitHub"
  url = "https://github.com/wangzheivan"
  weight = 10
  [social.params]
    icon = "brand-github"
    newTab = true
```

常用图标：

| 图标名 | 适合用途 |
|---|---|
| `home` | 首页 |
| `archives` | 文章/归档 |
| `clock` | 时间归档 |
| `categories` | 分类 |
| `tag` | 标签 |
| `search` | 搜索 |
| `user` | 关于 |
| `brand-github` | GitHub |
| `rss` | RSS |

### 2.5 `config/_default/markup.toml`

这是 Markdown 渲染和代码高亮配置。

当前关键配置：

```toml
[highlight]
  noClasses = false
  lineNos = false
  lineNumbersInTable = false
  style = "github-dark"
```

说明：

| 配置项 | 作用 |
|---|---|
| `lineNos = false` | 不显示代码行号 |
| `lineNumbersInTable = false` | 避免复制代码时混入行号 |
| `style` | 代码高亮风格 |

如果你后续希望显示行号，但复制时不混入行号，可以再单独测试 Stack 的代码块表现。

## 3. 页面装修与装饰

### 3.1 修改站点名称

修改：

```text
config/_default/hugo.toml
config/_default/languages.zh-cn.toml
```

示例：

```toml
title = "Ivan Blog"
```

建议两个文件中的 `title` 保持一致。

### 3.2 修改站点副标题

修改：

```text
config/_default/params.toml
```

```toml
[sidebar]
  subtitle = "Linux · Cloud Native · AI"
```

### 3.3 修改 logo

Stack 侧边栏头像使用：

```text
static/mylogo.png
```

配置位置：

```toml
[sidebar]
  avatar = "mylogo.png"
```

建议图片：

- PNG 格式
- 正方形
- 透明背景
- 尺寸建议 256x256 或 512x512

### 3.4 修改 favicon

文件位置：

```text
static/favicon-16x16.png
static/favicon-32x32.png
static/apple-touch-icon.png
```

配置位置：

```toml
favicon = "/favicon-32x32.png"
```

注意：浏览器 favicon 缓存很强，替换后如果不生效，可以：

- 使用无痕窗口访问
- 访问 `https://blog.ivanwz.com/favicon-32x32.png` 看图片是否已更新
- 清理当前站点缓存
- 等待 Cloudflare 缓存刷新

### 3.5 修改首页右侧内容

首页右侧小部件在：

```text
config/_default/params.toml
```

当前显示：

- 搜索
- 归档
- 分类
- 标签云

如果首页太拥挤，可以只保留搜索和分类：

```toml
[widgets]
  [[widgets.homepage]]
    type = "search"

  [[widgets.homepage]]
    type = "categories"
    [widgets.homepage.params]
      limit = 10
```

### 3.6 修改文章右侧目录

全局开关：

```toml
[article]
  toc = true

[widgets]
  [[widgets.page]]
    type = "toc"
```

单篇关闭：

```yaml
toc: false
```

### 3.7 自定义 CSS

如果要做局部装修，不要直接修改 `themes/hugo-theme-stack/`。

推荐方式：

1. 新建：

```text
assets/scss/custom.scss
```

2. 写入自定义样式。

3. 如果 Stack 当前版本未自动加载该文件，再通过覆盖主题 partial 的方式引入。

建议只做轻量调整，例如：

- logo 尺寸
- 字体大小
- 文章宽度
- 代码块样式
- 标签颜色
- 首页小部件间距

不建议一开始大改主题结构，否则后续升级 Stack 会更麻烦。

## 4. 上传文章

### 4.1 推荐目录

文章放到：

```text
content/posts/<分类>/<文章文件>.md
```

示例：

```text
content/posts/k8s/pod.md
content/posts/rke2/install-rke2.md
content/posts/linux/top-command.md
```

### 4.2 文章 Front Matter 模板

```yaml
---
title: "文章标题"
date: 2026-06-24
lastmod: 2026-06-24
description: "文章摘要，用于列表页、SEO 和搜索结果。"
slug: "article-slug"
categories: ["Kubernetes"]
tags: ["Kubernetes", "RKE2", "运维"]
series: "Kubernetes 实践"
draft: false
image: "/images/tech-cover.svg"
toc: true
math: false
---
```

推荐字段说明：

| 字段 | 作用 | 建议 |
|---|---|---|
| `title` | 文章标题 | 中文即可 |
| `date` | 发布时间 | `YYYY-MM-DD` |
| `lastmod` | 更新时间 | 修改文章后同步更新 |
| `description` | 摘要 | 80-160 字较合适 |
| `slug` | URL 英文短名 | 推荐英文、数字、短横线 |
| `categories` | 分类 | 1-2 个 |
| `tags` | 标签 | 3-6 个 |
| `series` | 专题/系列 | 可选 |
| `draft` | 是否草稿 | 发布设为 `false` |
| `image` | 封面图 | Stack 推荐字段 |
| `toc` | 是否显示目录 | 长文建议 `true` |
| `math` | 是否启用公式 | 需要公式时设 `true` |

当前部分旧文章可能还使用：

```yaml
cover: "/images/tech-cover.svg"
```

Stack 更推荐：

```yaml
image: "/images/tech-cover.svg"
```

旧字段短期不影响文章正文，但如果希望列表封面正常显示，建议逐步把 `cover` 改为 `image`。

### 4.3 图片上传

图片推荐放到：

```text
static/uploads/YYYY/MM/
```

示例：

```text
static/uploads/2026/06/demo.png
```

文章中引用：

```markdown
![图片说明](/uploads/2026/06/demo.png)
```

封面图引用：

```yaml
image: "/uploads/2026/06/demo.png"
```

### 4.4 代码块

推荐写法：

````markdown
```bash
kubectl get pods -A
```
````

当前配置关闭了行号，适合复制脚本。

### 4.5 表格

Markdown 表格示例：

```markdown
| 项目 | 示例 |
|---|---|
| Kubernetes 发行版 | RKE2 |
| 存储方案 | Longhorn |
```

技术长表格建议控制列数，避免移动端横向滚动太严重。

## 5. 分类、标签、专题管理

### 5.1 增加分类

只需要在文章 Front Matter 中使用新分类：

```yaml
categories: ["Observability"]
```

Hugo 会自动生成：

```text
/categories/observability/
```

如果要给分类页加描述，可以创建：

```text
content/categories/observability/_index.md
```

示例：

```yaml
---
title: "Observability"
description: "可观测性、监控、日志、链路追踪相关内容。"
---
```

### 5.2 增加标签

文章中直接添加：

```yaml
tags: ["Prometheus", "Grafana", "Logging"]
```

Hugo 会自动生成标签页。

### 5.3 增加专题

文章中添加：

```yaml
series: "RKE2 实践"
```

或：

```yaml
series: ["RKE2 实践"]
```

如果要给专题页加描述，可以创建：

```text
content/series/rke2-practice/_index.md
```

## 6. 固定页面

### 6.1 关于页

当前关于页：

```text
content/pages/about.md
```

访问地址：

```text
/pages/about/
```

如果想改成更短的：

```text
/about/
```

可以将文件移动为：

```text
content/about/index.md
```

然后把菜单中的 URL 改为：

```toml
url = "/about/"
```

### 6.2 搜索页

当前搜索页：

```text
content/search/index.md
```

不要删除这个页面，否则 `/search/` 会失效。

### 6.3 归档页

当前归档页：

```text
content/archives/index.md
```

不要删除这个页面，否则 `/archives/` 会失效。

## 7. 本地预览

### 7.1 启动本地服务

```bash
npm run dev
```

默认访问：

```text
http://localhost:1313/
```

### 7.2 本地构建

```bash
npm run build
```

构建输出目录：

```text
public/
```

如果本地找不到 `hugo`，需要安装 Hugo extended，或者只依赖 Cloudflare Pages 构建。

Windows 推荐安装方式：

```powershell
winget install Hugo.Hugo.Extended
```

然后验证：

```bash
hugo version
```

版本建议不低于 Cloudflare 当前配置的：

```text
0.163.3
```

## 8. 发布流程

### 8.1 查看改动

```bash
git status
```

### 8.2 构建检查

```bash
npm run build
```

### 8.3 提交

```bash
git add .
git commit -m "add new post"
```

### 8.4 推送

```bash
git push origin main
```

如果提示远端有更新：

```bash
git fetch origin
git rebase origin/main
git push origin main
```

如果 rebase 过程中出现冲突，需要先解决冲突，再执行：

```bash
git add .
git rebase --continue
git push origin main
```

## 9. Cloudflare Pages 配置

当前推荐配置：

| 项目 | 值 |
|---|---|
| Build command | `npm run build` |
| Output directory | `public` |
| Root directory | `/` |
| Production branch | `main` |
| `HUGO_VERSION` | `0.163.3` |
| `NODE_VERSION` | `20` |

当前已经移除后台功能，不再需要：

- Worker API
- `/api/*` 路由
- GitHub OAuth App
- 后台相关 Worker secrets

建议在 Cloudflare 中删除或停用旧 Worker 路由：

```text
blog.ivanwz.com/api/*
```

## 10. 主题升级

当前主题通过 Git submodule 管理：

```text
themes/hugo-theme-stack
```

查看当前版本：

```bash
git submodule status
```

升级主题：

```bash
cd themes/hugo-theme-stack
git fetch --tags
git checkout <新版本tag>
cd ../..
git add themes/hugo-theme-stack
git commit -m "update stack theme"
git push origin main
```

升级前建议：

- 先查看 Stack release note
- 本地执行 `npm run build`
- 检查首页、文章页、搜索页、归档页

## 11. 常见问题

### 11.1 为什么浏览器 favicon 没变？

常见原因：

- 浏览器缓存
- Cloudflare 缓存
- 替换了 `assets/` 中的 logo，但没有替换 `static/favicon-32x32.png`

检查方式：

```text
https://blog.ivanwz.com/favicon-32x32.png
```

### 11.2 为什么搜索页为空？

检查：

- `content/search/index.md` 是否存在
- Front Matter 是否包含：

```yaml
layout: "search"
outputs:
  - HTML
  - JSON
```

- 构建后是否生成：

```text
public/search/index.json
```

### 11.3 为什么文章没有封面？

Stack 推荐使用：

```yaml
image: "/uploads/2026/06/demo.png"
```

旧字段：

```yaml
cover: "/uploads/2026/06/demo.png"
```

可能不会被 Stack 用作封面。

### 11.4 为什么文章目录不显示？

检查全局配置：

```toml
[article]
  toc = true

[[widgets.page]]
  type = "toc"
```

检查单篇文章是否关闭：

```yaml
toc: false
```

### 11.5 为什么中文显示乱码？

通常是终端编码显示问题，而不是文件本身损坏。

建议：

- 编辑器使用 UTF-8
- Git Bash 或 VS Code 打开文件检查
- PowerShell 可尝试：

```powershell
chcp 65001
```

## 12. 建议的后续装修方向

优先级建议：

1. 统一所有文章 Front Matter，把 `cover` 逐步改为 `image`
2. 给主要分类补充 `_index.md` 描述
3. 增加文章封面图规范
4. 建立 `static/uploads/YYYY/MM/` 图片归档习惯
5. 根据阅读体验轻量调整 Stack CSS
6. 后续再考虑评论、统计、Open Graph 分享图

不建议一开始大规模改主题模板。先用 Stack 默认结构跑稳定，再针对真实阅读体验逐步装修。
