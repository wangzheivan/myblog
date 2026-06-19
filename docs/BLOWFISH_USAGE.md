# Blowfish 主题博客维护手册

本文档说明当前 Hugo + Blowfish 博客的目录结构、主题配置、文章上传字段、分类管理和手动部署流程。

站点地址：

```text
https://blog.ivanwz.com/
```

当前技术栈：

```text
Hugo + Blowfish + Cloudflare Pages + GitHub
```

## 1. 当前项目目录结构

核心目录如下：

```text
myblog/
├── archetypes/                 # Hugo 新文章模板
│   ├── default.md
│   └── posts.md
├── config/
│   └── _default/               # Hugo / Blowfish 主配置目录
│       ├── hugo.toml           # 站点基础配置
│       ├── languages.zh-cn.toml# 中文语言、作者、站点描述配置
│       ├── markup.toml         # Markdown、代码高亮、目录配置
│       ├── menus.zh-cn.toml    # 顶部导航和底部导航
│       └── params.toml         # Blowfish 主题功能配置
├── content/                    # 站点内容
│   ├── pages/                  # 独立页面，例如关于页
│   ├── posts/                  # 文章目录
│   ├── categories/             # 分类索引页
│   ├── tags/                   # 标签索引页
│   └── series/                 # 专题索引页
├── static/                     # 静态资源，原样复制到站点根目录
│   ├── favicon.svg
│   ├── images/
│   └── uploads/                # 文章图片、附件上传目录
├── themes/
│   └── blowfish/               # Blowfish 官方主题，Git submodule
├── assets/
│   └── favicon.svg             # Blowfish header logo 使用
├── package.json                # 构建命令
└── .gitmodules                 # Git submodule 配置
```

重点记住：

```text
写文章：content/posts/
传图片：static/uploads/
改导航：config/_default/menus.zh-cn.toml
改主题：config/_default/params.toml
改站点信息：config/_default/languages.zh-cn.toml
改基础 URL：config/_default/hugo.toml
```

## 2. 主要配置文件说明

### 2.1 基础配置：config/_default/hugo.toml

常用配置：

```toml
baseURL = "https://blog.ivanwz.com/"
languageCode = "zh-CN"
defaultContentLanguage = "zh-cn"
title = "云栈笔记"
theme = "blowfish"
```

用途：

- `baseURL`：正式访问域名。
- `title`：站点标题。
- `theme`：当前使用 Blowfish。
- `taxonomies`：分类、标签、专题。
- `permalinks`：文章 URL 规则。
- `outputs.home = ["HTML", "RSS", "JSON"]`：Blowfish 搜索需要 JSON 输出。

一般不频繁修改这个文件。

### 2.2 中文和作者配置：config/_default/languages.zh-cn.toml

常用配置：

```toml
title = "云栈笔记"

[params]
  description = "专注 Linux、云原生、AI 与工程实践的中文技术博客。"
  logo = "favicon.svg"
  secondaryLogo = "favicon.svg"

[params.author]
  name = "站点作者"
  email = "hello@example.com"
  headline = "Linux · Cloud Native · AI"
  bio = "记录 Linux、云原生、AI 与工程实践。"
```

用途：

- 修改站点名称。
- 修改站点描述。
- 修改作者名称。
- 修改首页个人简介。
- 修改 GitHub、邮箱等链接。

### 2.3 导航配置：config/_default/menus.zh-cn.toml

顶部导航示例：

```toml
[[main]]
  name = "文章"
  pageRef = "posts"
  weight = 20
```

字段说明：

- `name`：导航显示文字。
- `pageRef`：指向的页面或 section。
- `weight`：排序，数字越小越靠前。

如果要新增导航，例如加一个“项目”页面：

```toml
[[main]]
  name = "项目"
  pageRef = "projects"
  weight = 70
```

同时需要创建对应内容目录或页面。

### 2.4 主题配置：config/_default/params.toml

当前重要配置：

```toml
colorScheme = "slate"
defaultAppearance = "dark"
autoSwitchAppearance = true
enableSearch = true
enableCodeCopy = true
```

用途：

- `colorScheme`：主题配色。
- `defaultAppearance`：默认亮色或暗色。
- `autoSwitchAppearance`：是否跟随系统外观。
- `enableSearch`：启用 Blowfish 内置搜索。
- `enableCodeCopy`：代码块复制按钮。

文章页相关配置：

```toml
[article]
  showTableOfContents = true
  showReadingTime = true
  showDateUpdated = true
  showTaxonomies = true
  showWordCount = true
  showZenMode = true
```

首页相关配置：

```toml
[homepage]
  layout = "profile"
  showRecent = true
  showRecentItems = 6
```

列表页相关配置：

```toml
[list]
  showSummary = true
  showCards = true
  groupByYear = true
  cardView = true
```

### 2.5 Markdown 和代码配置：config/_default/markup.toml

当前代码块配置：

```toml
[highlight]
  noClasses = false
  lineNos = false
  lineNumbersInTable = false
  style = "github-dark"
```

这里已经关闭行号，避免复制脚本时混入行号。

代码复制按钮由 `params.toml` 控制：

```toml
enableCodeCopy = true
```

## 3. 上传文章

文章放在：

```text
content/posts/
```

建议按分类建立英文目录：

```text
content/posts/linux/
content/posts/cloud-native/
content/posts/ai/
content/posts/devops/
content/posts/rancher/
content/posts/database/
```

示例文章路径：

```text
content/posts/rancher/rancher-install-shell.md
```

