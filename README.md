# 云栈笔记

一个面向 Linux、云原生、AI 与工程实践的中文技术博客，基于 Hugo + Blowfish + Cloudflare Pages。

## 本地开发

需要安装：

- Hugo Extended 0.158.0+
- Node.js 20+
- npm

```powershell
npm install
npm run dev
```

## 生产构建

```powershell
npm install
npm run build
```

构建流程会生成 Hugo 静态站点。搜索、代码复制、目录等体验由 Blowfish 主题提供。

## Cloudflare Pages

推荐配置：

- Build command: `npm run build`
- Build output directory: `public`
- Environment variable: `HUGO_VERSION=0.163.3`
- Node.js version: `20`

## 内容结构

文章放在 `content/posts` 下，图片放在 `static/uploads` 下。文章 Front Matter 已预留后台管理所需字段：

```yaml
title: "文章标题"
date: 2026-06-19
lastmod: 2026-06-19
description: "文章摘要"
slug: "article-slug"
categories: ["云原生"]
tags: ["Kubernetes", "Docker"]
series: "Kubernetes 入门到实践"
draft: false
featured: false
cover: "/uploads/example.webp"
author: "站点作者"
```

第一阶段不接入后台管理，但该结构可被后续自建后台、Headless CMS 或 Git-based CMS 直接复用。
