# AGENTS.md

本文件用于向 Codex（及其他 AI 协作工具）描述本项目，作为后续开发的长期参考。进入本仓库后，请优先阅读并遵循本文件。

## 项目概述

- **名称**：Ivan 的技术文档（站点标题），README 中别名"云栈笔记"
- **类型**：个人中文技术博客，主题方向为 Linux、云原生（Cloud Native）、Kubernetes、AI、DevOps、可观测性
- **技术栈**：[Hugo](https://gohugo.io/) Extended + [hugo-theme-stack](https://github.com/CaiJimmy/hugo-theme-stack)（Git submodule）
- **仓库**：https://github.com/wangzheivan/myblog
- **发布地址**：http://blog.ivanwz.com （config 中 baseURL 为 https://blog.ivanwz.com/）
- **发布方式**：Cloudflare Pages（推送到 GitHub 后自动构建发布）

> 说明：实际使用的是 Stack 主题，见 `config/_default/hugo.toml` 的 `theme = "hugo-theme-stack"` 及 `.gitmodules`。如果其他文档出现旧主题描述，以当前配置和本文件为准。

## 目录结构

```text
myblog/
├── config/_default/          # Hugo 配置（按功能拆分）
│   ├── hugo.toml             # 主配置：baseURL、主题、taxonomies、permalinks、outputs
│   ├── languages.zh-cn.toml  # 语言/站点标题/描述
│   ├── markup.toml           # Markdown 渲染：goldmark、代码高亮、目录层级
│   ├── menus.zh-cn.toml      # 顶部导航菜单 + 社交链接
│   └── params.toml           # 主题参数：侧边栏、文章、widgets、配色、评论等
├── content/                  # 站点内容
│   ├── posts/                # 文章，按主题分子目录组织
│   │   └── <topic>/_index.md # 每个子目录的栏目页
│   ├── pages/about.md        # "关于"页
│   ├── archives|categories|series|tags|search/  # 功能页
│   └── _index.md             # 首页
├── archetypes/               # 新建内容模板
├── assets/                   # logo 等 Hugo pipeline 资源
├── static/                   # 静态资源，直接复制到站点根
│   ├── images/               # 默认封面等站点图片
│   └── uploads/              # 文章上传图片
├── scripts/                  # 本地辅助脚本
├── themes/hugo-theme-stack/  # Stack 主题（Git submodule）
├── public/                   # 构建产物（忽略，勿手改）
├── resources/                # Hugo 资源缓存（忽略，勿手改）
├── .tools/                   # 项目内本地工具链（忽略，勿提交）
├── package.json              # npm 脚本
├── .node-version             # Node 主版本要求：20
├── README.md                 # 面向读者/部署的简要说明
└── CLAUDE.md                 # Claude Code 使用的同类说明文件
```

## 关键配置约定

- **默认语言**：zh-cn；`hasCJKLanguage = true`；`summaryLength = 120`
- **分类法**：`categories`、`tags`、`series`
- **文章永久链接**：`/posts/:sections/:slug/`
- **输出**：首页、栏目、分类均输出 HTML + RSS；`rssFullContent = true`
- **配色**：默认 dark，允许切换
- **数学公式**：`params.article.math = false`；如需公式，改为 true，markup 已启用 Goldmark passthrough
- **评论**：giscus 配置存在，但当前 `enabled = false`
- **搜索**：当前使用 Stack 主题内置搜索页面/widget；不要误以为已经接入 Pagefind，`package.json` 里没有 Pagefind 构建步骤

## Submodule 约定

主题目录 `themes/hugo-theme-stack/` 是 Git submodule，不是普通源码目录。

- 首次 clone 或主题目录为空时，执行：

```bash
git submodule update --init --recursive
```

- 不要直接修改 `themes/hugo-theme-stack/` 内的主题源码。
- 如需覆盖主题模板或样式，优先在项目根目录新增 `layouts/`、`assets/` 等覆盖文件。
- 当前 Codex 沙箱中 `.git` 可能是只读的，`git submodule update` 可能需要用户批准后在沙箱外执行。

## 本地工具链与验证

项目可以使用系统工具链，也可以使用项目内工具链。

当前已配置过的项目内工具链位于 `.tools/`（已被 `.gitignore` 忽略）：

- Node.js `v20.20.2`
- npm `10.8.2`
- Hugo Extended `v0.163.3`

后续代码或文章变更后，Codex 优先运行：

```bash
scripts/local-build.sh
```

该脚本会把 `.tools/node/bin` 和 `.tools/hugo` 加到 `PATH`，然后执行：

```bash
npm run build:hugo
```

本地验证成功时，Hugo 应正常生成 `public/`，且无构建错误。`public/` 和 `resources/` 是构建产物，不要手动编辑或提交。

完整生产构建命令仍是：

```bash
npm run build
```

它会先运行 `git submodule update --init --recursive`，再运行 `hugo --gc --minify`。Cloudflare Pages 使用这个命令更合适；Codex 本地日常验证优先用 `scripts/local-build.sh`，避免沙箱 `.git` 只读导致 submodule 元数据写入失败。

## npm 脚本

- `npm run dev` / `npm run serve`：先更新 submodule，再启动 Hugo server，默认监听 `0.0.0.0:1313`
- `npm run build`：先更新 submodule，再执行生产 Hugo 构建
- `npm run build:hugo`：仅执行 Hugo 构建，不更新 submodule

如果需要本地预览，使用：

```bash
PATH="$PWD/.tools/node/bin:$PWD/.tools/hugo:$PATH" npm run dev
```

## 写文章流程

1. 在 `content/posts/<主题目录>/` 下新建 `.md` 文件，或用 `hugo new posts/<topic>/<slug>.md` 套用 `archetypes/posts.md`。
2. 填写 Front Matter。推荐字段如下：

```yaml
---
title: "文章标题"
date: 2026-06-19
lastmod: 2026-06-19
description: "文章摘要（用于列表与 SEO）"
slug: "article-slug"
categories: ["云原生"]
tags: ["Kubernetes", "Docker"]
series: "系列名"
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "Ivan"
---
```

3. 正文使用 Markdown 编写。
4. 普通文章图片放 `static/uploads/<年份>/`，引用路径用 `/uploads/...`。
5. Page bundle 文章可把图片放在文章同级目录，适合一篇文章独占的图示或 SVG。
6. 发布前确认 `draft: false`。

## 内容风格

- 文章面向工程实践，优先写清楚背景、适用场景、步骤、验证方式、常见问题。
- 中文技术术语和英文产品名混排时保持可读性，例如 `RKE2 集群`、`Harbor Proxy Cache`。
- 标题和 slug 尽量稳定，避免发布后频繁修改 URL。
- 分类名尽量沿用既有集合，新增分类前先检查 `content/posts/*/_index.md`。
- 新文章默认封面可用 `/images/tech-cover.svg`，有实测图时优先使用真实截图或自绘图示。

## 发布流程

```text
本地修改代码/文章 -> 本地构建验证 -> git commit -> git push origin main -> Cloudflare Pages 自动构建发布
```

Cloudflare Pages 推荐配置：

- Build command：`npm run build`
- Build output directory：`public`
- Environment variable：`HUGO_VERSION=0.163.3`
- Node.js version：`20`

## 分支说明

- `main`：生产分支，Cloudflare Pages 从此分支发布
- `feature/admin-console`：后台管理控制台原型（实验性）
- `origin/cloudflare/workers-autoconfig`：Cloudflare Workers 相关配置实验分支

日常写作与站点维护在 `main` 上进行即可；实验性功能在 feature 分支开发后再合并。

## 给 Codex 的操作规则

- 开始修改前先看 `git status --short`，不要覆盖用户已有改动。
- 使用 `rg` / `rg --files` 搜索项目。
- 不要手动编辑 `public/`、`resources/_gen/`、`.tools/`。
- 不要直接修改 submodule 主题源码。
- 修改配置、模板、脚本或文章后，尽量运行 `scripts/local-build.sh` 验证。
- 如果必须执行 `git submodule update`、联网下载依赖、启动开发服务或写 `.git`，先说明原因并请求用户批准。
- 新增文章时确认 front matter 完整，尤其是 `slug`、`description`、`categories`、`tags`、`draft`。
- 提交信息建议简洁清晰，可用英文或中文，例如 `add new post: xxx`、`fix: update hugo build docs`。