### 3.1 文章 Front Matter 字段

新文章建议使用这个模板：

```markdown
---
title: "文章标题"
date: 2026-06-19
lastmod: 2026-06-19
description: "文章摘要，用于列表页、搜索和 SEO。"
slug: "article-slug"
categories: ["云原生"]
tags: ["Kubernetes", "Rancher", "Shell"]
series: "Rancher 实践"
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "站点作者"
---

## 背景

这里写文章背景。

## 问题

这里写问题。

## 实践步骤

这里写命令、配置、脚本。

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "hello"
```

## 总结

这里写总结。
```

字段说明：

| 字段 | 作用 | 建议 |
|---|---|---|
| `title` | 文章标题 | 中文 |
| `date` | 发布时间 | `YYYY-MM-DD` |
| `lastmod` | 更新时间 | 修改文章时同步更新 |
| `description` | 摘要 | 1-2 句话 |
| `slug` | URL 英文路径 | 小写英文、短横线 |
| `categories` | 分类 | 中文分类 |
| `tags` | 标签 | 技术关键词 |
| `series` | 专题系列 | 可为空 |
| `draft` | 是否草稿 | 发布用 `false` |
| `featured` | 是否推荐 | 暂时可保留 |
| `cover` | 封面图 | 可用默认图 |
| `author` | 作者 | 当前默认站点作者 |

### 3.2 草稿和发布

草稿：

```yaml
draft: true
```

正式发布：

```yaml
draft: false
```

Cloudflare Pages 默认只构建 `draft: false` 的文章。

## 4. 增加分类、标签、专题

Hugo 的分类、标签、专题由文章 Front Matter 自动生成，不需要单独注册。

新增分类示例：

```yaml
categories: ["数据库"]
```

新增标签示例：

```yaml
tags: ["MySQL", "索引", "性能优化"]
```

新增专题示例：

```yaml
series: "数据库实践"
```

构建后 Hugo 会自动生成：

```text
/categories/
/tags/
/series/
```

建议新增分类时，也创建一个分类目录说明文件：

```text
content/posts/database/_index.md
```

内容示例：

```markdown
---
title: "数据库"
description: "数据库、存储、SQL、NoSQL 与性能优化相关实践。"
---
```

文章放在：

```text
content/posts/database/mysql-index-basics.md
```

## 5. 上传图片和附件

图片放在：

```text
static/uploads/
```

例如：

```text
static/uploads/rancher-install-flow.png
```

文章中引用：

```markdown
![Rancher 安装流程](/uploads/rancher-install-flow.png)
```

封面图可以这样配置：

```yaml
cover: "/uploads/rancher-install-flow.png"
```

如果暂时没有封面图，继续用默认：

```yaml
cover: "/images/tech-cover.svg"
```

## 6. 本地预览

需要本机安装：

- Git
- Hugo Extended 0.158.0+
- Node.js 20+

第一次拉取或切换电脑后，需要初始化子模块：

```bash
git submodule update --init --recursive
```

本地预览：

```bash
cd /f/codex/myblog
npm run dev
```

浏览器访问：

```text
http://localhost:1313
```

本地生产构建：

```bash
npm run build
```

## 7. 手动上传和部署

每次新增或修改文章后：

```bash
cd /f/codex/myblog
git status
git add .
git commit -m "add article about rancher install"
git push
```

Cloudflare Pages 会自动部署。

查看最近提交：

```bash
git log --oneline -5
```

查看具体改动：

```bash
git diff
```

只提交某篇文章：

```bash
git add content/posts/rancher/rancher-install-shell.md
git commit -m "update rancher install article"
git push
```

## 8. Cloudflare Pages 配置

Pages 项目建议配置：

```text
Build command: npm run build
Build output directory: public
Root directory: /
```

环境变量：

```text
HUGO_VERSION = 0.163.3
NODE_VERSION = 20
```

Blowfish 要求 Hugo `0.158.0+`，所以不要继续使用 `0.147.7`。

## 9. 更新 Blowfish 主题

Blowfish 是 Git submodule。

更新主题：

```bash
cd /f/codex/myblog
git submodule update --remote --merge
git status
git add themes/blowfish
git commit -m "update blowfish theme"
git push
```

如果更新后页面异常，可以回退到上一个提交。

## 10. 常见问题

### 10.1 代码块没有复制按钮

检查：

```toml
enableCodeCopy = true
```

文件：

```text
config/_default/params.toml
```

### 10.2 代码块出现行号

检查：

```toml
lineNos = false
```

文件：

```text
config/_default/markup.toml
```

### 10.3 Cloudflare 构建失败：theme blowfish not found

说明子模块没有被拉取。

当前 `npm run build` 已经包含：

```bash
git submodule update --init --recursive
```

如果仍失败，确认 `.gitmodules` 已提交，并且 Cloudflare 构建日志可以访问 GitHub。

### 10.4 搜索不可用

检查：

```toml
enableSearch = true
```

文件：

```text
config/_default/params.toml
```

同时检查：

```toml
[outputs]
  home = ["HTML", "RSS", "JSON"]
```

文件：

```text
config/_default/hugo.toml
```

### 10.5 修改站点名

修改两个文件：

```text
config/_default/hugo.toml
config/_default/languages.zh-cn.toml
```

对应字段：

```toml
title = "新的站点名称"
```

### 10.6 修改导航

修改：

```text
config/_default/menus.zh-cn.toml
```

新增导航后，需要确认对应页面或目录存在。

