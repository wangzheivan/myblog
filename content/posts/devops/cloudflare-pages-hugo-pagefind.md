---
title: "用 Cloudflare Pages 部署 Hugo 与 Pagefind"
date: 2026-06-16
lastmod: 2026-06-19
description: "记录 Hugo 静态博客在 Cloudflare Pages 上构建并生成 Pagefind 搜索索引的配置方式。"
slug: "cloudflare-pages-hugo-pagefind"
categories: ["DevOps"]
tags: ["Cloudflare Pages", "Hugo", "Pagefind", "CI/CD"]
series: "博客工程化"
draft: false
featured: false
cover: "/images/tech-cover.svg"
author: "站点作者"
---

静态博客的运维成本很低，适合个人技术博客。Hugo 负责生成页面，Pagefind 负责生成本地搜索索引，Cloudflare Pages 负责自动构建和分发。

## 构建命令

项目中的 `package.json` 提供了生产构建命令：

```bash
npm run build
```

它会执行 Hugo 构建，然后对 `public` 目录生成 Pagefind 索引。

## Cloudflare Pages 配置

推荐配置如下：

| 配置项 | 值 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `public` |
| Environment variable | `HUGO_VERSION=0.163.3` |
| Node.js version | `20` |

## 搜索索引

Pagefind 会把搜索资源输出到 `public/pagefind`。搜索页通过 `/pagefind/pagefind-ui.js` 和 `/pagefind/pagefind-ui.css` 加载搜索组件，不需要数据库或后端服务。

## 总结

这种架构把复杂度放在构建阶段，线上只托管静态资源。对于技术博客来说，性能、成本和可维护性都比较均衡。

