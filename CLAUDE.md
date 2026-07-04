# CLAUDE.md

本文件用于向 Claude（及其他 AI 协作工具）描述本项目，作为后续开发的长期参考。

## 项目概述

- **名称**：Ivan 的技术文档（站点标题），README 中别名"云栈笔记"
- **类型**：个人中文技术博客，主题方向为 Linux、云原生（Cloud Native）、Kubernetes、AI、DevOps、可观测性
- **技术栈**：[Hugo](https://gohugo.io/)（静态站点生成器，Extended 版本）+ [hugo-theme-stack](https://github.com/CaiJimmy/hugo-theme-stack)（Git submodule）
- **仓库**：https://github.com/wangzheivan/myblog
- **发布地址**：http://blog.ivanwz.com （config 中 baseURL 为 https://blog.ivanwz.com/）
- **发布方式**：Cloudflare Pages（推送到 GitHub 后自动构建发布）

> 说明：README.md 里写的是"基于 Blowfish 主题"，但**实际使用的是 Stack 主题**（见 `config/_default/hugo.toml` 的 `theme = "hugo-theme-stack"` 及 `.gitmodules`）。以本文件为准。

## 目录结构

```
myblog/
├── config/_default/          # Hugo 配置（按功能拆分）
│   ├── hugo.toml             # 主配置：baseURL、主题、taxonomies、permalinks、outputs
│   ├── languages.zh-cn.toml  # 语言/站点标题/描述
│   ├── markup.toml           # Markdown 渲染：goldmark、代码高亮、目录层级
│   ├── menus.zh-cn.toml      # 顶部导航菜单 + 社交链接
│   └── params.toml           # 主题参数：侧边栏、文章、widgets、配色、评论等
├── content/                  # 站点内容
│   ├── posts/                # 文章，按主题分子目录（ai/cloud-native/devops/k8s/linux/Observability/Rancher/rke2）
│   │   └── <topic>/_index.md # 每个子目录的栏目页
│   ├── pages/about.md        # "关于"页
│   ├── archives|categories|series|tags|search/  # 各功能页
│   └── _index.md             # 首页
├── archetypes/               # 新建内容模板（default.md、posts.md）
├── assets/                   # logo（logo-dark/light、mylogo）
├── static/                   # 静态资源，直接拷贝到站点根
│   ├── images/               # 站点图片（如 tech-cover.svg 默认封面）
│   └── uploads/              # 文章上传图片（按年份，如 uploads/2026）
├── layouts/                  # 主题模板覆盖（当前为空，全部沿用主题默认）
├── themes/hugo-theme-stack/  # Stack 主题（Git submodule）
├── public/                   # 构建产物（.gitignore 忽略，勿手改）
├── resources/                # Hugo 资源缓存（_gen 被忽略）
├── package.json              # npm 脚本（dev/build/serve）
├── .node-version             # Node 版本（20）
└── README.md                 # 面向读者的简要说明
```

## 关键配置约定

- **默认语言**：zh-cn；`hasCJKLanguage = true`；`summaryLength = 120`
- **分类法（taxonomies）**：categories、tags、series
- **文章永久链接**：`/posts/:sections/:slug/`
- **输出**：首页/栏目/分类均输出 HTML + RSS；`rssFullContent = true`
- **配色**：默认 dark，允许切换
- **数学公式**：`params.article.math = false`（如需公式，改为 true；markup 已启用 goldmark passthrough）
- **评论**：giscus，当前 `enabled = false`
- **搜索**：由 Stack 主题内置搜索 widget 提供

## 写文章流程

1. 在 `content/posts/<主题目录>/` 下新建 `.md` 文件（可用 `hugo new posts/<topic>/<slug>.md` 套用 `archetypes/posts.md` 模板）。
2. 填写 Front Matter（YAML），字段约定：

```yaml
---
title: "文章标题"
date: 2026-06-19
lastmod: 2026-06-19
description: "文章摘要（用于列表与 SEO）"
slug: "article-slug"          # 决定 URL
categories: ["云原生"]
tags: ["Kubernetes", "Docker"]
series: "系列名"              # 可选，无则留空 ""
draft: false                  # true = 不发布
featured: false               # true = 首页/列表突出展示
cover: "/images/tech-cover.svg"  # 封面，默认用 tech-cover.svg
author: "站点作者"
---
```

3. 正文用 Markdown 编写；文章内图片放 `static/uploads/<年份>/`，引用路径以 `/uploads/...` 开头。
4. `draft: true` 的文章不会发布；完成后改为 `false`。

## 本地开发

需要：Hugo Extended、Node.js 20+、npm。首次会自动拉取主题 submodule。

```powershell
npm install
npm run dev      # 本地预览 http://localhost:1313
npm run build    # 生产构建，产物在 public/
```

npm 脚本说明：
- `dev` / `serve`：先 `git submodule update --init --recursive`，再启动 `hugo server`
- `build`：更新 submodule 后执行 `hugo --gc --minify`
- `build:hugo`：仅构建，不更新 submodule

## 发布流程（当前）

```
本地修改代码/文章  →  git commit  →  git push 到 GitHub(main)  →  Cloudflare Pages 自动构建并发布
```

- 只需推送到 GitHub `main` 分支，Cloudflare Pages 会监听并自动构建发布，无需手动部署。
- Cloudflare Pages 构建配置：
  - Build command：`npm run build`
  - Build output directory：`public`
  - 环境变量：`HUGO_VERSION=0.163.3`（README 建议值；本地要求 Hugo Extended 0.158.0+）
  - Node.js version：`20`
- 常规发布一篇文章的最短路径：

```bash
git add content/posts/<topic>/<slug>.md static/uploads/...
git commit -m "add new post: <标题>"
git push origin main
```

## 分支说明

- `main`：生产分支，Cloudflare Pages 从此分支发布。
- `feature/admin-console`：后台管理控制台原型（实验性，未合并主流程）。
- `origin/cloudflare/workers-autoconfig`：Cloudflare Workers 相关配置实验分支。

日常写作与站点维护在 `main` 上进行即可；实验性功能在 feature 分支开发后再合并。

## 给 AI 协作者的注意事项

- 不要手动编辑 `public/`、`resources/_gen/`（构建产物，已被 .gitignore 忽略）。
- 主题在 `themes/hugo-theme-stack/`（submodule），一般不直接改；如需定制样式/模板，用 `layouts/` 目录**覆盖**主题对应文件，而非修改 submodule。
- 修改配置后可用 `npm run dev` 本地验证，再提交。
- 新文章务必确认 `draft: false` 才会发布。
- 提交信息可用简洁描述（历史里既有中文拼音也有英文，建议统一为清晰的中文或英文短句，如 `add new post: xxx`）。
